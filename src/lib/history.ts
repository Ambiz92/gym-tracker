import type { HistorySet, SetLog } from '../types/db'

type HistoryInput = Pick<HistorySet, 'date' | 'weight_kg'>

/** Barbell weights are stored per side; history shows the plates of both sides together, bar excluded. */
export function totalWeightKg({ weight_kg, equipment_used }: Pick<SetLog, 'weight_kg' | 'equipment_used'>): number {
  return equipment_used === 'barbell' ? weight_kg * 2 : weight_kg
}

export interface WeekPoint {
  week: number
  weekStart: string
  maxWeightKg: number
}

export interface ExerciseHistory {
  points: WeekPoint[]
  startingWeightKg: number | null
  lastWeightKg: number | null
  variationPct: number | null
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

function toUtcMs(date: string): number {
  const match = DATE_PATTERN.exec(date)
  if (!match) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`)
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const ms = Date.UTC(year, month - 1, day)
  const parsed = new Date(ms)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`Invalid date "${date}"`)
  }
  return ms
}

function mondayMs(date: string): number {
  const ms = toUtcMs(date)
  const daysSinceMonday = (new Date(ms).getUTCDay() + 6) % 7
  return ms - daysSinceMonday * DAY_MS
}

/**
 * Builds weekly max-weight points (Monday-based weeks, week 1 = week of the first logged set),
 * the last weight and the percentage change of the last week versus the first one.
 * `startingWeightKg` is the exercise's own starting weight, or the first week's max when unset.
 */
export function buildHistory(sets: readonly HistoryInput[], exerciseStartingWeightKg: number | null = null): ExerciseHistory {
  const maxByWeek = new Map<number, number>()
  for (const set of sets) {
    const week = mondayMs(set.date)
    maxByWeek.set(week, Math.max(maxByWeek.get(week) ?? -Infinity, set.weight_kg))
  }

  const weeks = [...maxByWeek.keys()].sort((a, b) => a - b)
  const [firstWeek] = weeks
  if (firstWeek === undefined) {
    return { points: [], startingWeightKg: exerciseStartingWeightKg, lastWeightKg: null, variationPct: null }
  }

  const points = weeks.map((weekMs) => ({
    week: (weekMs - firstWeek) / WEEK_MS + 1,
    weekStart: new Date(weekMs).toISOString().slice(0, 10),
    maxWeightKg: maxByWeek.get(weekMs) ?? 0,
  }))
  const firstWeight = points[0]!.maxWeightKg
  const lastWeight = points[points.length - 1]!.maxWeightKg

  return {
    points,
    startingWeightKg: exerciseStartingWeightKg ?? firstWeight,
    lastWeightKg: lastWeight,
    variationPct: firstWeight === 0 ? null : Math.round(((lastWeight - firstWeight) / firstWeight) * 1000) / 10,
  }
}
