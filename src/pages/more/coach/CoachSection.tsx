import { useState } from 'react'
import type { CoachLinks } from '../../../data/coachLinks'
import { openAthletes, openCoachLink } from '../../../lib/coachLink'
import '../../../styles/coach.css'
import { useCoachLinks } from '../../coach/CoachLinksProvider'
import { LoadState } from '../../history/LoadState'
import { CoachCode } from './CoachCode'
import { LinkCoachForm } from './LinkCoachForm'
import { LinkList } from './LinkList'
import { MyCoach } from './MyCoach'

/** Altro, "Allenatore": my code, my coach (or the form that links me to one) and my athletes. */
export function CoachSection() {
  const state = useCoachLinks()
  return (
    <LoadState state={state} what="i collegamenti con l’allenatore">
      {(links) => <CoachLinksView links={links} onChanged={state.reload} />}
    </LoadState>
  )
}

function CoachLinksView({ links, onChanged }: { links: CoachLinks; onChanged: () => void }) {
  const coachLink = openCoachLink(links.asAthlete)
  // The form unmounts as soon as the link shows up, so the confirmation lives here.
  const [justLinked, setJustLinked] = useState(false)

  function linked() {
    setJustLinked(true)
    onChanged()
  }

  return (
    <div className="coach-section">
      <CoachCode code={links.userId} />
      {coachLink ? (
        <>
          {justLinked && (
            <p role="status" className="history-note">
              Collegamento attivo: il tuo allenatore può ora vedere i tuoi dati.
            </p>
          )}
          <MyCoach link={coachLink} onChanged={onChanged} />
        </>
      ) : (
        <LinkCoachForm userId={links.userId} onLinked={linked} />
      )}
      <LinkList title="I miei atleti" links={openAthletes(links.asCoach)} onChanged={onChanged} />
    </div>
  )
}
