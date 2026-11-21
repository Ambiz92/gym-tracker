import type { Exercise, Plan, PlanExercise, PlanSession, ScheduledSession, SetLog, TableName, WarmupItem, Workout } from '../types/db'
import { own } from './client'
import { readAllRows } from './paging'

export interface TableRows {
  exercise: Exercise
  plan: Plan
  plan_session: PlanSession
  plan_exercise: PlanExercise
  warmup_item: WarmupItem
  workout: Workout
  set_log: SetLog
  scheduled_session: ScheduledSession
}

export type ExportTables = { [Table in TableName]: TableRows[Table][] }

// `id` is unique, so the page boundaries never overlap or skip rows.
async function readTable<Table extends TableName>(table: Table): Promise<TableRows[Table][]> {
  return readAllRows(async (from, to) => (await own(table)).select().order('id').range(from, to))
}

/** Every row of every table, archived ones included, read page by page so nothing is cut at 1000. */
export async function fetchAllTables(): Promise<ExportTables> {
  const [exercise, plan, plan_session, plan_exercise, warmup_item, workout, set_log, scheduled_session] = await Promise.all([
    readTable('exercise'),
    readTable('plan'),
    readTable('plan_session'),
    readTable('plan_exercise'),
    readTable('warmup_item'),
    readTable('workout'),
    readTable('set_log'),
    readTable('scheduled_session'),
  ])
  return { exercise, plan, plan_session, plan_exercise, warmup_item, workout, set_log, scheduled_session }
}
