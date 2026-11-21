import { useAal2 } from '../../../auth/useAal2'
import type { CoachLinks } from '../../../data/coachLinks'
import { activeAthletes, coachNeedsSecondFactor, openCoachLink, pendingRequests } from '../../../lib/coachLink'
import '../../../styles/coach.css'
import { useCoachLinks } from '../../coach/CoachLinksProvider'
import { SecondFactorPrompt } from '../../coach/SecondFactorPrompt'
import { LoadState } from '../../history/LoadState'
import { CoachCode } from './CoachCode'
import { LinkList } from './LinkList'
import { MyCoach } from './MyCoach'
import { RequestCoachForm } from './RequestCoachForm'

/** Altro, "Allenatore": my code, my coach (or the request form), requests to answer and my athletes. */
export function CoachSection() {
  const state = useCoachLinks()
  const aal2 = useAal2()
  return (
    <LoadState state={state} what="i collegamenti con l’allenatore">
      {(links) => <CoachLinksView links={links} aal2={aal2} onChanged={state.reload} />}
    </LoadState>
  )
}

function CoachLinksView({ links, aal2, onChanged }: { links: CoachLinks; aal2: boolean | null; onChanged: () => void }) {
  const coachLink = openCoachLink(links.asAthlete)
  // Unknown (null) shows no prompt yet; the accept button stays disabled until aal2 is confirmed.
  const showPrompt = coachNeedsSecondFactor(links.asCoach, aal2 !== false)

  return (
    <div className="coach-section">
      <CoachCode code={links.userId} />
      {coachLink ? (
        <MyCoach link={coachLink} aal2={aal2} onChanged={onChanged} />
      ) : (
        <RequestCoachForm userId={links.userId} onRequested={onChanged} />
      )}
      {showPrompt && <SecondFactorPrompt />}
      <LinkList title="Richieste in arrivo" links={pendingRequests(links.asCoach)} aal2={aal2} onChanged={onChanged} />
      <LinkList title="I miei atleti" links={activeAthletes(links.asCoach)} aal2={aal2} onChanged={onChanged} />
    </div>
  )
}
