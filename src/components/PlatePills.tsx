interface PlatePillsProps {
  done: number
  total: number
}

/** One pill per step: filled when done, lit when it is the current one, outline when still to do. Decorative: the caller states the count in text. */
export function PlatePills({ done, total }: PlatePillsProps) {
  return (
    <span className="plate-pills" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={pillClass(index, done)} />
      ))}
    </span>
  )
}

function pillClass(index: number, done: number): string {
  if (index < done) return 'plate-pill plate-pill--done'
  return index === done ? 'plate-pill plate-pill--current' : 'plate-pill'
}
