import type {
  Plan,
  PlanExercise,
  PlanExerciseInsert,
  PlanExerciseUpdate,
  PlanSession,
  PlanSessionInsert,
  PlanSessionUpdate,
  WarmupItem,
} from '../types/db'
import { MAX_NAME_LENGTH } from '../lib/exerciseForm'
import { nextSessionName } from '../lib/planBuilder'
import { moveTo } from '../lib/reorder'
import { newUuid } from '../lib/uuid'
import { getPlanById, type EditablePlan, type PlanExerciseDetail, type SessionDetail } from './activePlan'
import { DataError, ensureAffected, ensureOk, inUseError, isReferenced, own, unwrap, unwrapOrNull } from './client'
import { deleteFuturePlannedSlots } from './schedule'

export type NewSession = Omit<PlanSessionInsert, 'id' | 'plan_id' | 'position'>
export type NewPlanExercise = Omit<PlanExerciseInsert, 'id' | 'session_id' | 'position'>

export interface PlanSummary extends Plan {
  sessionCount: number
  exerciseCount: number
}

interface RawSummary extends Plan {
  plan_session: { id: string; archived: boolean; plan_exercise: { id: string }[] }[]
}

/** All plans, archived included (the caller filters), by name, with the counts of their live sessions and exercises. */
export async function listPlanSummaries(): Promise<PlanSummary[]> {
  const rows = unwrap<RawSummary[]>(
    await (await own('plan')).select('*, plan_session(id, archived, plan_exercise(id))').order('name'),
  )
  return rows.map(({ plan_session, ...plan }) => {
    const live = plan_session.filter((session) => !session.archived)
    return {
      ...plan,
      sessionCount: live.length,
      exerciseCount: live.reduce((total, session) => total + session.plan_exercise.length, 0),
    }
  })
}

/** The plan shown in Oggi, if any; the builder asks before replacing it. */
export async function getActivePlanHead(): Promise<Pick<Plan, 'id' | 'name'> | null> {
  return unwrapOrNull<Pick<Plan, 'id' | 'name'>>(
    await (await own('plan')).select('id, name').eq('is_active', true).maybeSingle(),
  )
}

/**
 * Creates a plan with its first session, so the builder opens ready for the first exercise. The
 * very first plan of the account (archived ones count) starts active, later ones are drafts. If the
 * session cannot be added the empty plan is removed again, so a retry never leaves two.
 */
export async function createPlanWithSession(name: string): Promise<Plan> {
  const existing = unwrap<{ id: string }[]>(await (await own('plan')).select('id').limit(1))
  const plan = unwrap<Plan>(
    await (await own('plan')).insert({ name, is_active: existing.length === 0 }).select().single(),
  )
  try {
    await addSession(plan.id, { name: nextSessionName([]) })
    return plan
  } catch (failure) {
    const cleanup = await (await own('plan')).delete().eq('id', plan.id)
    if (cleanup.error) {
      throw new DataError(`The session could not be added and the empty plan "${name}" could not be removed`, 'partial_create', {
        cause: failure,
      })
    }
    throw failure
  }
}

export async function renamePlan(id: string, name: string): Promise<void> {
  ensureAffected(await (await own('plan')).update({ name }).eq('id', id).select('id'))
}

/**
 * Result of dropping the future planned slots of a plan that stopped being current. The plan change
 * itself is already saved when this is reported: a failure only leaves slots to remove later.
 */
export type ScheduleCleanup = { ok: true } | { ok: false; error: DataError }

/**
 * Deletes the future `planned` slots of every session of `planIds`; see `deleteFuturePlannedSlots`
 * for what is never touched. Runs only after the plan change succeeded, and a DataError becomes a
 * result instead of a throw, so a cleanup problem cannot make a saved switch look failed.
 */
async function clearFutureSlotsOfPlans(planIds: string[]): Promise<ScheduleCleanup> {
  if (planIds.length === 0) return { ok: true }
  try {
    const sessions = unwrap<{ id: string }[]>(await (await own('plan_session')).select('id').in('plan_id', planIds))
    await deleteFuturePlannedSlots(sessions.map((session) => session.id))
    return { ok: true }
  } catch (error) {
    if (!(error instanceof DataError)) throw error
    return { ok: false, error }
  }
}

