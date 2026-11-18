import { useState } from 'react'
import type { PlanSummary } from '../../data/plans'
import { setActivePlan } from '../../data/plans'
import { useAction } from '../../hooks/useAction'
import { describePlanError } from './errors'
import { PlanGroups } from './PlanGroups'

/** The plan list with the activation radios; the copy updates once the request succeeds, so the list never reloads. */
export function PlanList({ initial }: { initial: readonly PlanSummary[] }) {
  const [plans, setPlans] = useState(initial)
  const activation = useAction(describePlanError)

  async function handleActivate(id: string) {
    const failure =
      'Attivazione non riuscita. Controlla la connessione: se nessuna scheda risulta attiva, riprova ad attivarne una.'
    if (await activation.run(() => setActivePlan(id), failure)) {
      setPlans((current) => current.map((plan) => ({ ...plan, is_active: plan.id === id })))
    }
  }

  return <PlanGroups plans={plans} busy={activation.busy} error={activation.error} onActivate={handleActivate} />
}
