import { describe, expect, it } from 'vitest'
import { countLabel, groupPlans, planDetail } from './planList'

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
