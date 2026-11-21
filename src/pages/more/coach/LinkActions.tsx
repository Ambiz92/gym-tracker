import { FormError } from '../../../auth/FormParts'
import { PrimaryButton } from '../../../components/PrimaryButton'
import { acceptLink, revokeLink } from '../../../data/coachLinks'
import { useAction } from '../../../hooks/useAction'
import { actionLabel, allowedActions, type LinkAction, type LinkRole, needsSecondFactor } from '../../../lib/coachLink'
import type { CoachLink } from '../../../types/db'
import { describeCoachLinkError } from '../../dataErrors'

const FAILURES: Record<LinkAction, string> = {
  accept: 'Non riesco ad accettare la richiesta: riprova.',
  decline: 'Non riesco a rifiutare la richiesta: riprova.',
  revoke: 'Non riesco a revocare l’accesso: riprova.',
}

interface LinkActionsProps {
  link: CoachLink
  role: LinkRole
  /** The accept is offered only at aal2; while it is unknown or false the button stays disabled. */
  aal2: boolean | null
  /** Called after the status changed, so the links reload. */
  onChanged: () => void
}

/** The buttons a side may press on a link (one tap each, no confirmation step), with the failure of the last one. */
export function LinkActions({ link, role, aal2, onChanged }: LinkActionsProps) {
  const { busy, error, run } = useAction(describeCoachLinkError)

  async function perform(action: LinkAction) {
    const change = action === 'accept' ? () => acceptLink(link.id) : () => revokeLink(link.id)
    if (await run(change, FAILURES[action])) onChanged()
  }

  return (
    <div className="coach-actions">
      {allowedActions(role, link.status).map((action) => (
        <PrimaryButton
          key={action}
          variant={action === 'accept' ? 'solid' : 'outline'}
          busy={busy}
          disabled={needsSecondFactor(action) && aal2 !== true}
          onClick={() => void perform(action)}
        >
          {actionLabel(action, role, link.status)}
        </PrimaryButton>
      ))}
      <FormError message={error} />
    </div>
  )
}
