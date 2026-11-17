import type { SetLog } from '../../types/db'

type SetValues = Pick<SetLog, 'set_number' | 'reps' | 'weight_kg'>

/** Italian number format: decimal comma, no trailing zeros. */
export function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',')
}

export function formatKg(value: number): string {
  return `${formatNumber(value)} kg`
}

/** "+20%", "−5%", "=" when unchanged, "—" when there is no baseline. */
export function formatVariation(pct: number | null): string {
  if (pct === null) return '—'
  if (pct === 0) return '='
  return `${pct > 0 ? '+' : '−'}${formatNumber(Math.abs(pct))}%`
}

/** "17.11" for the current year, "17.11.25" otherwise, "oggi" for today (both as YYYY-MM-DD). */
export function formatShortDate(date: string, today: string): string {
  if (date === today) return 'oggi'
  const [year = '', month = '', day = ''] = date.split('-')
  const shortDate = `${day}.${month}`
  return year === today.slice(0, 4) ? shortDate : `${shortDate}.${year.slice(2)}`
}

export function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** Runs of identical consecutive sets, e.g. ["2×8 · 30 kg", "1×6 · 27,5 kg"]. */
export function groupSets(sets: readonly SetValues[]): string[] {
  const ordered = [...sets].sort((a, b) => a.set_number - b.set_number)
  const groups: { reps: number; weightKg: number; count: number }[] = []
  for (const { reps, weight_kg } of ordered) {
    const last = groups[groups.length - 1]
    if (last && last.reps === reps && last.weightKg === weight_kg) last.count += 1
    else groups.push({ reps, weightKg: weight_kg, count: 1 })
  }
  return groups.map(({ count, reps, weightKg }) => `${count}×${reps} · ${formatKg(weightKg)}`)
}
