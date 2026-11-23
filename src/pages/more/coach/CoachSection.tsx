import type { CoachLinks } from '../../../data/coachLinks'
import { activeAthletes, openCoachLink, pendingRequests } from '../../../lib/coachLink'
import '../../../styles/coach.css'
import { useCoachLinks } from '../../coach/CoachLinksProvider'
import { LoadState } from '../../history/LoadState'
import { CoachCode } from './CoachCode'
import { LinkList } from './LinkList'
import { MyCoach } from './MyCoach'
import { RequestCoachForm } from './RequestCoachForm'

/** Altro, "Allenatore": my code, my coach (or the request form), requests to answer and my athletes. */
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

  return (
    <div className="coach-section">
      <CoachCode code={links.userId} />
      {coachLink ? (
        <MyCoach link={coachLink} onChanged={onChanged} />
      ) : (
        <RequestCoachForm userId={links.userId} onRequested={onChanged} />
      )}
      <LinkList title="Richieste in arrivo" links={pendingRequests(links.asCoach)} onChanged={onChanged} />
      <LinkList title="I miei atleti" links={activeAthletes(links.asCoach)} onChanged={onChanged} />
    </div>
  )
}
