import { describe, expect, it } from 'vitest'
import { flowReducer, initialFlow, repsStep, resolveValues, type FlowAction, type FlowState } from './setFlow'

const start = initialFlow({ weight: 15, reps: 10, equipment: 'barbell' })
const run = (state: FlowState, ...actions: FlowAction[]): FlowState => actions.reduce(flowReducer, state)

describe('stepping', () => {
  it('moves the weight by the given step', () => {
    expect(run(start, { type: 'step', field: 'weight', delta: 2.5 }).values.weight).toBe(17.5)
    expect(run(start, { type: 'step', field: 'weight', delta: -2.5 }).values.weight).toBe(12.5)
  })

  it('does not accumulate floating point noise', () => {
    const state = run(initialFlow({ weight: 0, reps: 8, equipment: 'dumbbell' }), ...Array.from({ length: 3 }, () => ({ type: 'step', field: 'weight', delta: 0.1 }) as const))
    expect(state.values.weight).toBe(0.3)
  })

  it('never goes below zero kg or one rep', () => {
    expect(run(initialFlow({ weight: 1, reps: 1, equipment: 'other' }), { type: 'step', field: 'weight', delta: -2.5 }, { type: 'step', field: 'reps', delta: -1 }).values).toMatchObject({ weight: 0, reps: 1 })
  })

  it('uses bigger steps for seconds and meters', () => {
    expect(repsStep('reps')).toBe(1)
    expect(repsStep('seconds')).toBe(5)
    expect(repsStep('meters')).toBe(5)
  })

  it('drops a number being typed', () => {
    const state = run(start, { type: 'edit-start', field: 'weight' }, { type: 'step', field: 'reps', delta: 1 })
    expect(state.editing).toBeNull()
  })
})

describe('setting a number directly', () => {
  it('replaces the value and drops a number being typed', () => {
    const typing = run(start, { type: 'edit-start', field: 'weight' })
    const state = run(typing, { type: 'set', field: 'weight', value: 25 })
    expect(state).toMatchObject({ values: { weight: 25, reps: 10 }, editing: null, error: null })
  })

  it('keeps the same limits as stepping', () => {
    expect(run(start, { type: 'set', field: 'weight', value: -5 }).values.weight).toBe(0)
    expect(run(start, { type: 'set', field: 'weight', value: 5000 }).values.weight).toBe(1000)
    expect(run(start, { type: 'set', field: 'reps', value: 0 }).values.reps).toBe(1)
    expect(run(start, { type: 'set', field: 'reps', value: 5000 }).values.reps).toBe(999)
  })

  it('keeps the current value when given something that is not a number', () => {
    expect(run(start, { type: 'set', field: 'weight', value: NaN }).values.weight).toBe(15)
    expect(run(start, { type: 'step', field: 'reps', delta: NaN }).values.reps).toBe(10)
  })

  it('does not accumulate floating point noise', () => {
    expect(run(start, { type: 'set', field: 'weight', value: 0.1 + 0.2 }).values.weight).toBe(0.3)
  })
})

describe('typing a number', () => {
  it('starts from the current value written with a comma', () => {
    const state = run(initialFlow({ weight: 12.5, reps: 8, equipment: 'barbell' }), { type: 'edit-start', field: 'weight' })
    expect(state.editing).toEqual({ field: 'weight', text: '12,5' })
  })

  it.each([
    ['22,5', 22.5],
    ['22.5', 22.5],
    [' 30 ', 30],
    ['12,555', 12.56],
    ['0', 0],
  ])('accepts %s as a weight', (text, expected) => {
    const state = run(start, { type: 'edit-start', field: 'weight' }, { type: 'edit-text', text }, { type: 'edit-commit' })
    expect(state).toMatchObject({ values: { weight: expected }, editing: null, error: null })
  })

  it.each(['', 'abc', '-5', '1e3', '1.000,5', '2000'])('rejects %j as a weight and keeps the field open', (text) => {
    const state = run(start, { type: 'edit-start', field: 'weight' }, { type: 'edit-text', text }, { type: 'edit-commit' })
    expect(state.values.weight).toBe(15)
    expect(state.editing).not.toBeNull()
    expect(state.error).toMatch(/peso/)
  })

  it('accepts whole reps only, at least one', () => {
    const commit = (text: string) => run(start, { type: 'edit-start', field: 'reps' }, { type: 'edit-text', text }, { type: 'edit-commit' })
    expect(commit('12').values.reps).toBe(12)
    for (const bad of ['0', '8,5', 'x', '']) expect(commit(bad).error).toMatch(/intero/)
  })

  it('clears the error while the text changes', () => {
    const failed = run(start, { type: 'edit-start', field: 'reps' }, { type: 'edit-text', text: 'x' }, { type: 'edit-commit' })
    expect(flowReducer(failed, { type: 'edit-text', text: '8' }).error).toBeNull()
  })

  it('ignores text and commit when nothing is being edited', () => {
    expect(run(start, { type: 'edit-text', text: '9' }, { type: 'edit-commit' })).toEqual(start)
  })
})

describe('resolveValues', () => {
  it('returns the stepped values as they are', () => {
    expect(resolveValues(start)).toEqual({ values: start.values })
  })

  it('applies a number still being typed, so a tap on confirm needs no blur first', () => {
    const state = run(start, { type: 'edit-start', field: 'reps' }, { type: 'edit-text', text: '6' })
    expect(resolveValues(state)).toEqual({ values: { weight: 15, reps: 6, equipment: 'barbell' } })
  })

  it('reports invalid typed text instead of confirming', () => {
    const state = run(start, { type: 'edit-start', field: 'weight' }, { type: 'edit-text', text: 'pesante' })
    expect(resolveValues(state)).toMatchObject({ error: expect.stringMatching(/peso/) })
  })
})

it('changes the equipment without touching the numbers', () => {
  expect(run(start, { type: 'equipment', equipment: 'dumbbell' }).values).toEqual({ weight: 15, reps: 10, equipment: 'dumbbell' })
})
