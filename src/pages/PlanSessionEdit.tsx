import { useOutletContext, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { RowLink } from '../components/RowLink'
import { SessionScreen } from './plans/SessionScreen'
import type { PlanOutletContext } from './plans/planContext'

/** Session editor, reached from the plan screen; the plan is the one PlanEdit holds. */
export function PlanSessionEdit() {
  const { sessionId = '' } = useParams()
  const { plan, setPlan } = useOutletContext<PlanOutletContext>()
  const session = plan.sessions.find((candidate) => candidate.id === sessionId)

  if (!session) {
    return (
      <>
        <PageHeader meta="Schede" title="Sessione non trovata." size="title" />
        <RowLink to={`/plans/${plan.id}`} title="Torna alla scheda" />
      </>
    )
  }
  return (
    <SessionScreen
      key={session.id}
      planId={plan.id}
      planName={plan.name}
      session={session}
      onChange={(update) =>
        setPlan((current) => ({
          ...current,
          sessions: current.sessions.map((candidate) => (candidate.id === session.id ? update(candidate) : candidate)),
        }))
      }
      onRemoved={(removal) =>
        setPlan((current) => ({
          ...current,
          sessions: current.sessions.filter((candidate) => candidate.id !== session.id),
          archivedSessions:
            removal === 'archived' ? [...current.archivedSessions, { ...session, archived: true }] : current.archivedSessions,
        }))
      }
    />
  )
}
