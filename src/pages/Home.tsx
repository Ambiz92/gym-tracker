import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { PrimaryButton } from '../components/PrimaryButton'
import { RowLink } from '../components/RowLink'
import { SyncBanner } from '../components/SyncBanner'
import { getActivePlan, type PlanDetail } from '../data/activePlan'
import { getLastWorkoutDates } from '../data/sessionLog'
import { useAsync } from '../hooks/useAsync'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { dayMonth, weekdayDayMonth } from '../lib/formatDate'
import { nextSessionId } from '../lib/nextSession'
import { activeSets, type Draft } from '../lib/sessionDraft'
import { completedExercises } from '../lib/sessionProgress'
import { sessionPath } from './session/paths'
import { useFlushOnMount, useSessionState, useSyncStatus } from './session/sessionStore'
import '../styles/session.css'

interface HomeData {
  plan: PlanDetail | null
  lastDates: ReadonlyMap<string, string>
}

async function loadHome(): Promise<HomeData> {
  const plan = await getActivePlan()
  const lastDates = plan ? await getLastWorkoutDates(plan.sessions.map((session) => session.id)) : new Map<string, string>()
  return { plan, lastDates }
}

/** Today: the open session to resume, then the sessions of the active plan with the next one marked. */
export function Home() {
  const state = useAsync(loadHome, [])
  const { draft } = useSessionState()
  const sync = useSyncStatus()
  const isDesktop = useIsDesktop()
  useFlushOnMount()

  return (
    <>
      <PageHeader
        meta="Gym Tracker"
        metaEnd={weekdayDayMonth(new Date())}
        title={
          isDesktop ? (
            <>
              Oggi
              <br />
              <em>si guarda</em> da qui.
            </>
          ) : (
            <>
              Oggi
              <br />
              <em>si lavora</em>
              <br />
              sotto.
            </>
          )
        }
      />
      {isDesktop && (
        <p className="desktop-note">
          <strong>Le serie si registrano dal telefono.</strong> Qui puoi vedere le sessioni, modificare le schede e
          consultare lo storico.
        </p>
      )}
      <SyncBanner {...sync} />
      {draft && <ResumeRow draft={draft} plan={state.status === 'ready' ? state.data.plan : null} />}
      {state.status === 'loading' && <p className="session-note" role="status">Carico la scheda…</p>}
      {state.status === 'error' && (
        <>
          <p className="session-error" role="alert">
            Non riesco a caricare la scheda: controlla la connessione.
          </p>
          <PrimaryButton onClick={state.reload}>Riprova</PrimaryButton>
        </>
      )}
      {state.status === 'ready' && <PlanSessions {...state.data} />}
    </>
  )
}

function ResumeRow({ draft, plan }: { draft: Draft; plan: PlanDetail | null }) {
  const session = plan?.sessions.find((candidate) => candidate.id === draft.sessionId)
  const detail = session
    ? `${completedExercises(draft, session.exercises)} / ${session.exercises.length} esercizi`
    : `${activeSets(draft).length} serie registrate`
  return (
    <RowLink
      to={sessionPath(draft.sessionId, draft.currentExerciseId)}
      title={`${draft.sessionName} in corso`}
      detail={detail}
      tag="Riprendi →"
      inverted
    />
  )
}

function PlanSessions({ plan, lastDates }: HomeData) {
  if (!plan) {
    return (
      <section className="session-empty">
        <h2 className="session-empty__title">
          Nessuna
          <br />
          scheda
          <br />
          <em>ancora.</em>
        </h2>
        <p className="page-header__subtitle">Creane una per iniziare.</p>
        <RowLink to="/plans" title="Crea la mia scheda" />
      </section>
    )
  }

  const next = nextSessionId(plan.sessions, lastDates)
  return (
    <section>
      <h2 className="session-label">
        {plan.name} · <Link to="/plans">cambia</Link>
      </h2>
      {plan.sessions.length === 0 ? (
        <>
          <p className="session-note">Questa scheda non ha ancora sessioni.</p>
          <RowLink to={`/plans/${plan.id}`} title="Aggiungi una sessione" />
        </>
      ) : (
        <ul className="session-list">
          {plan.sessions.map((session, index) => {
            const lastDate = lastDates.get(session.id)
            const detail = [
              session.is_optional ? 'bonus' : null,
              lastDate ? dayMonth(lastDate) : 'mai fatta',
              `${session.exercises.length} ${session.exercises.length === 1 ? 'esercizio' : 'esercizi'}`,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={session.id}>
                <RowLink
                  to={sessionPath(session.id)}
                  title={session.name}
                  detail={detail}
                  index={index + 1}
                  tag={session.id === next ? 'Prossima' : undefined}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
