import { describe, expect, test } from 'vitest'
import type { ExportTables } from '../../data/export'
import { buildCsvFiles, buildJsonFile, CSV_COLUMNS, TABLE_NAMES } from './exportFiles'

const NOW = new Date(2026, 10, 17, 9, 30)
const owner = { owner_id: 'u1' }

// One fully typed row per table: adding a column to a row type breaks this file until CSV_COLUMNS follows.
const sample: ExportTables = {
  exercise: [
    { id: 'e1', ...owner, name: 'Rematore, bilanciere', equipment: 'barbell', muscles: null, execution_steps: null, notes: '=HYPERLINK("x")', starting_weight_kg: 25, archived: true },
  ],
  plan: [{ id: 'p1', ...owner, name: 'Forza', is_active: true, archived: false }],
  plan_session: [{ id: 's1', ...owner, plan_id: 'p1', name: 'A', subtitle: null, position: 1, is_optional: false, archived: false }],
  plan_exercise: [
    { id: 'pe1', ...owner, session_id: 's1', exercise_id: 'e1', position: 1, target_sets: 3, target_reps: 8, target_unit: 'reps', suggested_weight_kg: 25, suggested_weight_max_kg: null },
  ],
  warmup_item: [{ id: 'wu1', ...owner, session_id: 's1', position: 1, name: 'Cerchi', reps_text: '10', note: null }],
  workout: [{ id: 'w1', ...owner, date: '2026-11-17', created_at: '2026-11-17T08:00:00Z', session_id: 's1', session_name: 'A', notes: null }],
  set_log: [{ id: 'l1', ...owner, workout_id: 'w1', exercise_id: 'e1', set_number: 1, reps: 8, weight_kg: 27.5, equipment_used: 'barbell', rpe: null }],
}

describe('buildCsvFiles', () => {
  const files = buildCsvFiles(sample, NOW)

  test('makes one dated CSV per table, in table order', () => {
    expect(files.map((file) => file.name)).toEqual(TABLE_NAMES.map((table) => `gym-tracker-${table}-2026-11-17.csv`))
    expect(files.every((file) => file.mime.startsWith('text/csv'))).toBe(true)
  })

  test.each(TABLE_NAMES)('the %s header lists every column of the row type', (table) => {
    const [header] = files[TABLE_NAMES.indexOf(table)]!.content.split('\r\n')
    expect(header!.split(',')).toEqual(Object.keys(sample[table][0]!))
    expect(CSV_COLUMNS[table]).toEqual(Object.keys(sample[table][0]!))
  })

  test('quotes commas, neutralizes formulas and keeps archived rows', () => {
    const exercise = files[0]!
    expect(exercise.rowCount).toBe(1)
    const [, row] = exercise.content.split('\r\n')
    expect(row).toBe('e1,u1,"Rematore, bilanciere",barbell,,,"\'=HYPERLINK(""x"")",25,true')
  })

  test('an empty table still has its header', () => {
    const empty = { ...sample, plan: [] }
    const plan = buildCsvFiles(empty, NOW)[1]!
    expect(plan.content).toBe('id,owner_id,name,is_active,archived')
    expect(plan.rowCount).toBe(0)
  })
})

describe('buildJsonFile', () => {
  test('puts all tables in one dated document', () => {
    const file = buildJsonFile(sample, NOW)
    expect(file.name).toBe('gym-tracker-all-2026-11-17.json')
    expect(file.mime).toBe('application/json')
    expect(file.rowCount).toBe(TABLE_NAMES.length)
    const parsed = JSON.parse(file.content) as Record<string, unknown[]>
    expect(Object.keys(parsed).sort()).toEqual([...TABLE_NAMES].sort())
    expect(parsed.set_log).toEqual(sample.set_log)
  })
})
