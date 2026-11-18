import { useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { RowLink } from '../components/RowLink'
import { getPlanById } from '../data/activePlan'
import { useAsync } from '../hooks/useAsync'
import { LoadState } from './history/LoadState'
import { PlanWorkspace } from './plans/PlanWorkspace'

/** Plan editor: loads one plan, reached from the plan list, and its session editor is the child route. */
export function PlanEdit() {
  const { id = '' } = useParams()
  const state = useAsync(() => getPlanById(id), [id])

  return (
    <LoadState state={state} what="la scheda">
      {(plan) =>
        plan ? (
          <PlanWorkspace key={plan.id} initial={plan} />
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
