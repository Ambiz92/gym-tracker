import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { FormError } from '../../auth/FormParts'
import { PrimaryButton } from '../../components/PrimaryButton'
import { useAction } from '../../hooks/useAction'
import { MAX_REPEAT_WEEKS } from '../../lib/calendar'
import '../../styles/calendar.css'
import { describeScheduleError } from './errors'
import { dateProblem, saveSchedule } from './saveSchedule'

const WEEK_OPTIONS = Array.from({ length: MAX_REPEAT_WEEKS }, (_, index) => index + 1)

export interface PickableSession {
  id: string
  name: string
}

interface SchedulePickerProps {
  /** The non-archived sessions of the active plan: the only ones that can be planned. */
  sessions: readonly PickableSession[]
  /** Day proposed in the date field. */
  date: string
  today: string
  /** Session proposed first (e.g. the one open in the plan editor); defaults to the first. */
  sessionId?: string
  /** Called once the slots are saved, before the sheet closes: the caller reloads what it shows. */
  onSaved: () => void
  onClose: () => void
}

/** Bottom sheet that plans a session of the active plan on a day, optionally repeating it for N weeks. */
export function SchedulePicker({ sessions, date: initialDate, today, sessionId, onSaved, onClose }: SchedulePickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const ids = { title: useId(), session: useId(), date: useId(), weeks: useId(), weeksHint: useId(), dateError: useId() }
  const [chosenId, setChosenId] = useState(sessionId ?? sessions[0]?.id ?? '')
  const [date, setDate] = useState(initialDate)
  const [weeks, setWeeks] = useState(1)
  const [showProblem, setShowProblem] = useState(false)
  const { busy, error, run } = useAction(describeScheduleError)
  const problem = showProblem ? dateProblem(date, today) : null

  // A native modal dialog traps focus, closes on Escape and gives focus back to the opener.
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const session = sessions.find((candidate) => candidate.id === chosenId)
    if (!session || dateProblem(date, today)) {
      setShowProblem(true)
      return
    }
    const saved = await run(() => saveSchedule(session, date, weeks), 'Non riesco a pianificare: controlla la connessione e riprova.')
    if (!saved) return
    onSaved()
    dialogRef.current?.close()
  }

  return (
    <dialog
      ref={dialogRef}
      className="how-to"
      aria-labelledby={ids.title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <form className="how-to__body" onSubmit={(event) => void submit(event)} noValidate>
        <div className="how-to__meta">
          <span>Calendario</span>
          <button type="button" className="how-to__close" onClick={() => dialogRef.current?.close()}>
            Chiudi
          </button>
        </div>
        <h2 id={ids.title} className="how-to__title">
          Pianifica una sessione
        </h2>
        {sessions.length === 0 ? (
          <p className="how-to__empty">La scheda attiva non ha sessioni da pianificare.</p>
        ) : (
          <>
            <div className="field">
              <label className="field__label" htmlFor={ids.session}>
                Sessione
              </label>
              <select id={ids.session} className="field__input" value={chosenId} onChange={(event) => setChosenId(event.target.value)}>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={ids.date}>
                Giorno
              </label>
              <input
                id={ids.date}
                className="field__input"
                type="date"
                min={today}
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? ids.dateError : undefined}
              />
              {problem && (
                <p id={ids.dateError} className="field__message field__message--error">
                  {problem}
                </p>
              )}
            </div>
            <div className="field">
              <label className="field__label" htmlFor={ids.weeks}>
                Ripetizione
              </label>
              <select
                id={ids.weeks}
                className="field__input"
                value={weeks}
                aria-describedby={weeks > 1 ? ids.weeksHint : undefined}
                onChange={(event) => setWeeks(Number(event.target.value))}
              >
                {WEEK_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {count === 1 ? 'Solo questo giorno' : `Ripeti per ${count} settimane`}
                  </option>
                ))}
              </select>
              {weeks > 1 && (
                <p id={ids.weeksHint} className="field__message">
                  Una sessione a settimana, nello stesso giorno, per {weeks} settimane: questa è la prima.
                </p>
              )}
            </div>
            <FormError message={error} />
            <div className="schedule-picker__actions">
              <PrimaryButton type="submit" busy={busy}>
                {weeks > 1 ? `Pianifica ${weeks} sessioni` : 'Pianifica'}
              </PrimaryButton>
            </div>
          </>
        )}
      </form>
    </dialog>
  )
}
