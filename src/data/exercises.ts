import type { Exercise, ExerciseInsert, ExerciseUpdate } from '../types/db'
import { DataError, ensureAffected, ensureOk, inUseError, isReferenced, supabase, unwrap } from './client'

/** Exercises of the library that are not archived, by name. */
export async function listExercises(): Promise<Exercise[]> {
  return unwrap<Exercise[]>(await supabase.from('exercise').select().eq('archived', false).order('name'))
}

export async function createExercise(exercise: ExerciseInsert): Promise<Exercise> {
  return unwrap<Exercise>(await supabase.from('exercise').insert(exercise).select().single())
}

export async function updateExercise(id: string, changes: ExerciseUpdate): Promise<Exercise> {
  return unwrap<Exercise>(await supabase.from('exercise').update(changes).eq('id', id).select().single())
}

/** Hides the exercise from the library; logged history keeps pointing at it. */
export async function archiveExercise(id: string): Promise<void> {
  ensureAffected(await supabase.from('exercise').update({ archived: true }).eq('id', id).select('id'))
}

const FOREIGN_KEY_VIOLATION = '23503'

/**
 * Deletes an exercise that was never logged nor used by a plan; refuses with an `in_use`
 * DataError otherwise (plan references are only caught by the foreign key).
 */
export async function deleteExercise(id: string): Promise<void> {
  if (await isReferenced('set_log', 'exercise_id', [id])) throw inUseError('The exercise')
  try {
    ensureOk(await supabase.from('exercise').delete().eq('id', id))
  } catch (error) {
    if (error instanceof DataError && error.code === FOREIGN_KEY_VIOLATION) throw inUseError('The exercise')
    throw error
  }
}
