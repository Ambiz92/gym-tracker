import { formatNumber } from '../lib/formatNumber'
import type { SummaryRow } from '../lib/sessionProgress'
import { Field } from './Field'
import { PrimaryButton } from './PrimaryButton'
import { SessionDock } from './SessionDock'
import { SessionHeader } from './SessionHeader'

interface SessionSummaryProps {
  sessionName: string
  backTo: string
  minutes: number
  rows: readonly SummaryRow[]
  notes: string
  onNotes: (notes: string) => void
  busy: boolean
  failed: boolean
  onFinish: () => void
}

function describeDelta(deltaKg: number | null): { text: string; spoken: string; accent: boolean } {
  if (deltaKg === null) return { text: 'nuovo', spoken: 'primo allenamento', accent: false }
  if (deltaKg === 0) return { text: '=', spoken: 'stesso peso', accent: false }
  const amount = formatNumber(Math.abs(deltaKg))
  return deltaKg > 0
    ? { text: `+${amount}`, spoken: `${amount} kg in più dell'ultima volta`, accent: true }
    : { text: `−${amount}`, spoken: `${amount} kg in meno dell'ultima volta`, accent: false }
}

/** End of the session: what changed since last time, an optional note, and the button that closes it. */
export function SessionSummary({ sessionName, backTo, minutes, rows, notes, onNotes, busy, failed, onFinish }: SessionSummaryProps) {
  const totalSets = rows.reduce((sum, row) => sum + row.sets, 0)

  return (
    <>
      <SessionHeader
        backTo={backTo}
        back={`‹ ${sessionName}`}
        backLabel="Torna alla sessione"
        end={`${minutes} min`}
        title="Sessione chiusa."
        subtitle={`${rows.length} ${rows.length === 1 ? 'esercizio' : 'esercizi'} · ${totalSets} serie`}
      />
      {rows.length === 0 ? (
        <p className="session-note">Nessuna serie registrata: la sessione non verrà salvata.</p>
      ) : (
        <>
          <h2 className="session-label">Progressi di oggi</h2>
          <ul className="summary-list">
            {rows.map((row) => {
              const delta = describeDelta(row.deltaKg)
              return (
                <li key={row.exerciseId} className="summary-row">
                  <span>
                    <span className="summary-row__name">{row.name}</span>
                    <small>{formatNumber(row.weightKg)} kg</small>
                  </span>
                  <span className={delta.accent ? 'summary-row__chip summary-row__chip--up' : 'summary-row__chip'}>
                    <span aria-hidden="true">{delta.text}</span>
                    <span className="session-vh">{delta.spoken}</span>
                  </span>
                </li>
              )
            })}
          </ul>
          <Field label="Note (facoltativo)" value={notes} onChange={onNotes} placeholder="Come è andata?" enterKeyHint="done" />
        </>
      )}
      {failed && (
        <p className="session-error" role="alert">
          Non sono riuscito a chiudere la sessione. Le serie restano salvate sul telefono: controlla la connessione e riprova.
        </p>
      )}
      <SessionDock>
        <PrimaryButton onClick={onFinish} busy={busy}>
          Fine
        </PrimaryButton>
      </SessionDock>
    </>
  )
}
