import { FormError } from '../../../auth/FormParts'
import { PrimaryButton } from '../../../components/PrimaryButton'
import { revokeLink } from '../../../data/coachLinks'
import { useAction } from '../../../hooks/useAction'
import type { CoachLink } from '../../../types/db'
import { describeCoachLinkError } from '../../dataErrors'

interface RevokeLinkProps {
  link: CoachLink
  /** Called after the link was revoked, so the links reload. */
  onChanged: () => void
}

/** The revoke of an open link, open to both sides: one tap, no confirmation step, with the failure of the last try. */
export function RevokeLink({ link, onChanged }: RevokeLinkProps) {
  const { busy, error, run } = useAction(describeCoachLinkError)

  async function revoke() {
    if (await run(() => revokeLink(link.id), 'Non riesco a revocare l’accesso: riprova.')) onChanged()
  }

  return (
    <div className="coach-actions">
      <PrimaryButton variant="outline" busy={busy} onClick={() => void revoke()}>
        Revoca l’accesso
      </PrimaryButton>
      <FormError message={error} />
    </div>
  )
}
