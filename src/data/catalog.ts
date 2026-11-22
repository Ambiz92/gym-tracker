import { exerciseFromCatalog } from '../lib/exerciseList'
import type { CatalogExercise, Exercise } from '../types/db'
import { DataError, own, supabase, unwrap } from './client'
import { createExercise, updateExercise } from './exercises'
import { readAllRows } from './paging'

const UNIQUE_VIOLATION = '23505'

/** The shared catalog by Italian name (`id` breaks ties so pages never overlap). */
export function listCatalog(): Promise<CatalogExercise[]> {
  return readAllRows((from, to) =>
    supabase.from('exercise_catalog').select().order('name_it').order('id').range(from, to),
  )
}

/**
 * Copies a catalog entry into the user's exercises. A copy already there (the unique index on
 * owner and catalog entry) is returned instead, restored if archived: same row, so history stays.
 */
export async function adoptCatalogExercise(entry: CatalogExercise): Promise<Exercise> {
  try {
    return await createExercise(exerciseFromCatalog(entry))
  } catch (error) {
    if (!(error instanceof DataError) || error.code !== UNIQUE_VIOLATION) throw error
  }
  const existing = unwrap<Exercise>(await (await own('exercise')).select().eq('catalog_id', entry.id).single())
  return existing.archived ? updateExercise(existing.id, { archived: false }) : existing
}
