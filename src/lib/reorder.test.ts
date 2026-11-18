import { describe, expect, it } from 'vitest'
import { moveItem, moveTo, slotAtY } from './reorder'

describe('moveItem', () => {
  it('moves an item up or down', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
  })

  it('ignores moves past either end', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 5, -1)).toEqual(['a', 'b'])
  })

  it('returns a new array and leaves the input alone', () => {
    const input = ['a', 'b']
    const result = moveItem(input, 0, 1)
    expect(result).not.toBe(input)
    expect(input).toEqual(['a', 'b'])
  })
})

describe('moveTo', () => {
  it('drops the item at the target index, shifting the ones in between', () => {
    expect(moveTo(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveTo(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(moveTo(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })

  it('agrees with a neighbour swap for adjacent rows', () => {
    expect(moveTo(['a', 'b', 'c'], 1, 2)).toEqual(moveItem(['a', 'b', 'c'], 1, 1))
  })

  it('leaves the list alone when nothing moves or an index is out of range', () => {
    expect(moveTo(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
    expect(moveTo(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(moveTo(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
  })

  it('returns a new array and leaves the input alone', () => {
    const input = ['a', 'b']
    expect(moveTo(input, 0, 1)).not.toBe(input)
    expect(input).toEqual(['a', 'b'])
  })
})

describe('slotAtY', () => {
  const slots = [
    { top: 100, bottom: 160 },
    { top: 160, bottom: 240 },
    { top: 240, bottom: 300 },
  ]

  it('finds the row under the pointer', () => {
    expect(slotAtY(slots, 110)).toBe(0)
    expect(slotAtY(slots, 160)).toBe(1)
    expect(slotAtY(slots, 239)).toBe(1)
    expect(slotAtY(slots, 270)).toBe(2)
  })

  it('clamps above the first and below the last row', () => {
    expect(slotAtY(slots, 10)).toBe(0)
    expect(slotAtY(slots, 900)).toBe(2)
  })

  it('has no row to find in an empty list', () => {
    expect(slotAtY([], 50)).toBe(0)
  })
})
