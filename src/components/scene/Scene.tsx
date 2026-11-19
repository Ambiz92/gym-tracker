import type { Equipment, TargetUnit } from '../../types/db'
import { BarbellScene } from './BarbellScene'
import { CableScene } from './CableScene'
import { DumbbellScene } from './DumbbellScene'
import { RulerScene } from './RulerScene'

interface SceneProps {
  equipment: Equipment
  unit: TargetUnit
  weight: number
  /** The reps field: seconds or meters on a timed or distance exercise. */
  reps: number
  onWeight: (weightKg: number) => void
  onReps: (value: number) => void
  /** True while the save animation runs: the bar lifts and settles. */
  lifting: boolean
}

function Drawing({ equipment, unit, weight, reps, onWeight, onReps }: Omit<SceneProps, 'lifting'>) {
  // A hold or a carry is logged by time or distance, so the ruler wins whatever the equipment is.
  if (unit !== 'reps') return <RulerScene value={reps} unit={unit} onChange={onReps} />
  if (equipment === 'barbell') return <BarbellScene weight={weight} />
  if (equipment === 'dumbbell') return <DumbbellScene weight={weight} />
  return <CableScene weight={weight} onChange={onWeight} />
}

/** The drawn scene of the set being logged: the ruler for time or distance, otherwise the equipment. */
export function Scene({ lifting, ...drawing }: SceneProps) {
  return (
    <div className={lifting ? 'scene scene--lifting' : 'scene'}>
      <Drawing {...drawing} />
    </div>
  )
}
