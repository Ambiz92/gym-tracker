import { PageHeader } from '../components/PageHeader'
import { RowLink } from '../components/RowLink'
import { activeAthletes, athleteName, linkSince } from '../lib/coachLink'
import '../styles/coach.css'
import '../styles/history.css'
import { useCoachLinks } from './coach/CoachLinksProvider'
import { LoadState } from './history/LoadState'

/** Atleti tab: the coach's active athletes, each opening a read-only view. */
export function Athletes() {
  const state = useCoachLinks()

  return (
    <>
      <PageHeader meta="Atleti" title="Atleti" />
      <LoadState state={state} what="gli atleti">
        {({ asCoach }) => {
          const athletes = activeAthletes(asCoach)
          if (athletes.length === 0) {
            return (
              <section className="history-empty">
                <h2 className="history-empty__title">Nessun atleta attivo.</h2>
                <p className="history-empty__text">Gli atleti si collegano da soli con il tuo codice, che trovi in Altro.</p>
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
                  detail={`Attivo dal ${linkSince(link)}`}
                />
              ))}
            </div>
          )
        }}
      </LoadState>
    </>
  )
}
