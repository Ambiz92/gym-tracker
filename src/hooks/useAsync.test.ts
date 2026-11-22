import { expect, test } from 'vitest'
import { type AsyncState, startState } from './useAsync'

const ready: AsyncState<number> = { status: 'ready', data: 1 }
const failed: AsyncState<number> = { status: 'error', error: new Error('boom') }

test('a reload keeps the data when the hook asked for it', () => {
  expect(startState(ready, true, true)).toBe(ready)
})

test('goes back to loading otherwise: default hooks, a change of deps, nothing to keep', () => {
  expect(startState(ready, true, false)).toEqual({ status: 'loading' })
  expect(startState(ready, false, true)).toEqual({ status: 'loading' })
  expect(startState(failed, true, true)).toEqual({ status: 'loading' })
})