/** Takes a plan out of Oggi without choosing another; having no active plan is a state the app handles. */
export async function deactivatePlan(id: string): Promise<ScheduleCleanup> {
  ensureAffected(await (await own('plan')).update({ is_active: false }).eq('id', id).select('id'))
  return clearFutureSlotsOfPlans([id])
}

/** Archived plans cannot be active (check constraint), so both flags change together. */
export async function archivePlan(id: string): Promise<ScheduleCleanup> {
  ensureAffected(await (await own('plan')).update({ archived: true, is_active: false }).eq('id', id).select('id'))
  return clearFutureSlotsOfPlans([id])
}

export async function restorePlan(id: string): Promise<void> {
  ensureAffected(await (await own('plan')).update({ archived: false }).eq('id', id).select('id'))
}

/** Deletes a plan whose sessions were never logged; refuses with an `in_use` DataError otherwise. */
export async function deletePlan(id: string): Promise<void> {
  const sessions = unwrap<{ id: string }[]>(await (await own('plan_session')).select('id').eq('plan_id', id))
  const sessionIds = sessions.map((s) => s.id)
  if (await isReferenced('workout', 'session_id', sessionIds)) throw inUseError('The plan')
  // Deleting the plan only nulls the session of its slots: the future ones would stay as orphans.
  await deleteFuturePlannedSlots(sessionIds)
  ensureOk(await (await own('plan')).delete().eq('id', id))
}

/**
 * Makes `planId` the only active plan. One active plan per owner is a unique index, so the old
 * one is deactivated first; if activating fails the old one is put back to avoid "no active plan".
 * The target is checked up front so a missing or archived plan never touches the current one.
 * Only once the switch is saved are the old plan's future planned slots removed (a failure there is
 * reported in the result, never thrown: the switch stands and a restored old plan keeps its slots).
 */
export async function setActivePlan(planId: string): Promise<ScheduleCleanup> {
  const target = unwrapOrNull<Pick<Plan, 'archived'>>(
    await (await own('plan')).select('archived').eq('id', planId).maybeSingle(),
  )
  if (!target) throw new DataError('The plan does not exist', 'not_found')
  if (target.archived) throw new DataError('An archived plan cannot be activated', 'archived')

  const deactivated = unwrap<{ id: string }[]>(
    await (await own('plan')).update({ is_active: false }).eq('is_active', true).neq('id', planId).select('id'),
  )

  let failure: DataError
  try {
    ensureAffected(await (await own('plan')).update({ is_active: true }).eq('id', planId).select('id'))
    return await clearFutureSlotsOfPlans(deactivated.map((plan) => plan.id))
  } catch (error) {
    if (!(error instanceof DataError)) throw error
    failure = error
  }

  if (deactivated.length > 0) {
    const restore = await (await own('plan'))
      .update({ is_active: true })
      .in('id', deactivated.map((p) => p.id))
    if (restore.error) {
      throw new DataError(
        `${failure.message} (and the previous plan could not be reactivated: no plan is active)`,
        failure.code,
        { cause: restore.error },
      )
    }
  }
  throw failure
}

async function nextPosition(table: 'plan_session' | 'plan_exercise', parentColumn: string, parentId: string): Promise<number> {
  const [last] = unwrap<{ position: number }[]>(
    await (await own(table)).select('position').eq(parentColumn, parentId).order('position', { ascending: false }).limit(1),
  )
  return last ? last.position + 1 : 0
}

export async function addSession(planId: string, session: NewSession): Promise<PlanSession> {
  const position = await nextPosition('plan_session', 'plan_id', planId)
  return unwrap<PlanSession>(
    await (await own('plan_session')).insert({ ...session, plan_id: planId, position }).select().single(),
  )
}

export async function updateSession(id: string, changes: PlanSessionUpdate): Promise<void> {
  ensureAffected(await (await own('plan_session')).update(changes).eq('id', id).select('id'))
}

export type SessionRemoval = 'deleted' | 'archived'

/**
 * Deletes a session that was never logged; one with workouts is archived so the history stays linked.
 * Its future planned slots go too; past, done and skipped slots stay. A delete cleans up first: it
 * would null the slots' session and they could no longer be found. An archive keeps the session id,
 * so it goes first and a failed cleanup never deletes slots of a session that stays in the plan.
 */
