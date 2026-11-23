import { athleteName, linkDay, linkStatusLabel } from '../../../lib/coachLink'
import type { CoachLink } from '../../../types/db'
import { ConsentText } from './ConsentText'
import { LinkActions } from './LinkActions'

/** The athlete's open link: its state, what is shared, and the one-tap way out. */
export function MyCoach({ link, onChanged }: { link: CoachLink; onChanged: () => void }) {
  return (
    <div>
      <h3 className="coach-subhead">Il tuo allenatore</h3>
      <p className="history-note">
        {linkStatusLabel('athlete', link.status)} · richiesta del {linkDay(link.created_at)} · visto come <bdi>{athleteName(link)}</bdi> · codice {link.coach_id.slice(0, 8)}…
      </p>
      <details className="coach-shared">
        <summary>Cosa vede il tuo allenatore</summary>
        <ConsentText />
      </details>
      <LinkActions link={link} role="athlete" onChanged={onChanged} />
    </div>
  )
}
