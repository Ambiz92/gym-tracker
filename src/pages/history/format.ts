import { totalWeightKg } from '../../lib/history'
import type { Equipment, SetLog } from '../../types/db'

type SetValues = Pick<SetLog, 'set_number' | 'reps' | 'weight_kg' | 'equipment_used'>

/** Italian number format: decimal comma, no trailing zeros. */
export function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',')
}

export function formatKg(value: number): string {
  return `${formatNumber(value)} kg`
}

/** A history weight already converted by totalWeightKg: barbell loads say they are the total of both sides. */
export function formatLoadKg(value: number, equipment: Equipment): string {
  return equipment === 'barbell' ? `${formatNumber(value)} kg totali` : formatKg(value)
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

/** Runs of identical consecutive sets, e.g. ["2×8 · 30 kg", "1×6 · 110 kg totali"]. */
export function groupSets(sets: readonly SetValues[]): string[] {
  const ordered = [...sets].sort((a, b) => a.set_number - b.set_number)
  const groups: { reps: number; weight_kg: number; equipment_used: Equipment; count: number }[] = []
  for (const { reps, weight_kg, equipment_used } of ordered) {
    const last = groups[groups.length - 1]
    if (last && last.reps === reps && last.weight_kg === weight_kg && last.equipment_used === equipment_used) last.count += 1
    else groups.push({ reps, weight_kg, equipment_used, count: 1 })
  }
  return groups.map((group) => `${group.count}×${group.reps} · ${formatLoadKg(totalWeightKg(group), group.equipment_used)}`)
}