export async function removeSession(id: string): Promise<SessionRemoval> {
  const logged = await isReferenced('workout', 'session_id', [id])
  if (logged) {
    await updateSession(id, { archived: true })
    await deleteFuturePlannedSlots([id])
    return 'archived'
  }
  await deleteFuturePlannedSlots([id])
  ensureOk(await (await own('plan_session')).delete().eq('id', id))
  return 'deleted'
}

/** Brings an archived session back as the last of its plan; returns its new position. */
export async function restoreSession(planId: string, id: string): Promise<number> {
  const position = await nextPosition('plan_session', 'plan_id', planId)
  await updateSession(id, { archived: false, position })
  return position
}

/**
 * Rewrites positions 0..n-1 following the order of `sessions` in one upsert keyed on id.
 * Callers must pass the complete list, archived sessions last: they keep their rows in the unique
 * (plan_id, position) index, and rows left out would keep an old position and could collide.
 * Positions are deferrable unique, so swaps are valid; the payload carries every not-null column.
 */
export async function reorderSessions(sessions: PlanSession[]): Promise<void> {
  const rows = sessions.map(({ id, plan_id, name, subtitle, is_optional, archived }, position) => ({
    id,
    plan_id,
    name,
    subtitle,
    is_optional,
    archived,
    position,
  }))
  ensureOk(await (await own('plan_session')).upsert(rows, { onConflict: 'id' }))
}

export async function addPlanExercise(sessionId: string, exercise: NewPlanExercise): Promise<PlanExercise> {
  const position = await nextPosition('plan_exercise', 'session_id', sessionId)
  return unwrap<PlanExercise>(
    await (await own('plan_exercise')).insert({ ...exercise, session_id: sessionId, position }).select().single(),
  )
}

export async function updatePlanExercise(id: string, changes: PlanExerciseUpdate): Promise<void> {
  ensureAffected(await (await own('plan_exercise')).update(changes).eq('id', id).select('id'))
}

/** Plan rows are templates: logged sets point at the exercise, so removing one is always safe. */
export async function removePlanExercise(id: string): Promise<void> {
  ensureOk(await (await own('plan_exercise')).delete().eq('id', id))
}

/** Same single-upsert reorder as `reorderSessions` (complete list required), for the exercises of one session. */
export async function reorderPlanExercises(exercises: PlanExercise[]): Promise<void> {
  const rows = exercises.map(
    (
      { id, session_id, exercise_id, target_sets, target_reps, target_unit, suggested_weight_kg, suggested_weight_max_kg },
      position,
    ) => ({
      id,
      session_id,
      exercise_id,
      target_sets,
      target_reps,
      target_unit,
      suggested_weight_kg,
      suggested_weight_max_kg,
      position,
    }),
  )
  ensureOk(await (await own('plan_exercise')).upsert(rows, { onConflict: 'id' }))
}

/**
 * Puts a removed exercise back at `index` (its old place) with the same target. It goes in as the last
 * one, then the session is reordered unless it was the last. Returns the session's exercises in order.
 */
export async function restorePlanExercise(
  removed: PlanExerciseDetail,
  index: number,
  remaining: PlanExerciseDetail[],
): Promise<PlanExerciseDetail[]> {
  const { exercise, session_id, exercise_id, target_sets, target_reps, target_unit, suggested_weight_kg, suggested_weight_max_kg } = removed
  const row = await addPlanExercise(session_id, {
    exercise_id,
    target_sets,
    target_reps,
    target_unit,
    suggested_weight_kg,
    suggested_weight_max_kg,
  })
  const ordered = moveTo([...remaining, { ...row, exercise }], remaining.length, index)
  if (index < remaining.length) await reorderPlanExercises(ordered)
  return ordered
}

const COPY_SUFFIX = ' (copia)'

async function insertRows(table: 'plan_session' | 'plan_exercise' | 'warmup_item', rows: object[]): Promise<void> {
  if (rows.length > 0) ensureOk(await (await own(table)).insert(rows))
}

const copyExerciseRow = (
  sessionId: string,
  { exercise_id, position, target_sets, target_reps, target_unit, suggested_weight_kg, suggested_weight_max_kg }: PlanExercise,
) => ({
  session_id: sessionId,
  exercise_id,
  position,
  target_sets,
  target_reps,
  target_unit,
  suggested_weight_kg,
  suggested_weight_max_kg,
})

