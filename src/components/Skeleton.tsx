interface SkeletonProps {
  /** What is loading, announced to screen readers instead of the placeholder rows. */
  label: string
  rows?: number
}

/** Placeholder rows with the height of the list that replaces them, so the layout does not jump. */
export function Skeleton({ label, rows = 3 }: SkeletonProps) {
  return (
    <div role="status" className="skeleton">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="skeleton__row" aria-hidden="true" />
      ))}
    </div>
  )
}
