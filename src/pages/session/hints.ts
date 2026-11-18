import type { ProgressionChip } from '../../components/ExerciseCard'
import { formatNumber } from '../../lib/formatNumber'
import { suggestNextWeight } from '../../lib/progression'
import type { LastSet, PlanExercise } from '../../types/db'

/** Weight the progression rule proposes for the next workout, or null. */
export function suggestedWeight(recentSets: readonly (readonly LastSet[])[], target: PlanExercise): number | null {
  return suggestNextWeight(recentSets, target).suggested
}

/** "+2,5" next to an exercise whose progression rule fired. */
export function progressionChip(
  recentSets: readonly (readonly LastSet[])[],
  target: PlanExercise,
): ProgressionChip | undefined {
  const suggested = suggestedWeight(recentSets, target)
  const previous = recentSets[0]?.[0]
  if (suggested === null || !previous) return undefined
  const delta = formatNumber(Math.round((suggested - previous.weight_kg) * 100) / 100)
  return { label: `+${delta}`, description: `Suggerito: ${formatNumber(suggested)} kg, più ${delta}` }
}
