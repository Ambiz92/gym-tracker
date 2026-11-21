import { expect, test } from 'vitest'
import { DataError } from '../../data/client'
import { describeScheduleError } from './errors'

test('maps each schedule code to its own Italian message', () => {
  const messages = ['already_scheduled', 'not_planned', 'not_deletable', 'already_done', 'past_date'].map((code) =>
    describeScheduleError(new DataError('x', code), 'fallback'),
  )
  expect(new Set(messages).size).toBe(5)
  expect(messages).not.toContain('fallback')
  expect(messages[0]).toContain('già in programma')
})

test('falls back for other failures, DataError or not', () => {
  expect(describeScheduleError(new DataError('boom', 'XX000'), 'Non riesco a salvare.')).toBe('Non riesco a salvare.')
  expect(describeScheduleError(new Error('boom'), 'Non riesco a salvare.')).toBe('Non riesco a salvare.')
})
