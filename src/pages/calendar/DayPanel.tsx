import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FormError } from '../../auth/FormParts'
import { PrimaryButton } from '../../components/PrimaryButton'
import { deleteSlot, moveSlotToToday, skipSlot } from '../../data/schedule'
import { useAction } from '../../hooks/useAction'
import { dayLabel } from '../../lib/calendar'
import type { DayGroup, SlotView } from '../../lib/scheduleStatus'
import type { ScheduledSession } from '../../types/db'
import { describeScheduleError } from './errors'
import { isArchived, slotActions, stateLabel } from './model'

interface DayPanelProps {
  date: string
  today: string
  group: DayGroup<ScheduledSession> | undefined
  /** False when nothing at all is planned in the visible period: the empty-state sentence replaces the day's own. */
  periodHasSlots: boolean
  /** False without an active plan: there is nothing to pick from. */
  canPlan: boolean
  /** Called after a slot changed, so the calendar reloads. */
  onChanged: () => void
  onPlan: () => void
}

/** The selected day: its slots with the actions each one allows, and the way to plan another. */
export function DayPanel({ date, today, group, periodHasSlots, canPlan, onChanged, onPlan }: DayPanelProps) {
  const { busy, error, run } = useAction(describeScheduleError)
  const [confirming, setConfirming] = useState<string | null>(null)
  const views = group?.views ?? []

  async function act(action: () => Promise<void>, failure: string) {
    if (await run(action, failure)) {
      setConfirming(null)
      onChanged()
    }
  }

  return (
    <section aria-labelledby="cal-day-heading">
      <h2 id="cal-day-heading" className="session-label">
        {dayLabel(date)}
      </h2>
      <FormError message={error} />
      {views.length === 0 ? (
        <p className="session-note">
          {periodHasSlots ? 'Nessuna sessione in questo giorno.' : 'Nessuna sessione in programma. Tocca un giorno per aggiungerne una.'}
        </p>
      ) : (
        <ul className="cal-slots">
          {views.map((view) => (
            <SlotItem
              key={view.slot.id}
              view={view}
              today={today}
              busy={busy}
              confirming={confirming === view.slot.id}
              onConfirm={(on) => setConfirming(on ? view.slot.id : null)}
              onMove={() => void act(() => moveSlotToToday(view.slot.id), 'Non riesco a spostare la sessione: riprova.')}
              onSkip={() => void act(() => skipSlot(view.slot.id), 'Non riesco a saltare la sessione: riprova.')}
              onRemove={() => void act(() => deleteSlot(view.slot.id), 'Non riesco a eliminare la sessione: riprova.')}
            />
          ))}
        </ul>
      )}
      {date >= today &&
        (canPlan ? (
          <div className="cal-day__plan">
            <PrimaryButton variant="outline" disabled={busy} onClick={onPlan}>
              Pianifica
            </PrimaryButton>
          </div>
        ) : (
          <p className="session-note">
            Per pianificare serve una scheda attiva. <Link to="/plans">Vai alle schede</Link>
          </p>
        ))}
    </section>
  )
}

interface SlotItemProps {
  view: SlotView<ScheduledSession>
  today: string
  busy: boolean
  confirming: boolean
  onConfirm: (on: boolean) => void
  onMove: () => void
  onSkip: () => void
  onRemove: () => void
}

function SlotItem({ view, today, busy, confirming, onConfirm, onMove, onSkip, onRemove }: SlotItemProps) {
  const { session_name: name } = view.slot
  const actions = slotActions(view, today)
  const archived = isArchived(view)

  return (
    <li className={archived ? 'cal-slot cal-slot--archived' : 'cal-slot'}>
      <div className="cal-slot__head">
        <span className="cal-slot__name">{name}</span>
        <span className="cal-slot__tags">
          <span className={view.state === 'to_recover' ? 'cal-tag cal-tag--alert' : 'cal-tag'}>{stateLabel(view.state)}</span>
          {archived && <span className="cal-tag">archiviata</span>}
        </span>
      </div>
      {confirming ? (
        <div role="group" aria-label="Conferma eliminazione">
          <p className="session-note">Eliminare «{name}» da questo giorno? Gli allenamenti già fatti non cambiano.</p>
          <div className="cal-slot__actions">
            <button type="button" className="cal-key cal-key--danger" disabled={busy} aria-busy={busy || undefined} onClick={onRemove}>
              Elimina
            </button>
            <button type="button" className="cal-key" disabled={busy} onClick={() => onConfirm(false)}>
              Non eliminare
            </button>
          </div>
        </div>
      ) : (
        <div className="cal-slot__actions">
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
          {actions.remove && (
            <button type="button" className="cal-key cal-key--danger" disabled={busy} aria-label={`Elimina: ${name}`} onClick={() => onConfirm(true)}>
              Elimina
            </button>
          )}
        </div>
      )}
    </li>
  )
}
