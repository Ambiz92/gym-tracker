export type HistoryView = 'exercises' | 'sessions'

const OPTIONS: readonly { view: HistoryView; label: string }[] = [
  { view: 'exercises', label: 'Per esercizio' },
  { view: 'sessions', label: 'Per sessione' },
]

interface ViewSwitchProps {
  value: HistoryView
  onChange: (view: HistoryView) => void
}

/** Two-segment toggle between the history grouped by exercise and by session. */
export function ViewSwitch({ value, onChange }: ViewSwitchProps) {
  return (
    <div role="group" aria-label="Raggruppa lo storico" className="history-switch">
      {OPTIONS.map(({ view, label }) => (
        <button
          key={view}
          type="button"
          className="history-switch__option"
          aria-pressed={view === value}
          onClick={() => onChange(view)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