const copyWarmupRow = (sessionId: string, { position, name, reps_text, note }: WarmupItem) => ({
  session_id: sessionId,
  position,
  name,
  reps_text,
  note,
})

/** Copies the live sessions of `source` with their exercises and warm-ups under `planId`, with fresh ids. */
async function copyContents(source: EditablePlan, planId: string): Promise<void> {
  const sessions = source.sessions.map((session, position) => ({ from: session, id: newUuid(), position }))

  await insertRows(
    'plan_session',
    sessions.map(({ from, id, position }) => ({
      id,
      plan_id: planId,
      name: from.name,
      subtitle: from.subtitle,
      position,
      is_optional: from.is_optional,
    })),
  )
  await insertRows('plan_exercise', sessions.flatMap(({ from, id }) => from.exercises.map((row) => copyExerciseRow(id, row))))
  await insertRows('warmup_item', sessions.flatMap(({ from, id }) => from.warmup.map((item) => copyWarmupRow(id, item))))
}

/**
 * Copies a plan as "<name> (copia)": inactive, not archived, with its live sessions, exercises and
 * warm-ups under new ids (archived sessions stay behind). The tables are filled one after the other,
 * so a failure deletes the half-built copy; if even that fails, a `partial_copy` DataError says so.
 */
export async function duplicatePlan(sourceId: string): Promise<Plan> {
  const source = await getPlanById(sourceId)
  if (!source) throw new DataError('The plan does not exist', 'not_found')

  const name = source.name.slice(0, MAX_NAME_LENGTH - COPY_SUFFIX.length) + COPY_SUFFIX
  const copy = unwrap<Plan>(await (await own('plan')).insert({ name }).select().single())
  try {
    await copyContents(source, copy.id)
    return copy
  } catch (failure) {
    // sessions, exercises and warm-ups of the copy go with it (on delete cascade).
    const cleanup = await (await own('plan')).delete().eq('id', copy.id)
    if (cleanup.error) {
      throw new DataError(`Duplication failed and the partial copy "${name}" could not be removed`, 'partial_copy', {
        cause: failure,
      })
    }
    throw failure
  }
}

/** Inserts `rows` and returns them as stored, in position order; nothing to insert is not a request. */
async function insertAndRead<T extends { position: number }>(table: 'plan_exercise' | 'warmup_item', rows: object[]): Promise<T[]> {
  if (rows.length === 0) return []
  const stored = unwrap<T[]>(await (await own(table)).insert(rows).select())
  return [...stored].sort((a, b) => a.position - b.position)
}

/**
 * Copies a session as the last one of its plan, named `name`, with its exercises (targets and order)
 * and warm-ups. Returns the copy as the builder holds it. The tables are filled one after the other,
 * so a failure deletes the half-built session; if even that fails, a `partial_session` DataError says so.
 */
export async function duplicateSession(source: SessionDetail, name: string): Promise<SessionDetail> {
  const position = await nextPosition('plan_session', 'plan_id', source.plan_id)
  const copy = unwrap<PlanSession>(
    await (await own('plan_session'))
      .insert({ plan_id: source.plan_id, name, subtitle: source.subtitle, is_optional: source.is_optional, position })
      .select()
      .single(),
  )
  try {
    const rows = await insertAndRead<PlanExercise>('plan_exercise', source.exercises.map((row) => copyExerciseRow(copy.id, row)))
    const warmup = await insertAndRead<WarmupItem>('warmup_item', source.warmup.map((item) => copyWarmupRow(copy.id, item)))
    const exercises: PlanExerciseDetail[] = rows.map((row) => {
      const exercise = source.exercises.find((candidate) => candidate.exercise_id === row.exercise_id)?.exercise
      if (!exercise) throw new DataError('The copy holds an exercise the source does not have')
      return { ...row, exercise }
    })
    return { ...copy, exercises, warmup }
  } catch (failure) {
    // its exercises and warm-ups go with it (on delete cascade).
    const cleanup = await (await own('plan_session')).delete().eq('id', copy.id)
    if (cleanup.error) {
      throw new DataError(`Duplication failed and the partial session "${name}" could not be removed`, 'partial_session', {
        cause: failure,
      })
    }
    throw failure
  }
}
