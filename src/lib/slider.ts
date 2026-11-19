/** Generic slider math: snapping to a step and the keys of the slider pattern. */

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export interface SliderRange {
  min: number
  max: number
  step: number
}

/** The nearest multiple of the step, kept inside the range. */
export const snapToStep = (value: number, { min, max, step }: SliderRange): number =>
  clamp(Math.round(value / step) * step, min, max)

function keyDirection(key: string, downIncreases: boolean): number | null {
  switch (key) {
    case 'ArrowRight':
      return 1
    case 'ArrowLeft':
      return -1
    case 'ArrowDown':
      return downIncreases ? 1 : -1
    case 'ArrowUp':
      return downIncreases ? -1 : 1
    default:
      return null
  }
}

/**
 * Value after a key press on a slider; null for keys it does not handle.
 * On a vertical stack the pin moves down as the weight grows, so down is the increasing key.
 */
export function valueAfterKey(key: string, value: number, range: SliderRange, downIncreases: boolean): number | null {
  if (key === 'Home') return range.min
  if (key === 'End') return range.max
  const direction = keyDirection(key, downIncreases)
  return direction === null ? null : clamp(value + direction * range.step, range.min, range.max)
}

/** How far a finger must travel, in CSS px, before it moves a slider; a tap or the start of a scroll stays harmless. */
export const TOUCH_SLOP_PX = 8

/** Decides when a pointer drag may change the value: at once for mouse and pen, after the slop for touch. */
export function createDragGesture(slop: number = TOUCH_SLOP_PX) {
  let waitingFrom: { x: number; y: number } | null = null

  return {
    /** True when the value should follow the pointer right away. */
    start(pointerType: string, x: number, y: number): boolean {
      waitingFrom = pointerType === 'touch' ? { x, y } : null
      return waitingFrom === null
    },
    /** True when a move of the captured pointer should change the value. */
    move(x: number, y: number): boolean {
      if (!waitingFrom) return true
      if (Math.hypot(x - waitingFrom.x, y - waitingFrom.y) < slop) return false
      waitingFrom = null
      return true
    },
  }
}
