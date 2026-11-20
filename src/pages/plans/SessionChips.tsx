import '../../styles/builder.css'

interface SessionChipsProps {
  sessions: readonly { id: string; name: string }[]
  selectedId: string | null
  /** A request is in flight: the add key waits. */
  busy: boolean
  onSelect: (id: string) => void
  onAdd: () => void
}

/** The sessions of a plan as keys ("A", "B"), the open one pressed in, and a "+" that adds a session and opens it. */
export function SessionChips({ sessions, selectedId, busy, onSelect, onAdd }: SessionChipsProps) {
  return (
    <div className="builder-chips" role="group" aria-label="Sessioni">
      {sessions.map((session) => (
        <button
          key={session.id}
          type="button"
          className="builder-chip"
          aria-pressed={session.id === selectedId}
          onClick={() => onSelect(session.id)}
        >
          {session.name}
        </button>
      ))}
      <button type="button" className="builder-chip builder-chip--add" aria-label="Aggiungi sessione" disabled={busy} onClick={onAdd}>
        +
      </button>
    </div>
  )
}
