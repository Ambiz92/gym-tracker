import { describe, expect, it } from 'vitest'
import { moveItem } from './reorder'

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
