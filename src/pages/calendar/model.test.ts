import { expect, test } from 'vitest'
import type { SlotState, SlotView } from '../../lib/scheduleStatus'
import {
  dayAriaLabel,
  gridWeeks,
  isArchived,
  keyTarget,
  periodLabel,
  shiftPeriod,
  slotActions,
  stateLabel,
  visibleRange,
} from './model'

function view(state: SlotState, date = '2026-11-27', startable = true): SlotView {
  return { slot: { id: 'x', date, status: 'planned', plan_session_id: 's1' }, state, startable }
}

test('gridWeeks is the month grid or the single week of the selected day', () => {
  expect(gridWeeks('month', '2026-11-18')).toHaveLength(6)
  expect(gridWeeks('week', '2026-11-18')).toEqual([
    ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'],
  ])
})

test('visibleRange spans the padding days of the grid', () => {
  expect(visibleRange(gridWeeks('month', '2026-11-18'))).toEqual({ from: '2026-10-26', to: '2026-12-06' })
  expect(visibleRange(gridWeeks('week', '2026-11-18'))).toEqual({ from: '2026-11-16', to: '2026-11-22' })
})

test('periodLabel names the month or the week range', () => {
  expect(periodLabel('month', '2026-11-18')).toBe('novembre 2026')
  expect(periodLabel('week', '2026-11-18')).toBe('16 nov – 22 nov')
})

test('shiftPeriod moves by month or by week and lands on today when the period holds it', () => {
  expect(shiftPeriod('month', '2026-11-18', 1, '2026-11-21')).toBe('2026-12-01')
  expect(shiftPeriod('month', '2026-12-01', -1, '2026-11-21')).toBe('2026-11-21')
  expect(shiftPeriod('month', '2026-01-15', -1, '2026-11-21')).toBe('2025-12-01')
  expect(shiftPeriod('week', '2026-11-18', 1, '2026-11-21')).toBe('2026-11-25')
  expect(shiftPeriod('week', '2026-11-25', -1, '2026-11-21')).toBe('2026-11-21')
})

test('shiftPeriod does not pick the today of a neighbouring month shown only as padding', () => {
  expect(shiftPeriod('month', '2026-11-05', 1, '2026-11-30')).toBe('2026-12-01')
})

test('keyTarget moves a day sideways and a week vertically, and ignores other keys', () => {
  expect(keyTarget('2026-11-30', 'ArrowRight')).toBe('2026-12-01')
  expect(keyTarget('2026-12-01', 'ArrowLeft')).toBe('2026-11-30')
  expect(keyTarget('2026-11-27', 'ArrowDown')).toBe('2026-12-04')
  expect(keyTarget('2026-11-27', 'ArrowUp')).toBe('2026-11-20')
  expect(keyTarget('2026-11-27', 'Enter')).toBeNull()
})

test('keyTarget moves a month with Page Up/Down, keeping the day or clamping it to the shorter month', () => {
  expect(keyTarget('2026-11-27', 'PageDown')).toBe('2026-12-27')
  expect(keyTarget('2026-11-27', 'PageUp')).toBe('2026-10-27')
  expect(keyTarget('2026-12-31', 'PageUp')).toBe('2026-11-30')
  expect(keyTarget('2026-01-31', 'PageDown')).toBe('2026-02-28')
  expect(keyTarget('2028-01-31', 'PageDown')).toBe('2028-02-29')
  expect(keyTarget('2026-12-15', 'PageDown')).toBe('2027-01-15')
})

test('keyTarget goes to the Monday with Home and the Sunday with End of the same week', () => {
  expect(keyTarget('2026-11-25', 'Home')).toBe('2026-11-23')
  expect(keyTarget('2026-11-25', 'End')).toBe('2026-11-29')
  expect(keyTarget('2026-11-23', 'Home')).toBe('2026-11-23')
  expect(keyTarget('2026-11-29', 'End')).toBe('2026-11-29')
  expect(keyTarget('2026-12-01', 'Home')).toBe('2026-11-30')
})

test('stateLabel uses the product wording', () => {
  expect(stateLabel('to_recover')).toBe('da recuperare')
  expect(stateLabel('done')).toBe('fatta')
  expect(stateLabel('skipped')).toBe('saltata')
  expect(stateLabel('upcoming')).toBe('in programma')
})

test('isArchived flags only a to-do slot that cannot be started', () => {
  expect(isArchived(view('upcoming', '2026-11-27', false))).toBe(true)
  expect(isArchived(view('to_recover', '2026-11-20', false))).toBe(true)
  expect(isArchived(view('upcoming'))).toBe(false)
  expect(isArchived(view('done', '2026-11-20', false))).toBe(false)
  expect(isArchived(view('skipped', '2026-11-20', false))).toBe(false)
})

test('dayAriaLabel spells out the day, the count and the state', () => {
  expect(dayAriaLabel('2026-11-26')).toBe('giovedì 26 novembre, nessuna sessione')
  expect(dayAriaLabel('2026-11-26', [view('done')])).toBe('giovedì 26 novembre, 1 sessione, fatta')
  expect(dayAriaLabel('2026-11-26', [view('to_recover')])).toBe('giovedì 26 novembre, 1 sessione, da recuperare')
})

test('dayAriaLabel counts each state when a day has several sessions', () => {
  expect(dayAriaLabel('2026-11-26', [view('done'), view('upcoming'), view('done')])).toBe(
    'giovedì 26 novembre, 3 sessioni: 1 in programma, 2 fatte',
  )
  expect(dayAriaLabel('2026-11-26', [view('skipped'), view('to_recover')])).toBe(
    'giovedì 26 novembre, 2 sessioni: 1 da recuperare, 1 saltata',
  )
})

test('slotActions: done and skipped are history with no action', () => {
  const none = { move: false, skip: false, remove: false }
  expect(slotActions(view('done'), '2026-11-21')).toEqual(none)
  expect(slotActions(view('skipped'), '2026-11-21')).toEqual(none)
})

test('slotActions: an overdue slot is moved or skipped, never deleted', () => {
  expect(slotActions(view('to_recover', '2026-11-18'), '2026-11-21')).toEqual({ move: true, skip: true, remove: false })
})

test('slotActions: a slot to come can be deleted, and moved unless it is already today', () => {
  expect(slotActions(view('upcoming', '2026-11-27'), '2026-11-21')).toEqual({ move: true, skip: true, remove: true })
  expect(slotActions(view('upcoming', '2026-11-21'), '2026-11-21')).toEqual({ move: false, skip: true, remove: true })
})
