interface SaveButtonProps {
  /** "Conferma serie 2". */
  label: string
  /** The set in small caps under the label: "62,5 KG × 8". */
  summary: string
  /** The save animation is running; further taps do nothing. */
  busy: boolean
  onClick: () => void
}

/** The save button of the logger: a dark body with the set written on it and a copper check block. */
export function SaveButton({ label, summary, busy, onClick }: SaveButtonProps) {
  return (
    <button type="button" className="save-button" aria-busy={busy || undefined} onClick={onClick}>
      <span className="save-button__text">
        <span className="save-button__title">{label}</span>{' '}
        <span className="save-button__summary">{summary}</span>
      </span>
      <span className="save-button__check" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
      </span>
    </button>
  )
}
