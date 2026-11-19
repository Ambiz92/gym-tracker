import { useReducer, useState, type ReactNode } from 'react'
import { repsWarning, weightStep } from '../lib/validation'
import { flowReducer, initialFlow, repsStep, resolveValues, type SetValues } from '../lib/setFlow'
import { equipmentLabel, setSummary, unitLabel } from '../lib/sessionProgress'
import type { TargetUnit } from '../types/db'
import { HowToSheet } from './HowToSheet'
import { NumberStepper, StepButton, StepperNumber } from './NumberStepper'
import { PlatePills } from './PlatePills'
import { SaveButton } from './SaveButton'
import { Scene } from './scene/Scene'
import { SessionDock } from './SessionDock'
import { SessionHeader } from './SessionHeader'
import { useLiftConfirm } from './useLiftConfirm'

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

/** One set at a time: the loaded equipment on a platform, giant kg and reps numbers, prefilled, with the confirm button always at the bottom. */
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
  const { lifting, confirm: confirmWithLift } = useLiftConfirm(onConfirm)
  const { values, editing, error } = flow
  const repsName = REPS_NAME[unit]
  const warning = repsWarning(values.reps, unit)
  const weightEditing = editing?.field === 'weight'
  const repsEditing = editing?.field === 'reps'

  function confirm() {
    const resolved = resolveValues(flow)
    if ('error' in resolved) dispatch({ type: 'edit-commit' })
    else confirmWithLift(resolved.values)
  }

  const weightStepKg = weightStep(values.equipment)
  const stepWeight = (delta: number) => dispatch({ type: 'step', field: 'weight', delta })

  return (
    <>
      <div className="logger">
        <span className="logger__dust" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <SessionHeader
          backTo={backTo}
          back={`‹ Es. ${position.current} / ${position.total}`}
          backLabel="Torna alla sessione"
          onBack={onBack}
          end={`Serie ${setNumber} / ${targetSets}`}
          title={exercise.name}
          size="exercise"
          aside={<PlatePills total={Math.max(targetSets, setNumber)} done={setNumber - 1} />}
        />
        <StepperNumber
          label="Peso"
          unit="kg"
          unitSpoken="chilogrammi"
          value={values.weight}
          size="big"
          inputMode="decimal"
          editing={weightEditing ? editing.text : null}
          error={weightEditing ? error : null}
          onEditStart={() => dispatch({ type: 'edit-start', field: 'weight' })}
          onEditText={(text) => dispatch({ type: 'edit-text', text })}
          onCommit={() => dispatch({ type: 'edit-commit' })}
        />
        <p className="set-hint">Tocca il numero per scriverlo</p>
        <Scene
          equipment={values.equipment}
          unit={unit}
          weight={values.weight}
          reps={values.reps}
          onWeight={(value) => dispatch({ type: 'set', field: 'weight', value })}
          onReps={(value) => dispatch({ type: 'set', field: 'reps', value })}
          lifting={lifting}
        />
        <div className="logger__controls">
          <div className="stepper-buttons">
            <StepButton label="Peso" step={weightStepKg} direction="down" variant="pair" onStep={stepWeight} />
            <StepButton label="Peso" step={weightStepKg} direction="up" variant="pair" onStep={stepWeight} />
          </div>
          <NumberStepper
            label={repsName.label}
            unit={unitLabel(unit)}
            unitSpoken={repsName.spoken}
            value={values.reps}
            step={repsStep(unit)}
            inputMode="numeric"
            editing={repsEditing ? editing.text : null}
            error={repsEditing ? error : null}
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
        </div>
      </div>
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
        <SaveButton label={`Conferma serie ${setNumber}`} summary={setSummary(values, unit)} busy={lifting} onClick={confirm} />
      </SessionDock>
    </>
  )
}
