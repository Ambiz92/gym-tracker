import { PlatePills } from './PlatePills'

interface SessionProgressProps {
  done: number
  total: number
}

/** Plate pills of the completed exercises. */
export function SessionProgress({ done, total }: SessionProgressProps) {
  return (
    <div
      className="session-progress"
      role="progressbar"
      aria-label="Esercizi completati"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={`${done} su ${total}`}
    >
      <PlatePills total={total} done={done} />
    </div>
  )
}
