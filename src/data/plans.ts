import type {
  Plan,
  PlanExercise,
  PlanExerciseInsert,
  PlanExerciseUpdate,
  PlanSession,
  PlanSessionInsert,
  PlanSessionUpdate,
} from '../types/db'
import { MAX_NAME_LENGTH } from '../lib/exerciseForm'
import { newUuid } from '../lib/uuid'
import { getPlanById, type EditablePlan } from './activePlan'
import { DataError, ensureAffected, ensureOk, inUseError, isReferenced, supabase, unwrap, unwrapOrNull } from './client'

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
    await supabase.from('plan').select('*, plan_session(id, archived, plan_exercise(id))').order('name'),
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

export async function createPlan(name: string): Promise<Plan> {
  return unwrap<Plan>(await supabase.from('plan').insert({ name }).select().single())
}

export async function renamePlan(id: string, name: string): Promise<void> {
  ensureAffected(await supabase.from('plan').update({ name }).eq('id', id).select('id'))
}

/** Archived plans cannot be active (check constraint), so both flags change together. */
export async function archivePlan(id: string): Promise<void> {
  ensureAffected(await supabase.from('plan').update({ archived: true, is_active: false }).eq('id', id).select('id'))
}

export async function restorePlan(id: string): Promise<void> {
  ensureAffected(await supabase.from('plan').update({ archived: false }).eq('id', id).select('id'))
}

/** Deletes a plan whose sessions were never logged; refuses with an `in_use` DataError otherwise. */
export async function deletePlan(id: string): Promise<void> {
  const sessions = unwrap<{ id: string }[]>(await supabase.from('plan_session').select('id').eq('plan_id', id))
  if (await isReferenced('workout', 'session_id', sessions.map((s) => s.id))) throw inUseError('The plan')
  ensureOk(await supabase.from('plan').delete().eq('id', id))
}

/**
 * Makes `planId` the only active plan. One active plan per owner is a unique index, so the old
 * one is deactivated first; if activating fails the old one is put back to avoid "no active plan".
 * The target is checked up front so a missing or archived plan never touches the current one.
 */
export async function setActivePlan(planId: string): Promise<void> {
  const target = unwrapOrNull<Pick<Plan, 'archived'>>(
    await supabase.from('plan').select('archived').eq('id', planId).maybeSingle(),
  )
  if (!target) throw new DataError('The plan does not exist', 'not_found')
  if (target.archived) throw new DataError('An archived plan cannot be activated', 'archived')

  const deactivated = unwrap<{ id: string }[]>(
    await supabase.from('plan').update({ is_active: false }).eq('is_active', true).neq('id', planId).select('id'),
  )

  let failure: DataError
  try {
    ensureAffected(await supabase.from('plan').update({ is_active: true }).eq('id', planId).select('id'))
    return
  } catch (error) {
    if (!(error instanceof DataError)) throw error
    failure = error
  }

  if (deactivated.length > 0) {
    const restore = await supabase
      .from('plan')
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
    await supabase.from(table).select('position').eq(parentColumn, parentId).order('position', { ascending: false }).limit(1),
  )
  return last ? last.position + 1 : 0
}

export async function addSession(planId: string, session: NewSession): Promise<PlanSession> {
  const position = await nextPosition('plan_session', 'plan_id', planId)
  return unwrap<PlanSession>(
    await supabase.from('plan_session').insert({ ...session, plan_id: planId, position }).select().single(),
  )
}

export async function updateSession(id: string, changes: PlanSessionUpdate): Promise<void> {
  ensureAffected(await supabase.from('plan_session').update(changes).eq('id', id).select('id'))
}

export type SessionRemoval = 'deleted' | 'archived'

/** Deletes a session that was never logged; one with workouts is archived so the history stays linked. */
export async function removeSession(id: string): Promise<SessionRemoval> {
  if (await isReferenced('workout', 'session_id', [id])) {
    await updateSession(id, { archived: true })
    return 'archived'
  }
  ensureOk(await supabase.from('plan_session').delete().eq('id', id))
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
  ensureOk(await supabase.from('plan_session').upsert(rows, { onConflict: 'id' }))
}

export async function addPlanExercise(sessionId: string, exercise: NewPlanExercise): Promise<PlanExercise> {
  const position = await nextPosition('plan_exercise', 'session_id', sessionId)
  return unwrap<PlanExercise>(
    await supabase.from('plan_exercise').insert({ ...exercise, session_id: sessionId, position }).select().single(),
  )
}

export async function updatePlanExercise(id: string, changes: PlanExerciseUpdate): Promise<void> {
  ensureAffected(await supabase.from('plan_exercise').update(changes).eq('id', id).select('id'))
}

/** Plan rows are templates: logged sets point at the exercise, so removing one is always safe. */
export async function removePlanExercise(id: string): Promise<void> {
  ensureOk(await supabase.from('plan_exercise').delete().eq('id', id))
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
  ensureOk(await supabase.from('plan_exercise').upsert(rows, { onConflict: 'id' }))
}

const COPY_SUFFIX = ' (copia)'

async function insertRows(table: 'plan_session' | 'plan_exercise' | 'warmup_item', rows: object[]): Promise<void> {
  if (rows.length > 0) ensureOk(await supabase.from(table).insert(rows))
}

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
  await insertRows(
    'plan_exercise',
    sessions.flatMap(({ from, id }) =>
      from.exercises.map(({ exercise_id, position, target_sets, target_reps, target_unit, suggested_weight_kg, suggested_weight_max_kg }) => ({
        session_id: id,
        exercise_id,
        position,
        target_sets,
        target_reps,
        target_unit,
        suggested_weight_kg,
        suggested_weight_max_kg,
      })),
    ),
  )
  await insertRows(
    'warmup_item',
    sessions.flatMap(({ from, id }) =>
      from.warmup.map(({ position, name, reps_text, note }) => ({ session_id: id, position, name, reps_text, note })),
    ),
  )
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
  const copy = unwrap<Plan>(await supabase.from('plan').insert({ name }).select().single())
  try {
    await copyContents(source, copy.id)
    return copy
  } catch (failure) {
    // sessions, exercises and warm-ups of the copy go with it (on delete cascade).
    const cleanup = await supabase.from('plan').delete().eq('id', copy.id)
    if (cleanup.error) {
      throw new DataError(`Duplication failed and the partial copy "${name}" could not be removed`, 'partial_copy', {
        cause: failure,
      })
    }
    throw failure
  }
}
