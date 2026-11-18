import { PrimaryButton } from '../../components/PrimaryButton'
import '../../styles/plans.css'

interface RemoveConfirmProps {
  name: string
  busy: boolean
  onRemove: () => void
  onCancel: () => void
}

/** Second tap before an exercise leaves the session: the remove button sits next to the move buttons. */
export function RemoveConfirm({ name, busy, onRemove, onCancel }: RemoveConfirmProps) {
  return (
    <div role="group" aria-label={`Conferma rimozione di ${name}`} className="plan-editor">
      <p className="plans-note">Rimuovere «{name}» dalla sessione? Lo storico non cambia.</p>
      <div className="plans-actions">
        <PrimaryButton busy={busy} onClick={onRemove}>
          Rimuovi
        </PrimaryButton>
        <PrimaryButton variant="outline" disabled={busy} onClick={onCancel}>
          Non rimuovere
        </PrimaryButton>
      </div>
    </div>
  )
}
