import type { ExportedTable, ExportTables, TableRows } from '../../data/export'
import { exportFileName, toCsv, toJson } from '../../lib/exportData'

export interface ExportFile {
  name: string
  content: string
  mime: string
  rowCount: number
}

export const TABLE_NAMES: readonly ExportedTable[] = [
  'exercise',
  'plan',
  'plan_session',
  'plan_exercise',
  'warmup_item',
  'workout',
  'set_log',
]

type Columns = { [Table in ExportedTable]: readonly (keyof TableRows[Table] & string)[] }

// Explicit so the header order is stable and an empty table still gets its header.
export const CSV_COLUMNS: Columns = {
  exercise: ['id', 'owner_id', 'name', 'equipment', 'muscles', 'execution_steps', 'notes', 'starting_weight_kg', 'archived', 'catalog_id'],
  plan: ['id', 'owner_id', 'name', 'is_active', 'archived'],
  plan_session: ['id', 'owner_id', 'plan_id', 'name', 'subtitle', 'position', 'is_optional', 'archived'],
  plan_exercise: [
    'id',
    'owner_id',
    'session_id',
    'exercise_id',
    'position',
    'target_sets',
    'target_reps',
    'target_unit',
    'suggested_weight_kg',
    'suggested_weight_max_kg',
  ],
  warmup_item: ['id', 'owner_id', 'session_id', 'position', 'name', 'reps_text', 'note'],
  workout: ['id', 'owner_id', 'date', 'created_at', 'session_id', 'session_name', 'notes'],
  set_log: ['id', 'owner_id', 'workout_id', 'exercise_id', 'set_number', 'reps', 'weight_kg', 'equipment_used', 'rpe'],
}

function csvFile<Table extends ExportedTable>(table: Table, tables: ExportTables, now: Date): ExportFile {
  const rows = tables[table]
  return {
    name: exportFileName(table, 'csv', now),
    content: toCsv(rows, CSV_COLUMNS[table]),
    mime: 'text/csv;charset=utf-8',
    rowCount: rows.length,
  }
}

/** One CSV per table, in table order. */
export function buildCsvFiles(tables: ExportTables, now: Date): ExportFile[] {
  return TABLE_NAMES.map((table) => csvFile(table, tables, now))
}

/** All tables in a single JSON document. */
export function buildJsonFile(tables: ExportTables, now: Date): ExportFile {
  return {
    name: exportFileName('all', 'json', now),
    content: toJson(tables),
    mime: 'application/json',
    rowCount: TABLE_NAMES.reduce((total, table) => total + tables[table].length, 0),
  }
}
