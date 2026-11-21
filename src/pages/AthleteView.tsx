import { Link, useParams } from 'react-router-dom'
import { useAal2 } from '../auth/useAal2'
import { PageHeader } from '../components/PageHeader'
import { PrimaryButton } from '../components/PrimaryButton'
import { Skeleton } from '../components/Skeleton'
import { activeAthletes, athleteName } from '../lib/coachLink'
import '../styles/coach.css'
import '../styles/history.css'
import { AthleteDetail } from './athletes/AthleteDetail'
import { useCoachLinks } from './coach/CoachLinksProvider'
import { SecondFactorPrompt } from './coach/SecondFactorPrompt'
import { LoadState } from './history/LoadState'

/** `/athletes/:athleteId`: one athlete's plans, workouts and notes, read-only, for the coach of an active link only. */
export function AthleteView() {
  const { athleteId = '' } = useParams()
  const state = useCoachLinks()
  const { aal2, loading, retry } = useAal2()

  return (
    <LoadState state={state} what="gli atleti">
      {({ asCoach }) => {
        const link = activeAthletes(asCoach).find((candidate) => candidate.athlete_id === athleteId)
        if (!link) return <NotFound />
        return (
          <>
            <PageHeader meta="Atleti" title={<bdi>{athleteName(link)}</bdi>} />
            <Link to="/athletes" className="history-back">
              ← Tutti gli atleti
            </Link>
            <p className="athlete-banner">
              Stai guardando i dati di <bdi>{athleteName(link)}</bdi>. Puoi solo leggere.
            </p>
            {aal2 === false && <SecondFactorPrompt />}
            {aal2 === null && (loading ? <Skeleton label="Caricamento…" /> : <Aal2Unknown onRetry={retry} />)}
            {aal2 === true && <AthleteDetail athleteId={athleteId} />}
          </>
        )
      }}
    </LoadState>
  )
}

/** The assurance level could not be read: say so and offer a retry, rather than guess a prompt or wait forever. */
function Aal2Unknown({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="error-state">
      <p>Non riesco a verificare il secondo fattore. Riprova tra poco.</p>
      <PrimaryButton variant="outline" onClick={onRetry}>
        Riprova
      </PrimaryButton>
    </div>
  )
}

function NotFound() {
  return (
    <section className="history-empty">
      <h2 className="history-empty__title">Atleta non trovato.</h2>
      <p className="history-empty__text">Non c’è un collegamento attivo con questo atleta.</p>
      <Link to="/athletes" className="history-back">
        ← Tutti gli atleti
      </Link>
    </section>
  )
}
