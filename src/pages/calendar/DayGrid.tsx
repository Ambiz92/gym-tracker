import { useEffect, useRef, type KeyboardEvent } from 'react'
import { WEEKDAY_SHORT, sameMonth } from '../../lib/calendar'
import type { DayGroup, DotKind } from '../../lib/scheduleStatus'
import { keyTarget, dayAriaLabel, periodLabel, type CalendarView } from './model'

interface DayGridProps {
  view: CalendarView
  weeks: readonly string[][]
  selected: string
  today: string
  groups: ReadonlyMap<string, DayGroup>
  onSelect: (date: string) => void
}

/** Month (or one-week) grid, Monday first: one button per day with a dot for its slots; arrows, Page Up/Down and Home/End move the selection. */
export function DayGrid({ view, weeks, selected, today, groups, onSelect }: DayGridProps) {
  const gridRef = useRef<HTMLTableElement>(null)
  const refocus = useRef(false)

  // The selected cell is the only tab stop: after a navigation key it must also take the focus.
  useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus()
  }, [selected])

  function onKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const next = keyTarget(selected, event.key)
    if (next === null) return
    event.preventDefault()
    refocus.current = true
    onSelect(next)
  }

  return (
    <table ref={gridRef} className="cal-grid" onKeyDown={onKeyDown}>
      <caption className="visually-hidden">{periodLabel(view, selected)}</caption>
      <thead>
        <tr>
          {WEEKDAY_SHORT.map((weekday) => (
            <th key={weekday} scope="col">
              {weekday}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]}>
            {week.map((date) => (
              <td key={date}>
                <DayCell
                  date={date}
                  group={groups.get(date)}
                  isSelected={date === selected}
                  isToday={date === today}
                  isOutside={view === 'month' && !sameMonth(date, selected)}
                  onSelect={onSelect}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface DayCellProps {
  date: string
  group: DayGroup | undefined
  isSelected: boolean
  isToday: boolean
  /** A day of the neighbouring month shown as padding. */
  isOutside: boolean
  onSelect: (date: string) => void
}

function DayCell({ date, group, isSelected, isToday, isOutside, onSelect }: DayCellProps) {
  return (
    <button
      type="button"
      className={isOutside ? 'cal-cell cal-cell--outside' : 'cal-cell'}
      aria-label={dayAriaLabel(date, group?.views)}
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onSelect(date)}
    >
      <span className="cal-cell__number" aria-hidden="true">
        {Number(date.slice(8))}
      </span>
      <span className="cal-cell__marker" aria-hidden="true">
        {group && <Dot kind={group.dot} />}
      </span>
    </button>
  )
}

/** Full = done, empty = still to do, struck = skipped: shape carries the meaning, not colour. */
export function Dot({ kind }: { kind: DotKind }) {
  return <span className={`cal-dot cal-dot--${kind}`} />
}
