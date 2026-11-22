import type { Exercise } from '../types/db'
import { own, unwrap } from './client'

/** Archived exercises, by name: the library lists them after the active ones so they can be restored. */
export async function listArchivedExercises(): Promise<Exercise[]> {
  return unwrap<Exercise[]>(await (await own('exercise')).select().eq('archived', true).order('name'))
}
