import type { Plan } from '../types/db'

export interface GroupedPlans<T> {
  active: T | null
  others: T[]
  archived: T[]
}

/** Splits the plans of the list screen; an archived plan is never the active one (check constraint). */
export function groupPlans<T extends Pick<Plan, 'is_active' | 'archived'>>(plans: readonly T[]): GroupedPlans<T> {
  return {
    active: plans.find((plan) => plan.is_active && !plan.archived) ?? null,
    others: plans.filter((plan) => !plan.is_active && !plan.archived),
    archived: plans.filter((plan) => plan.archived),
  }
}

export function countLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** Second line of a plan row: "3 sessioni · 19 esercizi". */
export function planDetail({ sessionCount, exerciseCount }: { sessionCount: number; exerciseCount: number }): string {
  return `${countLabel(sessionCount, 'sessione', 'sessioni')} · ${countLabel(exerciseCount, 'esercizio', 'esercizi')}`
}
