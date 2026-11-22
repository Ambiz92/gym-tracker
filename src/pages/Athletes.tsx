import { PageHeader } from '../components/PageHeader'
import { RowLink } from '../components/RowLink'
import { useAal2 } from '../auth/useAal2'
import { activeAthletes, athleteName, linkDay } from '../lib/coachLink'
import '../styles/coach.css'
import '../styles/history.css'
import { useCoachLinks } from './coach/CoachLinksProvider'
import { SecondFactorPrompt } from './coach/SecondFactorPrompt'
import { LoadState } from './history/LoadState'

/** Atleti tab: the coach's active athletes, each opening a read-only view. Needs aal2, like every read of their data. */
export function Athletes() {
  const state = useCoachLinks()
  const { aal2 } = useAal2()

  return (
    <>
      <PageHeader meta="Atleti" title="Atleti" />
      {aal2 === false && <SecondFactorPrompt />}
      <LoadState state={state} what="gli atleti">
        {({ asCoach }) => {
          const athletes = activeAthletes(asCoach)
          if (athletes.length === 0) {
            return (
              <section className="history-empty">
                <h2 className="history-empty__title">Nessun atleta attivo.</h2>
                <p className="history-empty__text">Le richieste in arrivo si accettano da Altro.</p>
                <RowLink to="/more" title="Vai ad Altro" />
              </section>
            )
          }
          return (
            <div className="athlete-list">
              {athletes.map((link) => (
                <RowLink
                  key={link.id}
                  to={`/athletes/${link.athlete_id}`}
                  title={athleteName(link)}
                  detail={`Attivo dal ${linkDay(link.accepted_at ?? link.created_at)}`}
                />
              ))}
            </div>
          )
        }}
      </LoadState>
    </>
  )
}
