export type Equipment = 'barbell' | 'dumbbell' | 'other'
export type TargetUnit = 'reps' | 'seconds' | 'meters'

export const MAX_REPS_PER_SET = 10

const DECIMAL_PATTERN = /^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/

/** Soft warning (never blocks logging): only rep-based sets above the 10-rep rule. */
export function repsWarning(reps: number, unit: TargetUnit): string | null {
  if (unit !== 'reps' || reps <= MAX_REPS_PER_SET) return null
  return `Sopra le ${MAX_REPS_PER_SET} ripetizioni`
}

/** Parses a non-negative decimal typed with a comma or a dot; null when invalid. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim()
  if (!DECIMAL_PATTERN.test(trimmed)) return null
  return Number(trimmed.replace(',', '.'))
}

/** Step of the weight input in kg: plates on a barbell, single dumbbell increments otherwise. */
export function weightStep(equipment: Equipment): number {
  return equipment === 'barbell' ? 2.5 : 1
}
