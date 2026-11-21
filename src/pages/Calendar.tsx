import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PrimaryButton } from '../components/PrimaryButton'
import { Skeleton } from '../components/Skeleton'
import { weekdayDayMonth } from '../lib/formatDate'
import { localDateString } from '../lib/localDate'
import { CalendarToolbar } from './calendar/CalendarToolbar'
import { DayGrid, Dot } from './calendar/DayGrid'
import { DayPanel } from './calendar/DayPanel'
import { gridWeeks, shiftPeriod, visibleRange, type CalendarView } from './calendar/model'
import { SchedulePicker } from './calendar/SchedulePicker'
import { useCalendarData } from './calendar/useCalendarData'
import '../styles/calendar.css'

/** Calendario tab: month grid (or week strip) with a dot per day, the selected day below, and the picker to plan more. */
export function Calendar() {
  const today = localDateString(new Date())
  const [view, setView] = useState<CalendarView>('month')
  const [selected, setSelected] = useState(today)
  const [planning, setPlanning] = useState(false)
  const weeks = gridWeeks(view, selected)
  const { from, to } = visibleRange(weeks)
  const data = useCalendarData(from, to, today)
  const groups = data.status === 'error' ? new Map() : data.groups

  return (
    <>
      <PageHeader meta="Gym Tracker" metaEnd={weekdayDayMonth(new Date())} title="Calendario" size="title" />
      <CalendarToolbar
        view={view}
        selected={selected}
        onShift={(direction) => setSelected(shiftPeriod(view, selected, direction, today))}
        onToday={() => setSelected(today)}
        onView={setView}
      />
      <DayGrid view={view} weeks={weeks} selected={selected} today={today} groups={groups} onSelect={setSelected} />
      <Legend />
      {data.status === 'error' ? (
        <LoadError error={data.error} onRetry={data.retry} />
      ) : !data.loaded ? (
        <Skeleton label="Carico il calendario…" rows={2} />
      ) : (
        <DayPanel
          date={selected}
          refreshing={data.status === 'loading'}
          today={today}
          group={data.groups.get(selected)}
          periodHasSlots={data.groups.size > 0}
          canPlan={data.hasPlan}
          onChanged={data.reload}
          onPlan={() => setPlanning(true)}
        />
      )}
      {planning && data.status !== 'error' && (
        <SchedulePicker
          sessions={data.sessions}
          date={selected}
          today={today}
          onSaved={data.reload}
          onClose={() => setPlanning(false)}
        />
      )}
    </>
  )
}

function Legend() {
  return (
    <ul className="cal-legend" aria-label="Legenda">
      <li>
        <Dot kind="full" /> fatta
      </li>
      <li>
        <Dot kind="empty" /> in programma
      </li>
      <li>
        <Dot kind="struck" /> saltata
      </li>
    </ul>
  )
}

function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div role="alert" className="error-state">
      <p>Non riesco a caricare il calendario. Le tue sessioni non sono state toccate.</p>
      <p className="error-state__detail">{error.message}</p>
      <PrimaryButton variant="outline" onClick={onRetry}>
        Riprova
      </PrimaryButton>
    </div>
  )
}
