import { useState } from 'react'
import { PrimaryButton } from '../../components/PrimaryButton'
import '../../styles/plans.css'

interface SessionRemoveProps {
  name: string
  busy: boolean
  /** Failure of the last removal, announced to screen readers. */
  error: string | null
  onRemove: () => void
}

/** Removes a session from its plan after a confirmation; one with logged workouts is refused by the data layer. */
export function SessionRemove({ name, busy, error, onRemove }: SessionRemoveProps) {
  const [confirming, setConfirming] = useState(false)

  return (
    <section aria-labelledby="session-remove-heading">
      <h2 id="session-remove-heading" className="plans-label">
        Rimuovi sessione
      </h2>
      {error && (
        <p role="alert" className="plans-error">
          {error}
        </p>
      )}
      {confirming ? (
        <div role="group" aria-label="Conferma rimozione">
          <p className="plans-note">Rimuovere «{name}» e i suoi esercizi dalla scheda? Non si può annullare.</p>
          <div className="plans-actions">
            <PrimaryButton busy={busy} onClick={onRemove}>
              Rimuovi definitivamente
            </PrimaryButton>
            <PrimaryButton variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Non rimuovere
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <button type="button" className="plans-danger" disabled={busy} onClick={() => setConfirming(true)}>
          Rimuovi la sessione
        </button>
      )}
    </section>
  )
}
