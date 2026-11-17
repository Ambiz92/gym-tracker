import { describe, expect, it } from 'vitest'
import { nextSessionId, type PlannedSession } from './nextSession'

const plan: PlannedSession[] = [
  { id: 'a', is_optional: false },
  { id: 'b', is_optional: false },
  { id: 'c', is_optional: true },
]
const dates = (entries: Record<string, string>) => new Map(Object.entries(entries))

describe('nextSessionId', () => {
  it('starts with the first regular session when nothing was done', () => {
    expect(nextSessionId(plan, dates({}))).toBe('a')
  })

  it('takes the session after the latest one done', () => {
    expect(nextSessionId(plan, dates({ a: '2026-11-13' }))).toBe('b')
  })

  it('skips the bonus session and wraps around', () => {
    expect(nextSessionId(plan, dates({ a: '2026-11-10', b: '2026-11-13' }))).toBe('a')
  })

  it('goes on after a bonus session was the latest', () => {
    expect(nextSessionId(plan, dates({ a: '2026-11-10', b: '2026-11-11', c: '2026-11-14' }))).toBe('a')
  })

  it('judges by date, not by plan order', () => {
    expect(nextSessionId(plan, dates({ a: '2026-11-14', b: '2026-11-10' }))).toBe('b')
  })

  it('repeats the only session of the plan', () => {
    expect(nextSessionId([{ id: 'a', is_optional: false }], dates({ a: '2026-11-14' }))).toBe('a')
  })

  it('falls back to bonus sessions when every session is bonus', () => {
    const bonus = plan.map((session) => ({ ...session, is_optional: true }))
    expect(nextSessionId(bonus, dates({}))).toBe('a')
    expect(nextSessionId(bonus, dates({ a: '2026-11-14' }))).toBe('b')
  })

  it('has no answer for an empty plan', () => {
    expect(nextSessionId([], dates({}))).toBeNull()
  })
})
