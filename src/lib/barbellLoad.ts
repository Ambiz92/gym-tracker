import type { Equipment } from '../types/db'

/**
 * The barbell weight convention, converted ONLY here (barbellLoad.test.ts fails if anything else doubles or halves a weight).
 * The database stores the TOTAL of both sides: 2 x the load of one side, bar excluded.
 * Wherever the user logs or edits a weight (logger, plates, hints, prefill, session draft, plan and exercise forms)
 * the number is the load of ONE side. History, session summary, exports and coach views show the stored total.
 * Dumbbell and other weights are the same in both worlds.
 */

const round2 = (kg: number): number => Math.round(kg * 100) / 100

/** What the user typed or stepped (one side on a barbell) as the value to store. */
export function toStoredKg(equipment: Equipment, perSideKg: number): number {
  return equipment === 'barbell' ? round2(perSideKg * 2) : perSideKg
}

/** A stored weight as the user logs and edits it (one side on a barbell); null stays null. */
export function toDisplayKg(equipment: Equipment, storedKg: number): number
export function toDisplayKg(equipment: Equipment, storedKg: number | null): number | null
export function toDisplayKg(equipment: Equipment, storedKg: number | null): number | null {
  if (storedKg === null) return null
  return equipment === 'barbell' ? round2(storedKg / 2) : storedKg
}
