import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LoadedSession } from './loadSession'
import { SessionSummary } from '../../components/SessionSummary'
import type { Draft } from '../../lib/sessionDraft'
import { buildSummary } from '../../lib/sessionProgress'
import { sessionPath } from './paths'
import { sessionStore } from './sessionStore'

// Matches the database check on workout.notes.
const MAX_NOTES_LENGTH = 2000

interface SessionEndProps {
  loaded: LoadedSession
  draft: Draft | null
}

/** Summary of the session; "Fine" sends what is left, saves the note and closes the draft. */
export function SessionEnd({ loaded, draft }: SessionEndProps) {
  const { session, lastSets } = loaded
  const navigate = useNavigate()
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [minutes] = useState(() => (draft ? Math.max(1, Math.round((Date.now() - draft.startedAt) / 60_000)) : 0))

  const rows = draft
    ? buildSummary(
        draft,
        session.exercises.map(({ exercise_id, exercise }) => ({
          exerciseId: exercise_id,
          name: exercise.name,
          lastSets: lastSets.get(exercise_id) ?? [],
        })),
      )
    : []

  async function finish() {
    setBusy(true)
    setFailed(false)
    if (await sessionStore.finish(notes)) {
      navigate('/')
      return
    }
    setBusy(false)
    setFailed(true)
  }

  return (
    <SessionSummary
      sessionName={session.name}
      backTo={sessionPath(session.id)}
      minutes={minutes}
      rows={rows}
      notes={notes}
      onNotes={(text) => setNotes(text.slice(0, MAX_NOTES_LENGTH))}
      busy={busy}
      failed={failed}
      onFinish={() => void finish()}
    />
  )
}
