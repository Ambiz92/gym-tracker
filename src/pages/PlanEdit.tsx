import { useOutletContext, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { RowLink } from '../components/RowLink'
import { getPlanById } from '../data/activePlan'
import { useAsync } from '../hooks/useAsync'
import { LoadState } from './history/LoadState'
import type { PlansOutletContext } from './plans/planContext'
import { PlanWorkspace } from './plans/PlanWorkspace'

/** Plan editor: loads one plan, reached from the plan list, and its session editor is the child route. */
export function PlanEdit() {
  const { id = '' } = useParams()
  // Set by PlansSplit; absent when the editor is rendered on its own.
  const list = useOutletContext<PlansOutletContext | undefined>()
  const state = useAsync(() => getPlanById(id), [id, list?.refreshKey])

  return (
    <LoadState state={state} what="la scheda">
      {(plan) =>
        plan ? (
          <PlanWorkspace key={plan.id} initial={plan} onListStale={list?.onPlanChanged} />
        ) : (
          <>
            <PageHeader meta="Schede" title="Scheda non trovata." size="title" />
            <RowLink to="/plans" title="Torna alle schede" />
          </>
        )
      }
    </LoadState>
  )
}
