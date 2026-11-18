import '../styles/plans.css'

interface ReorderButtonsProps {
  /** What moves, for assistive tech: "Upper body". */
  name: string
  index: number
  count: number
  disabled?: boolean
  onMove: (offset: -1 | 1) => void
}

/** Up and down buttons of a list row; the first row cannot go up, the last cannot go down. */
export function ReorderButtons({ name, index, count, disabled = false, onMove }: ReorderButtonsProps) {
  return (
    <>
      <button
        type="button"
        className="plan-row__button"
        aria-label={`Sposta su ${name}`}
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="plan-row__button"
        aria-label={`Sposta giù ${name}`}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(1)}
      >
        ↓
      </button>
    </>
  )
}
