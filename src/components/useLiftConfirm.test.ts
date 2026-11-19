import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetValues } from '../lib/setFlow'
import { LIFT_MS, createLiftConfirm } from './useLiftConfirm'

const values: SetValues = { weight: 62.5, reps: 8, equipment: 'barbell' }

function setup(reducedMotion = false) {
  const confirm = vi.fn()
  const setLifting = vi.fn()
  return { confirm, setLifting, lift: createLiftConfirm({ confirm, setLifting, reducedMotion: () => reducedMotion }) }
}

describe('createLiftConfirm', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('lifts first and confirms when the animation is over', () => {
    const { confirm, setLifting, lift } = setup()
    lift.start(values)
    expect(setLifting).toHaveBeenLastCalledWith(true)
    expect(confirm).not.toHaveBeenCalled()

    vi.advanceTimersByTime(LIFT_MS)
    expect(confirm).toHaveBeenCalledExactlyOnceWith(values)
    expect(setLifting).toHaveBeenLastCalledWith(false)
  })

  it('confirms at once with reduced motion', () => {
    const { confirm, setLifting, lift } = setup(true)
    lift.start(values)
    expect(confirm).toHaveBeenCalledExactlyOnceWith(values)
    expect(setLifting).not.toHaveBeenCalled()
  })

  it('ignores a second tap while lifting, so a set is never saved twice', () => {
    const { confirm, lift } = setup()
    lift.start(values)
    lift.start({ ...values, reps: 9 })
    vi.advanceTimersByTime(LIFT_MS * 2)
    expect(confirm).toHaveBeenCalledExactlyOnceWith(values)
  })

  it('confirms the pending set when the screen is left mid-lift, and never twice', () => {
    const { confirm, lift } = setup()
    lift.start(values)
    lift.settle()
    expect(confirm).toHaveBeenCalledExactlyOnceWith(values)
    vi.advanceTimersByTime(LIFT_MS * 2)
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('does nothing on settle without a pending set', () => {
    const { confirm, lift } = setup()
    lift.settle()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('can lift again after a set settled', () => {
    const { confirm, lift } = setup()
    lift.start(values)
    vi.advanceTimersByTime(LIFT_MS)
    lift.start({ ...values, reps: 7 })
    vi.advanceTimersByTime(LIFT_MS)
    expect(confirm).toHaveBeenCalledTimes(2)
  })
})
