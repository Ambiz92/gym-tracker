import { describe, expect, it } from 'vitest'
import { countLabel, groupPlans, planCounts, planDetail, planListSignature } from './planList'

const plan = (name: string, is_active = false, archived = false) => ({ name, is_active, archived })

describe('groupPlans', () => {
  it('separates the active plan, the others and the archived ones, keeping the order', () => {
    const grouped = groupPlans([plan('A'), plan('B', true), plan('C', false, true), plan('D')])
    expect(grouped.active?.name).toBe('B')
    expect(grouped.others.map((p) => p.name)).toEqual(['A', 'D'])
    expect(grouped.archived.map((p) => p.name)).toEqual(['C'])
  })

  it('has no active plan when none is flagged (after archiving it or a failed switch)', () => {
    expect(groupPlans([plan('A'), plan('B')]).active).toBeNull()
    expect(groupPlans([]).others).toEqual([])
  })
})

describe('labels', () => {
  it('uses the singular only for one', () => {
    expect(countLabel(1, 'sessione', 'sessioni')).toBe('1 sessione')
    expect(countLabel(0, 'sessione', 'sessioni')).toBe('0 sessioni')
    expect(countLabel(2, 'sessione', 'sessioni')).toBe('2 sessioni')
  })

  it('describes a plan by its counts', () => {
    expect(planDetail({ sessionCount: 3, exerciseCount: 19 })).toBe('3 sessioni · 19 esercizi')
    expect(planDetail({ sessionCount: 1, exerciseCount: 1 })).toBe('1 sessione · 1 esercizio')
  })
})

describe('planCounts', () => {
  it('counts sessions and the exercises across them', () => {
    expect(planCounts({ sessions: [{ exercises: [{}, {}] }, { exercises: [{}] }, { exercises: [] }] })).toEqual({
      sessionCount: 3,
      exerciseCount: 3,
    })
    expect(planCounts({ sessions: [] })).toEqual({ sessionCount: 0, exerciseCount: 0 })
  })
})

describe('planListSignature', () => {
  const listed = (name: string, sessions: { exercises: unknown[] }[], overrides = {}) => ({ ...plan(name), sessions, ...overrides })
  const base = listed('Forza', [{ exercises: [{}, {}] }, { exercises: [{}] }])

  it('stays the same for edits the list does not show', () => {
    const reorderedSessions = listed('Forza', [{ exercises: [{}] }, { exercises: [{}, {}] }])
    expect(planListSignature(reorderedSessions)).toBe(planListSignature(base))
  })

  it('changes with the name, the status and the session and exercise counts', () => {
    const signature = planListSignature(base)
    expect(planListSignature(listed('Altro', base.sessions))).not.toBe(signature)
    expect(planListSignature(listed('Forza', base.sessions, { is_active: true }))).not.toBe(signature)
    expect(planListSignature(listed('Forza', base.sessions, { archived: true }))).not.toBe(signature)
    expect(planListSignature(listed('Forza', [...base.sessions, { exercises: [] }]))).not.toBe(signature)
    expect(planListSignature(listed('Forza', [{ exercises: [{}, {}] }, { exercises: [] }]))).not.toBe(signature)
  })
})
