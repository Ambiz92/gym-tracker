interface PlatePillsProps {
  total: number
  /** Pills filled from the start; the next one is the current, lit one. */
  done: number
}

/** Progress as small upright plates: filled when done, lit copper when current, outlined when to do. Decorative: the caller says the same in text. */
export function PlatePills({ total, done }: PlatePillsProps) {
  return (
    <span className="plate-pills" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <i key={index} className={index < done ? 'is-done' : index === done ? 'is-current' : undefined} />
      ))}
    </span>
  )
}
