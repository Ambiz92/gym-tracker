import type { Exercise, ExerciseInsert, ExerciseUpdate } from '../types/db'
import { DataError, ensureAffected, ensureOk, inUseError, isReferenced, own, unwrap } from './client'
import { readAllRows } from './paging'

/** Exercises of the library that are not archived, by name. */
export async function listExercises(): Promise<Exercise[]> {
  return unwrap<Exercise[]>(await (await own('exercise')).select().eq('archived', false).order('name'))
}

/**
 * How many plans use each exercise, counting live sessions of non-archived plans only; exercises
 * used by none are absent. One query: the embedded session and plan are filtered in the database.
 */
export async function listExerciseUsage(): Promise<Map<string, number>> {
  const rows = await readAllRows<{ exercise_id: string; plan_session: { plan_id: string } }>(async (from, to) =>
    (await own('plan_exercise'))
      .select('exercise_id, plan_session!inner(plan_id, plan!inner(archived))')
      .eq('plan_session.archived', false)
      .eq('plan_session.plan.archived', false)
      .order('id')
      .range(from, to),
  )
  const plansByExercise = new Map<string, Set<string>>()
  for (const { exercise_id, plan_session } of rows) {
    const plans = plansByExercise.get(exercise_id) ?? new Set<string>()
    plansByExercise.set(exercise_id, plans.add(plan_session.plan_id))
  }
  return new Map([...plansByExercise].map(([exerciseId, plans]) => [exerciseId, plans.size]))
}

export async function createExercise(exercise: ExerciseInsert): Promise<Exercise> {
  return unwrap<Exercise>(await (await own('exercise')).insert(exercise).select().single())
}

export async function updateExercise(id: string, changes: ExerciseUpdate): Promise<Exercise> {
  return unwrap<Exercise>(await (await own('exercise')).update(changes).eq('id', id).select().single())
}

/** Hides the exercise from the library; logged history keeps pointing at it. */
export async function archiveExercise(id: string): Promise<void> {
  ensureAffected(await (await own('exercise')).update({ archived: true }).eq('id', id).select('id'))
}

const FOREIGN_KEY_VIOLATION = '23503'

/**
 * Deletes an exercise that was never logged nor used by a plan; refuses with an `in_use`
 * DataError otherwise (plan references are only caught by the foreign key).
 */
export async function deleteExercise(id: string): Promise<void> {
  if (await isReferenced('set_log', 'exercise_id', [id])) throw inUseError('The exercise')
  try {
    ensureOk(await (await own('exercise')).delete().eq('id', id))
  } catch (error) {
    if (error instanceof DataError && error.code === FOREIGN_KEY_VIOLATION) throw inUseError('The exercise')
    throw error
  }
}

/** Catalog entries the user has a copy of, archived copies included (a second copy would be refused). */
export async function listAdoptedCatalogIds(): Promise<Set<string>> {
  const rows = await readAllRows<Pick<Exercise, 'catalog_id'>>(async (from, to) =>
    (await own('exercise')).select('catalog_id').order('id').range(from, to),
  )
  return new Set(rows.flatMap(({ catalog_id }) => (catalog_id === null ? [] : [catalog_id])))
}
