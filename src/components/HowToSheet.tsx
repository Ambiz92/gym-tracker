import { useEffect, useId, useRef } from 'react'
import { equipmentLabel, splitSteps } from '../lib/sessionProgress'
import type { Equipment } from '../types/db'

const EQUIPMENT: readonly Equipment[] = ['barbell', 'dumbbell', 'other']

interface HowToSheetProps {
  name: string
  muscles: string | null
  executionSteps: string | null
  equipment: Equipment
  onEquipment: (equipment: Equipment) => void
  onClose: () => void
}

/** Bottom sheet with muscles and execution steps, plus the equipment used for this exercise's sets. */
export function HowToSheet({ name, muscles, executionSteps, equipment, onEquipment, onClose }: HowToSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const steps = splitSteps(executionSteps)

  // A native modal dialog traps focus, closes on Escape and gives focus back to the opener.
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="how-to"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <div className="how-to__body">
        <div className="page-header__meta how-to__meta">
          <span>Come si esegue</span>
          <button type="button" className="how-to__close" onClick={() => dialogRef.current?.close()}>
            Chiudi
          </button>
        </div>
        <h2 id={titleId} className="how-to__title">
          {name}
        </h2>
        {muscles && <p className="page-header__subtitle">{muscles}</p>}
        {steps.length > 0 ? (
          <ol className="how-to__steps">
            {steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        ) : (
          <p className="how-to__empty">Nessuna indicazione scritta per questo esercizio.</p>
        )}
        <div role="group" aria-label="Attrezzo per le serie di questo esercizio">
          <p className="how-to__label">Attrezzo</p>
          <div className="segmented">
            {EQUIPMENT.map((option) => (
              <button key={option} type="button" aria-pressed={option === equipment} onClick={() => onEquipment(option)}>
                {equipmentLabel(option)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </dialog>
  )
}
