import { athleteName, linkDay, linkStatusLabel } from '../../../lib/coachLink'
import type { CoachLink } from '../../../types/db'
import { ConsentText } from './ConsentText'
import { LinkActions } from './LinkActions'

/** The athlete's open link: its state, what is shared, and the one-tap way out. */
export function MyCoach({ link, aal2, onChanged }: { link: CoachLink; aal2: boolean | null; onChanged: () => void }) {
  return (
    <div>
      <h3 className="coach-subhead">Il mio allenatore</h3>
      <p className="coach-link__title">Codice {link.coach_id.slice(0, 8)}…</p>
      <p className="history-note">
        {linkStatusLabel('athlete', link.status)} · richiesta del {linkDay(link.created_at)} · visto come <bdi>{athleteName(link)}</bdi>
      </p>
      <details className="coach-shared">
        <summary>Cosa vede il tuo allenatore</summary>
        <ConsentText />
      </details>
      <LinkActions link={link} role="athlete" aal2={aal2} onChanged={onChanged} />
    </div>
  )
}
