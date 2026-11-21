import { periodLabel, type CalendarView } from './model'

interface CalendarToolbarProps {
  view: CalendarView
  selected: string
  onShift: (direction: -1 | 1) => void
  onToday: () => void
  onView: (view: CalendarView) => void
}

const VIEWS: readonly { view: CalendarView; label: string; previous: string; next: string }[] = [
  { view: 'month', label: 'Mese', previous: 'Mese precedente', next: 'Mese successivo' },
  { view: 'week', label: 'Settimana', previous: 'Settimana precedente', next: 'Settimana successiva' },
]

/** Previous/next period with the announced period name, "Oggi", and the month/week switch. */
export function CalendarToolbar({ view, selected, onShift, onToday, onView }: CalendarToolbarProps) {
  const { previous, next } = VIEWS.find((option) => option.view === view)!

  return (
    <div className="cal-toolbar">
      <div className="cal-toolbar__period">
        <button type="button" className="cal-key" aria-label={previous} onClick={() => onShift(-1)}>
          <span aria-hidden="true">←</span>
        </button>
        {/* The one place a period change is announced: RouteAnnouncer only follows route changes. */}
        <p className="cal-toolbar__label" aria-live="polite" aria-atomic="true">
          {periodLabel(view, selected)}
        </p>
        <button type="button" className="cal-key" aria-label={next} onClick={() => onShift(1)}>
          <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className="cal-toolbar__views">
        <button type="button" className="cal-key" aria-label="Vai a oggi" onClick={onToday}>
          Oggi
        </button>
        <div role="group" aria-label="Vista del calendario" className="cal-switch">
          {VIEWS.map((option) => (
            <button
              key={option.view}
              type="button"
              className="segmented__option"
              aria-pressed={option.view === view}
              onClick={() => onView(option.view)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
