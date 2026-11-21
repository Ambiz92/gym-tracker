import { FormError } from '../../auth/FormParts'
import { RowLink } from '../../components/RowLink'
import { moveSlotToToday, skipSlot } from '../../data/schedule'
import { useAction } from '../../hooks/useAction'
import { dayMonth } from '../../lib/formatDate'
import { resolveSlots, type SlotView } from '../../lib/scheduleStatus'
import type { ScheduledSession } from '../../types/db'
import { describeScheduleError } from '../calendar/errors'
import { isArchived, slotActions } from '../calendar/model'
import { slotStartPath } from '../session/paths'
import { todayBlock } from './model'
import type { TodaySlotsState } from './useTodaySlots'
import '../../styles/calendar.css'
import '../../styles/home.css'

interface TodaySlotsProps {
  schedule: TodaySlotsState
  today: string
  /** Sessions of the active plan that are not archived: the only ones a slot can start. */
  startableSessionIds: ReadonlySet<string>
  /** False on desktop, where sets are not logged. */
  canStart: boolean
}

/** Above the plan on Oggi: today's planned sessions with the start link, then the overdue ones to recover. Renders nothing when there is nothing scheduled. */
export function TodaySlots({ schedule, today, startableSessionIds, canStart }: TodaySlotsProps) {
  const { busy, error, run } = useAction(describeScheduleError)
  if (schedule.status === 'loading') return null
  if (schedule.status === 'error') {
    return (
      <p className="session-note" role="status">
        Non riesco a caricare le sessioni in programma.
      </p>
    )
  }

  const views = resolveSlots(schedule.data.slots, { today, workouts: schedule.data.workouts, startableSessionIds })
  const block = todayBlock(views, today)
  if (block.today.length === 0 && block.overdue.length === 0) return null

  async function act(action: () => Promise<void>, failure: string) {
    if (await run(action, failure)) schedule.reload()
  }

  const renderSlots = (list: SlotView<ScheduledSession>[], detail: (slot: ScheduledSession) => string | undefined) => (
    <ul className="cal-slots">
      {list.map((view) => (
        <SlotRow
          key={view.slot.id}
          view={view}
          today={today}
          detail={detail(view.slot)}
          canStart={canStart}
          busy={busy}
          onMove={() => void act(() => moveSlotToToday(view.slot.id), 'Non riesco a spostare la sessione: riprova.')}
          onSkip={() => void act(() => skipSlot(view.slot.id), 'Non riesco a saltare la sessione: riprova.')}
        />
      ))}
    </ul>
  )

  return (
    <>
      <FormError message={error} />
      {block.today.length > 0 && (
        <section aria-labelledby="home-today-heading">
          <h2 id="home-today-heading" className="session-label">
            In programma oggi
          </h2>
          {renderSlots(block.today, () => undefined)}
        </section>
      )}
      {block.overdue.length > 0 && (
        <section aria-labelledby="home-overdue-heading">
          <h2 id="home-overdue-heading" className="session-label">
            Da recuperare
          </h2>
          {renderSlots(block.overdue, (slot) => `previsto il ${dayMonth(slot.date)}`)}
        </section>
      )}
    </>
  )
}

interface SlotRowProps {
  view: SlotView<ScheduledSession>
  today: string
  detail: string | undefined
  canStart: boolean
  busy: boolean
  onMove: () => void
  onSkip: () => void
}

function SlotRow({ view, today, detail, canStart, busy, onMove, onSkip }: SlotRowProps) {
  const { id, plan_session_id: sessionId, session_name: name } = view.slot
  const actions = slotActions(view, today)
  const archived = isArchived(view)

  return (
    <li>
      {view.startable && canStart && sessionId !== null ? (
        <RowLink to={slotStartPath(sessionId, id)} title={name} detail={detail} tag="Inizia" />
      ) : (
        <div className={archived ? 'cal-slot cal-slot--archived' : 'cal-slot'}>
          <div className="cal-slot__head">
            <span className="cal-slot__name">{name}</span>
            <span className="cal-slot__tags">
              {detail && <span className="cal-tag">{detail}</span>}
              {archived && <span className="cal-tag">archiviata</span>}
            </span>
          </div>
        </div>
      )}
      <div className="cal-slot__actions home-slot__actions">
        {actions.move && (
          <button type="button" className="cal-key" disabled={busy} aria-label={`Sposta a oggi: ${name}`} onClick={onMove}>
            Sposta a oggi
          </button>
        )}
        {actions.skip && (
          <button type="button" className="cal-key" disabled={busy} aria-label={`Salta: ${name}`} onClick={onSkip}>
            Salta
          </button>
        )}
      </div>
    </li>
  )
}
