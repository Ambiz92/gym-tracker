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
