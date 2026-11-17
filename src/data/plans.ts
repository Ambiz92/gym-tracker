import type {
  Plan,
  PlanExercise,
  PlanExerciseInsert,
  PlanExerciseUpdate,
  PlanSession,
  PlanSessionInsert,
  PlanSessionUpdate,
} from '../types/db'
import { DataError, ensureOk, inUseError, isReferenced, supabase, unwrap } from './client'

export type NewSession = Omit<PlanSessionInsert, 'id' | 'plan_id' | 'position'>
export type NewPlanExercise = Omit<PlanExerciseInsert, 'id' | 'session_id' | 'position'>

/** All plans, archived included (the caller filters), by name. */
export async function listPlans(): Promise<Plan[]> {
  return unwrap<Plan[]>(await supabase.from('plan').select().order('name'))
}

export async function createPlan(name: string): Promise<Plan> {
  return unwrap<Plan>(await supabase.from('plan').insert({ name }).select().single())
}

export async function renamePlan(id: string, name: string): Promise<void> {
  ensureOk(await supabase.from('plan').update({ name }).eq('id', id))
}

/** Archived plans cannot be active (check constraint), so both flags change together. */
export async function archivePlan(id: string): Promise<void> {
  ensureOk(await supabase.from('plan').update({ archived: true, is_active: false }).eq('id', id))
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
 */
export async function setActivePlan(planId: string): Promise<void> {
  const deactivated = unwrap<{ id: string }[]>(
    await supabase.from('plan').update({ is_active: false }).eq('is_active', true).neq('id', planId).select('id'),
  )
  const activation = await supabase.from('plan').update({ is_active: true }).eq('id', planId)
  if (!activation.error) return

  if (deactivated.length > 0) {
    const restore = await supabase
      .from('plan')
      .update({ is_active: true })
      .in('id', deactivated.map((p) => p.id))
    if (restore.error) {
      throw new DataError(
        `${activation.error.message} (and the previous plan could not be reactivated: no plan is active)`,
        activation.error.code,
        { cause: restore.error },
      )
    }
  }
  ensureOk(activation)
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
  ensureOk(await supabase.from('plan_session').update(changes).eq('id', id))
}

/** Removes a session that was never logged; refuses with an `in_use` DataError otherwise. */
export async function removeSession(id: string): Promise<void> {
  if (await isReferenced('workout', 'session_id', [id])) throw inUseError('The session')
  ensureOk(await supabase.from('plan_session').delete().eq('id', id))
}

/**
 * Rewrites positions 0..n-1 following the order of `sessions` in one upsert keyed on id.
 * Positions are deferrable unique, so swaps are valid; the payload carries every not-null column.
 */
export async function reorderSessions(sessions: PlanSession[]): Promise<void> {
  const rows = sessions.map(({ id, plan_id, name, subtitle, is_optional }, position) => ({
    id,
    plan_id,
    name,
    subtitle,
    is_optional,
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
  ensureOk(await supabase.from('plan_exercise').update(changes).eq('id', id))
}

/** Plan rows are templates: logged sets point at the exercise, so removing one is always safe. */
export async function removePlanExercise(id: string): Promise<void> {
  ensureOk(await supabase.from('plan_exercise').delete().eq('id', id))
}

/** Same single-upsert reorder as `reorderSessions`, for the exercises of one session. */
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
