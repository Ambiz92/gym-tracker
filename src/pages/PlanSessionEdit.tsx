import { useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { RowLink } from '../components/RowLink'
import { getPlanById } from '../data/activePlan'
import { useAsync } from '../hooks/useAsync'
import { LoadState } from './history/LoadState'
import { SessionScreen } from './plans/SessionScreen'

/** Session editor, reached from the plan screen. */
export function PlanSessionEdit() {
  const { id = '', sessionId = '' } = useParams()
  const state = useAsync(() => getPlanById(id), [id])

  return (
    <LoadState state={state} what="la sessione">
      {(plan) => {
        const session = plan?.sessions.find((candidate) => candidate.id === sessionId)
        if (!plan || !session) {
          return (
            <>
              <PageHeader meta="Schede" title="Sessione non trovata." size="title" />
              <RowLink to={plan ? `/plans/${plan.id}` : '/plans'} title={plan ? 'Torna alla scheda' : 'Torna alle schede'} />
            </>
          )
        }
        return <SessionScreen key={session.id} planId={plan.id} planName={plan.name} initial={session} />
      }}
    </LoadState>
  )
}
