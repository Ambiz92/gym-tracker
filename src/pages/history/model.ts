import type { ChartPoint } from '../../components/lineChartScale'
import type { HistoryExercise, LoggedSet, RecentWorkout } from '../../data/history'
import { buildHistory } from '../../lib/history'
import type { Equipment, HistorySet } from '../../types/db'
import { formatKg, formatNumber, formatShortDate, formatVariation, groupSets, pluralize } from './format'

function groupBy<Item, Key>(items: readonly Item[], key: (item: Item) => Key): Map<Key, Item[]> {
  const groups = new Map<Key, Item[]>()
  for (const item of items) {
    const group = groups.get(key(item))
    if (group) group.push(item)
    else groups.set(key(item), [item])
  }
  return groups
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'it')

export interface ExerciseSummary {
  id: string
  name: string
  archived: boolean
  lastWeightKg: number
  variationPct: number | null
  lastDate: string
}

/** One entry per exercise that was ever logged, the most recently trained first. */
export function buildExerciseSummaries(
  exercises: readonly HistoryExercise[],
  sets: readonly LoggedSet[],
): ExerciseSummary[] {
  const setsByExercise = groupBy(sets, (set) => set.exercise_id)
  const summaries: ExerciseSummary[] = []
  for (const exercise of exercises) {
    const logged = setsByExercise.get(exercise.id)
    if (!logged) continue
    const { lastWeightKg, variationPct } = buildHistory(logged, exercise.starting_weight_kg)
    if (lastWeightKg === null) continue
    const lastDate = logged.reduce((latest, set) => (set.date > latest ? set.date : latest), '')
    summaries.push({ id: exercise.id, name: exercise.name, archived: exercise.archived, lastWeightKg, variationPct, lastDate })
  }
  return summaries.sort((a, b) => b.lastDate.localeCompare(a.lastDate) || byName(a, b))
}

export function summaryDetail(summary: ExerciseSummary): string {
  const detail = `ultima ${formatKg(summary.lastWeightKg)}`
  return summary.archived ? `${detail} · archiviato` : detail
}

/** Case-insensitive substring match on the name; a blank query keeps everything. */
export function filterSummaries(summaries: readonly ExerciseSummary[], query: string): ExerciseSummary[] {
  const needle = query.trim().toLowerCase()
  return summaries.filter((summary) => summary.name.toLowerCase().includes(needle))
}

export interface SessionSummary {
  id: string
  title: string
  detail: string
  exercises: { exerciseId: string; name: string; sets: string[] }[]
}

/** Recent workouts as expandable rows: when, how much, and the sets of each exercise by name. */
export function buildSessionSummaries(
  workouts: readonly RecentWorkout[],
  exerciseNames: ReadonlyMap<string, string>,
  today: string,
): SessionSummary[] {
  return workouts.map((workout) => {
    const exercises = [...groupBy(workout.set_log, (set) => set.exercise_id)]
      .map(([exerciseId, sets]) => ({
        exerciseId,
        name: exerciseNames.get(exerciseId) ?? 'Esercizio',
        sets: groupSets(sets),
      }))
      .sort(byName)
    const detail = [
      formatShortDate(workout.date, today),
      pluralize(exercises.length, 'esercizio', 'esercizi'),
      pluralize(workout.set_log.length, 'serie', 'serie'),
    ].join(' · ')
    return { id: workout.id, title: workout.session_name, detail, exercises }
  })
}

export interface WorkoutRow {
  key: string
  date: string
  sets: string[]
}

/** One row per workout containing the exercise, newest first. */
export function buildWorkoutRows(sets: readonly HistorySet[], today: string): WorkoutRow[] {
  const rows = [...groupBy(sets, (set) => set.workout_id)].map(([key, workoutSets]) => ({
    key,
    isoDate: workoutSets[0]!.date,
    sets: groupSets(workoutSets),
  }))
  return rows
    .sort((a, b) => b.isoDate.localeCompare(a.isoDate))
    .map(({ key, isoDate, sets: groups }) => ({ key, date: formatShortDate(isoDate, today), sets: groups }))
}

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Bilanciere',
  dumbbell: 'Manubri',
  other: 'Altro',
}

export interface ExerciseView {
  name: string
  equipment: string
  archived: boolean
  kpis: { value: string; label: string; accent?: boolean }[]
  chartPoints: ChartPoint[]
  chartSummary: string
  workouts: WorkoutRow[]
}

/** Everything the exercise page shows; `kpis` and the chart are empty when nothing was logged. */
export function buildExerciseView(exercise: HistoryExercise, sets: readonly HistorySet[], today: string): ExerciseView {
  const history = buildHistory(sets, exercise.starting_weight_kg)
  const { points, startingWeightKg, lastWeightKg, variationPct } = history
  const view: ExerciseView = {
    name: exercise.name,
    equipment: EQUIPMENT_LABELS[exercise.equipment],
    archived: exercise.archived,
    kpis: [],
    chartPoints: points.map((point) => ({
      x: point.week,
      y: point.maxWeightKg,
      axisLabel: `S${point.week}`,
      description: `Settimana ${point.week}, dal ${formatShortDate(point.weekStart, today)}: ${formatKg(point.maxWeightKg)}`,
    })),
    chartSummary: '',
    workouts: buildWorkoutRows(sets, today),
  }
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last || startingWeightKg === null || lastWeightKg === null) return view

  view.kpis = [
    { value: formatNumber(startingWeightKg), label: 'kg partenza' },
    { value: formatNumber(lastWeightKg), label: 'kg ultima' },
    { value: formatVariation(variationPct), label: 'vs sett. 1', accent: true },
  ]
  view.chartSummary =
    points.length === 1
      ? `Peso massimo per settimana: ${formatKg(first.maxWeightKg)} nella settimana 1.`
      : `Peso massimo per settimana: da ${formatKg(first.maxWeightKg)} nella settimana 1 a ${formatKg(last.maxWeightKg)} nella settimana ${last.week}.`
  return view
}
