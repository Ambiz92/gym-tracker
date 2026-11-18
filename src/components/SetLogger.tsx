import { useReducer, useState, type ReactNode } from 'react'
import { repsWarning, weightStep } from '../lib/validation'
import { flowReducer, initialFlow, repsStep, resolveValues, type SetValues } from '../lib/setFlow'
import { equipmentLabel, unitLabel } from '../lib/sessionProgress'
import type { TargetUnit } from '../types/db'
import { HowToSheet } from './HowToSheet'
import { NumberStepper } from './NumberStepper'
import { PrimaryButton } from './PrimaryButton'
import { SessionDock } from './SessionDock'
import { SessionHeader } from './SessionHeader'

const REPS_NAME: Record<TargetUnit, { label: string; spoken: string }> = {
  reps: { label: 'Ripetizioni', spoken: 'ripetizioni' },
  seconds: { label: 'Secondi', spoken: 'secondi' },
  meters: { label: 'Metri', spoken: 'metri' },
}

interface SetLoggerProps {
  exercise: { name: string; muscles: string | null; executionSteps: string | null }
  unit: TargetUnit
  /** Number of the set about to be logged. */
  setNumber: number
  targetSets: number
  position: { current: number; total: number }
  initial: SetValues
  /** "Ultima volta 12,5 kg × 10 · suggerito 15 ↑". */
  hint: string
  backTo: string
  onBack: () => void
  toast: ReactNode
  onConfirm: (values: SetValues) => void
}

/** One set at a time: giant kg and reps numbers, prefilled, with the confirm button always at the bottom. */
export function SetLogger({
  exercise,
  unit,
  setNumber,
  targetSets,
  position,
  initial,
  hint,
  backTo,
  onBack,
  toast,
  onConfirm,
}: SetLoggerProps) {
  const [flow, dispatch] = useReducer(flowReducer, initial, initialFlow)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { values, editing, error } = flow
  const repsName = REPS_NAME[unit]
  const warning = repsWarning(values.reps, unit)

  function confirm() {
    const resolved = resolveValues(flow)
    if ('error' in resolved) dispatch({ type: 'edit-commit' })
    else onConfirm(resolved.values)
  }

  return (
    <>
      <SessionHeader
        backTo={backTo}
        back={`‹ Es. ${position.current} / ${position.total}`}
        backLabel="Torna alla sessione"
        onBack={onBack}
        end={`Serie ${setNumber} / ${targetSets}`}
        title={exercise.name}
        size="exercise"
      />
      <div className="set-squares" aria-hidden="true">
        {Array.from({ length: Math.max(targetSets, setNumber) }, (_, index) => (
          <i key={index} className={index + 1 < setNumber ? 'is-done' : index + 1 === setNumber ? 'is-current' : undefined} />
        ))}
      </div>
      <NumberStepper
        label="Peso"
        unit="kg"
        unitSpoken="chilogrammi"
        value={values.weight}
        step={weightStep(values.equipment)}
        size="big"
        inputMode="decimal"
        editing={editing?.field === 'weight' ? editing.text : null}
        error={editing?.field === 'weight' ? error : null}
        onStep={(delta) => dispatch({ type: 'step', field: 'weight', delta })}
        onEditStart={() => dispatch({ type: 'edit-start', field: 'weight' })}
        onEditText={(text) => dispatch({ type: 'edit-text', text })}
        onCommit={() => dispatch({ type: 'edit-commit' })}
      />
      <p className="set-hint">Tocca il numero per scriverlo</p>
      <NumberStepper
        label={repsName.label}
        unit={unitLabel(unit)}
        unitSpoken={repsName.spoken}
        value={values.reps}
        step={repsStep(unit)}
        size="medium"
        inputMode="numeric"
        editing={editing?.field === 'reps' ? editing.text : null}
        error={editing?.field === 'reps' ? error : null}
        onStep={(delta) => dispatch({ type: 'step', field: 'reps', delta })}
        onEditStart={() => dispatch({ type: 'edit-start', field: 'reps' })}
        onEditText={(text) => dispatch({ type: 'edit-text', text })}
        onCommit={() => dispatch({ type: 'edit-commit' })}
      />
      <div role="status">
        {warning && (
          <div className="set-warning">
            <b>{warning}</b>
            Va bene? Puoi salvare lo stesso.
          </div>
        )}
      </div>
      <p className="set-last">{hint}</p>
      <button type="button" className="set-how-to" onClick={() => setSheetOpen(true)}>
        <span>Come si esegue · {equipmentLabel(values.equipment)}</span>
        <span aria-hidden="true">→</span>
      </button>
      {sheetOpen && (
        <HowToSheet
          name={exercise.name}
          muscles={exercise.muscles}
          executionSteps={exercise.executionSteps}
          equipment={values.equipment}
          onEquipment={(equipment) => dispatch({ type: 'equipment', equipment })}
          onClose={() => setSheetOpen(false)}
        />
      )}
      <SessionDock toast={toast}>
        <PrimaryButton onClick={confirm}>{`Conferma serie ${setNumber}`}</PrimaryButton>
      </SessionDock>
    </>
  )
}
