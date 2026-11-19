import { clamp } from './slider'

/** Pure helpers behind the logger scene: plates on the bar, the cable stack and the ruler. */

export const BAR_KG = 20

export type PlateId = '25' | '20' | '15' | '10' | '5' | '2-5' | '1-25'

export interface Plate {
  id: PlateId
  kg: number
  /** Diameter in scene units: 25 to 10 kg share one, only the thickness differs. */
  diameter: number
  thickness: number
}

const COMPETITION_DIAMETER = 120

/** Heaviest first, the order in which the greedy fill takes them. */
export const PLATES: readonly Plate[] = [
  { id: '25', kg: 25, diameter: COMPETITION_DIAMETER, thickness: 24 },
  { id: '20', kg: 20, diameter: COMPETITION_DIAMETER, thickness: 22 },
  { id: '15', kg: 15, diameter: COMPETITION_DIAMETER, thickness: 20 },
  { id: '10', kg: 10, diameter: COMPETITION_DIAMETER, thickness: 18 },
  { id: '5', kg: 5, diameter: 92, thickness: 14 },
  { id: '2-5', kg: 2.5, diameter: 72, thickness: 11 },
  { id: '1-25', kg: 1.25, diameter: 56, thickness: 8 },
]

export interface PlateLoad {
  /** Plates on one side of the bar, heaviest first. */
  plates: Plate[]
  /** False when the weight is below the bar or the plates cannot add up to it. */
  exact: boolean
}

const toCents = (kg: number): number => Math.round(kg * 100)

/** Greedy plates per side for a total weight; below the bar it is the bare bar. */
export function platesPerSide(totalKg: number): PlateLoad {
  if (totalKg < BAR_KG) return { plates: [], exact: false }
  let remaining = toCents((totalKg - BAR_KG) / 2)
  const plates: Plate[] = []
  for (const plate of PLATES) {
    const cents = toCents(plate.kg)
    while (remaining >= cents) {
      plates.push(plate)
      remaining -= cents
    }
  }
  return { plates, exact: remaining === 0 }
}

export const CABLE_BLOCKS = 11
export const CABLE_BLOCK_KG = 5

/** Block (1-based) the pin sits on for a weight, clamped to the stack. */
export const cableBlock = (weightKg: number): number => clamp(Math.round(weightKg / CABLE_BLOCK_KG), 1, CABLE_BLOCKS)

/** Block under a vertical offset from the top of the stack, as a weight in kg. */
export const cableWeightAt = (offset: number, blockHeight: number): number =>
  (Math.floor(offset / blockHeight) + 1) * CABLE_BLOCK_KG

const RULER_BASE_MAX = { seconds: 90, meters: 60 } as const
export const RULER_STEP = 5

/** Scale of the ruler: 90 s or 60 m, or the next multiple of that when the value is larger. */
export function rulerMax(unit: keyof typeof RULER_BASE_MAX, value: number): number {
  const base = RULER_BASE_MAX[unit]
  return Math.max(1, Math.ceil(value / base)) * base
}

/** Horizontal position of a value on a ruler drawn from x0 to x1. */
export const rulerX = (value: number, max: number, x0: number, x1: number): number =>
  x0 + ((x1 - x0) * clamp(value, 0, max)) / max

/** Value under a horizontal position of a ruler drawn from x0 to x1. */
export const rulerValueAt = (x: number, max: number, x0: number, x1: number): number =>
  ((x - x0) / (x1 - x0)) * max
