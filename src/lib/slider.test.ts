import { describe, expect, it } from 'vitest'
import { TOUCH_SLOP_PX, createDragGesture, snapToStep, valueAfterKey } from './slider'

describe('slider helpers', () => {
  const range = { min: 5, max: 55, step: 5 }

  it('snaps to the step inside the range', () => {
    expect(snapToStep(22, range)).toBe(20)
    expect(snapToStep(-10, range)).toBe(5)
    expect(snapToStep(300, range)).toBe(55)
  })

  it('moves by one step with the arrows and jumps with Home and End', () => {
    expect(valueAfterKey('ArrowRight', 25, range, false)).toBe(30)
    expect(valueAfterKey('ArrowLeft', 25, range, false)).toBe(20)
    expect(valueAfterKey('Home', 25, range, false)).toBe(5)
    expect(valueAfterKey('End', 25, range, false)).toBe(55)
  })

  it('stays inside the range', () => {
    expect(valueAfterKey('ArrowLeft', 5, range, false)).toBe(5)
    expect(valueAfterKey('ArrowRight', 55, range, false)).toBe(55)
  })

  it('treats up as increasing, or down on a stack where the pin moves down with the load', () => {
    expect(valueAfterKey('ArrowUp', 25, range, false)).toBe(30)
    expect(valueAfterKey('ArrowDown', 25, range, false)).toBe(20)
    expect(valueAfterKey('ArrowDown', 25, range, true)).toBe(30)
    expect(valueAfterKey('ArrowUp', 25, range, true)).toBe(20)
  })

  it('ignores other keys', () => {
    expect(valueAfterKey('Enter', 25, range, false)).toBeNull()
    expect(valueAfterKey('toString', 25, range, false)).toBeNull()
  })
})

describe('drag gesture', () => {
  it('lets a mouse or a pen change the value from the first press', () => {
    expect(createDragGesture().start('mouse', 10, 10)).toBe(true)
    expect(createDragGesture().start('pen', 10, 10)).toBe(true)
  })

  it('keeps a touch from changing the value on the press', () => {
    expect(createDragGesture().start('touch', 10, 10)).toBe(false)
  })

  it('waits for the finger to travel the slop, in any direction', () => {
    const gesture = createDragGesture()
    gesture.start('touch', 100, 100)
    expect(gesture.move(100 + TOUCH_SLOP_PX - 1, 100)).toBe(false)
    expect(gesture.move(100, 100 - TOUCH_SLOP_PX + 1)).toBe(false)
    expect(gesture.move(100 + TOUCH_SLOP_PX, 100)).toBe(true)
  })

  it('measures the slop as a distance, not per axis', () => {
    const gesture = createDragGesture()
    gesture.start('touch', 0, 0)
    expect(gesture.move(6, 6)).toBe(true)
  })

  it('follows the finger once it has passed the slop, even if it comes back', () => {
    const gesture = createDragGesture()
    gesture.start('touch', 0, 0)
    gesture.move(20, 0)
    expect(gesture.move(1, 0)).toBe(true)
  })

  it('starts again from the next press', () => {
    const gesture = createDragGesture()
    gesture.start('touch', 0, 0)
    gesture.move(20, 0)
    gesture.start('touch', 50, 0)
    expect(gesture.move(52, 0)).toBe(false)
  })
})
