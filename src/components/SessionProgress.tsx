interface SessionProgressProps {
  done: number
  total: number
}

/** Bar of completed exercises. */
export function SessionProgress({ done, total }: SessionProgressProps) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
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
      <div className="session-progress__fill" style={{ width: `${percent}%` }} />
    </div>
  )
}
