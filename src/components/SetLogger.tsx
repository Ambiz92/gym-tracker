import { useReducer, useState, type ReactNode } from 'react'
import { formatNumber } from '../lib/formatNumber'
import { perSideFromTotal } from '../lib/plates'
import { repsWarning, weightStep } from '../lib/validation'
import { flowReducer, initialFlow, repsStep, resolveValues, type Field, type SetValues } from '../lib/setFlow'
import { barbellTotalNote, equipmentLabel, setSummary, unitLabel } from '../lib/sessionProgress'
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

interface NumberView {
  field: Field
  label: string
  unit: string
  unitSpoken: string
  inputMode: 'decimal' | 'numeric'
  /** How far one press of the step buttons moves the number. */
  step: number
  /** The step spelled out when it is not plain kg of the number shown, e.g. "1,25 chili per lato". */
  stepSpoken?: string
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

/** One set at a time: the loaded equipment on a platform, a giant number and a medium one, prefilled, with the confirm button always at the bottom. */
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

  function confirm() {
    const resolved = resolveValues(flow)
    if ('error' in resolved) dispatch({ type: 'edit-commit' })
    else confirmWithLift(resolved.values)
  }

  // On a barbell the weight is shown, stepped and typed for one side; the reducer keeps the total.
  const barbell = values.equipment === 'barbell'
  const weightStepKg = weightStep(values.equipment)
  const weightView: NumberView = {
    field: 'weight',
    label: barbell ? 'Peso per lato' : 'Peso',
    unit: 'kg',
    unitSpoken: 'chilogrammi',
    inputMode: 'decimal',
    step: weightStepKg,
    stepSpoken: barbell ? `${formatNumber(weightStepKg)} chili per lato` : undefined,
  }
  const repsView: NumberView = {
    field: 'reps',
    label: repsName.label,
    unit: unitLabel(unit),
    unitSpoken: repsName.spoken,
    inputMode: 'numeric',
    step: repsStep(unit),
  }
  // The number being logged is the giant one: the weight, or the seconds or meters of a hold or a carry.
  const [main, side] = unit === 'reps' ? [weightView, repsView] : [repsView, weightView]

  const numberProps = (view: NumberView) => {
    const typing = editing?.field === view.field
    return {
      label: view.label,
      unit: view.unit,
      unitSpoken: view.unitSpoken,
      inputMode: view.inputMode,
      value: view.field === 'weight' && barbell ? perSideFromTotal(values.weight) : values[view.field],
      editing: typing ? editing.text : null,
      error: typing ? error : null,
      onEditStart: () => dispatch({ type: 'edit-start', field: view.field }),
      onEditText: (text: string) => dispatch({ type: 'edit-text', text }),
      onCommit: () => dispatch({ type: 'edit-commit' }),
    }
  }
  const totalNote = barbell && (
    <p className="set-total">{barbellTotalNote(values.weight)}</p>
  )
  const stepOf = (view: NumberView) => (delta: number) => dispatch({ type: 'step', field: view.field, delta })

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
        {/* The saved values are fixed when the lift starts, so nothing is editable until it settles. */}
        <div inert={lifting}>
          <StepperNumber {...numberProps(main)} size="big" />
          <p className="set-hint">{main === weightView && barbell ? 'Peso per lato · tocca il numero per scriverlo' : 'Tocca il numero per scriverlo'}</p>
          {main === weightView && totalNote}
        </div>
        <Scene
          equipment={values.equipment}
          unit={unit}
          weight={values.weight}
          reps={values.reps}
          onWeight={(value) => dispatch({ type: 'set', field: 'weight', value })}
          onReps={(value) => dispatch({ type: 'set', field: 'reps', value })}
          lifting={lifting}
        />
        <div className="logger__controls" inert={lifting}>
          <div className="stepper-buttons">
            <StepButton label={main.label} step={main.step} stepSpoken={main.stepSpoken} direction="down" variant="pair" onStep={stepOf(main)} />
            <StepButton label={main.label} step={main.step} stepSpoken={main.stepSpoken} direction="up" variant="pair" onStep={stepOf(main)} />
          </div>
          <NumberStepper {...numberProps(side)} step={side.step} stepSpoken={side.stepSpoken} onStep={stepOf(side)} />
          {side === weightView && totalNote}
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
