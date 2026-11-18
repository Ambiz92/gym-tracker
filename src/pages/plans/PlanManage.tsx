import { useState } from 'react'
import { PrimaryButton } from '../../components/PrimaryButton'
import '../../styles/plans.css'

interface PlanManageProps {
  name: string
  archived: boolean
  busy: boolean
  /** Failure of the last archive, restore or delete, announced to screen readers. */
  error: string | null
  onArchive: (archived: boolean) => void
  onDelete: () => void
}

/** Archive or restore a plan, or delete it for good after a confirmation. */
export function PlanManage({ name, archived, busy, error, onArchive, onDelete }: PlanManageProps) {
  const [confirming, setConfirming] = useState(false)

  return (
    <section aria-labelledby="plan-manage-heading">
      <h2 id="plan-manage-heading" className="plans-label">
        Archivia o elimina
      </h2>
      <p className="plans-note">
        Con uno storico una scheda non si cancella: si archivia. Sparisce da Oggi, ma i dati restano e puoi ripristinarla.
      </p>
      {error && (
        <p role="alert" className="plans-error">
          {error}
        </p>
      )}
      <div className="plans-actions">
        <PrimaryButton variant="outline" disabled={busy} onClick={() => onArchive(!archived)}>
          {archived ? 'Ripristina' : 'Archivia'}
        </PrimaryButton>
        {confirming ? (
          <div role="group" aria-label="Conferma eliminazione">
            <p className="plans-note">Eliminare «{name}» per sempre? Non si può annullare.</p>
            <div className="plans-actions">
              <PrimaryButton busy={busy} onClick={onDelete}>
                Elimina definitivamente
              </PrimaryButton>
              <PrimaryButton variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
                Non eliminare
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <button type="button" className="plans-danger" disabled={busy} onClick={() => setConfirming(true)}>
            Elimina scheda
          </button>
        )}
      </div>
    </section>
  )
}
