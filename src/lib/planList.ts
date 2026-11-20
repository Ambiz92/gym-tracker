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

type WithSessions = { sessions: readonly { exercises: readonly unknown[] }[] }

/** Live sessions and exercises of a plan, as the list rows and the builder footer count them. */
export function planCounts(plan: WithSessions): { sessionCount: number; exerciseCount: number } {
  const exerciseCount = plan.sessions.reduce((total, session) => total + session.exercises.length, 0)
  return { sessionCount: plan.sessions.length, exerciseCount }
}

/** What the plan list shows of a plan: when this changes, the list is stale. */
export function planListSignature(plan: Pick<Plan, 'name' | 'is_active' | 'archived'> & WithSessions): string {
  const { sessionCount, exerciseCount } = planCounts(plan)
  return JSON.stringify([plan.name, plan.is_active, plan.archived, sessionCount, exerciseCount])
}

/** Second line of a plan row: "3 sessioni · 19 esercizi". */
export function planDetail({ sessionCount, exerciseCount }: { sessionCount: number; exerciseCount: number }): string {
  return `${countLabel(sessionCount, 'sessione', 'sessioni')} · ${countLabel(exerciseCount, 'esercizio', 'esercizi')}`
}
