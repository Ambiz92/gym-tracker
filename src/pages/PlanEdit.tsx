import { useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { RowLink } from '../components/RowLink'
import { getPlanById } from '../data/activePlan'
import { useAsync } from '../hooks/useAsync'
import { LoadState } from './history/LoadState'
import { PlanScreen } from './plans/PlanScreen'

/** Plan editor: sessions of one plan, reached from the plan list. */
export function PlanEdit() {
  const { id = '' } = useParams()
  const state = useAsync(() => getPlanById(id), [id])

  return (
    <LoadState state={state} what="la scheda">
      {(plan) =>
        plan ? (
          <PlanScreen key={plan.id} initial={plan} />
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
