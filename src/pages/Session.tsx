import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { PrimaryButton } from '../components/PrimaryButton'
import { RowLink } from '../components/RowLink'
import { UndoToast } from '../components/UndoToast'
import { useAsync } from '../hooks/useAsync'
import { useIsDesktop } from '../hooks/useIsDesktop'
import type { Draft } from '../lib/sessionDraft'
import type { SetValues } from '../lib/setFlow'
import { DesktopSession } from './session/DesktopSession'
import { ExerciseLogger, type RestoredSet } from './session/ExerciseLogger'
import { loadSession, type LoadedSession } from './session/loadSession'
import { sessionPath } from './session/paths'
import { SessionEnd } from './session/SessionEnd'
import { SessionList } from './session/SessionList'
import { sessionStore, useFlushOnMount, useSessionState } from './session/sessionStore'
import '../styles/session.css'

const UNDO_VISIBLE_MS = 8000
// Two confirms this close are a double tap, not two sets.
const DOUBLE_TAP_MS = 600

interface ToastState {
  setId: string
  message: string
}

/** Session of the active plan: exercise list, set logger and end-of-session summary; read-only on desktop. */
export function Session() {
  const { id = '' } = useParams()
  const state = useAsync(() => loadSession(id, sessionStore.getSnapshot().draft?.workoutId), [id])
  const { draft } = useSessionState()
  const isDesktop = useIsDesktop()
  useFlushOnMount()

  if (state.status === 'loading') {
    return <p className="session-note" role="status">Carico la sessione…</p>
  }
  if (state.status === 'error') {
    return (
      <>
        <PageHeader meta="Sessione" title="Non si apre." size="title" />
        <p className="session-error" role="alert">
          Non riesco a caricare la sessione: controlla la connessione. Le serie già registrate restano salvate sul telefono.
        </p>
        <PrimaryButton onClick={state.reload}>Riprova</PrimaryButton>
      </>
    )
  }
  if (!state.data) return <MissingSession sessionId={id} draft={draft} />
  return isDesktop ? <DesktopSession loaded={state.data} /> : <OpenSession loaded={state.data} draft={draft} />
}

function MissingSession({ sessionId, draft }: { sessionId: string; draft: Draft | null }) {
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const hasOpenDraft = draft?.sessionId === sessionId

  async function close() {
    setFailed(false)
    if (await sessionStore.finish('')) navigate('/')
    else setFailed(true)
  }

  return (
    <>
      <PageHeader meta="Sessione" title="Non trovata." size="title" />
      <p className="session-note">Questa sessione non fa parte della scheda attiva.</p>
      {failed && (
        <p className="session-error" role="alert">
          Non sono riuscito a chiuderla: riprova con la connessione attiva.
        </p>
      )}
      {hasOpenDraft && <PrimaryButton onClick={() => void close()}>Chiudi la sessione aperta</PrimaryButton>}
      <RowLink to="/" title="Torna a Oggi" />
    </>
  )
}

function OpenSession({ loaded, draft }: { loaded: LoadedSession; draft: Draft | null }) {
  const { session } = loaded
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [restored, setRestored] = useState<RestoredSet | null>(null)
  const lastConfirmAt = useRef(0)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), UNDO_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [toast])

  function confirm(exerciseId: string, values: SetValues) {
    const now = Date.now()
    if (now - lastConfirmAt.current < DOUBLE_TAP_MS) return
    lastConfirmAt.current = now

    const planExercise = session.exercises.find((candidate) => candidate.exercise_id === exerciseId)
    if (!planExercise) return
    const set = sessionStore.confirmSet(
      { id: session.id, name: session.name },
      { exerciseId, reps: values.reps, weightKg: values.weight, equipment: values.equipment },
    )
    setRestored(null)
    setToast({ setId: set.id, message: `Serie ${set.setNumber} salvata` })

    const finished = set.setNumber >= planExercise.target_sets
    sessionStore.setCurrentExercise(finished ? null : exerciseId)
    if (finished) navigate(sessionPath(session.id), { replace: true })
  }

  function undo(setId: string) {
    const set = sessionStore.undoSet(setId)
    setToast(null)
    if (set) {
      setRestored({
        exerciseId: set.exerciseId,
        setNumber: set.setNumber,
        values: { weight: set.weightKg, reps: set.reps, equipment: set.equipment },
      })
    }
  }

  if (draft && draft.sessionId !== session.id) return <OtherSessionOpen draft={draft} requested={session.name} />
  if (params.has('fine')) return <SessionEnd loaded={loaded} draft={draft} />

  const toastView = toast && <UndoToast message={toast.message} onUndo={() => undo(toast.setId)} />
  const exerciseId = params.get('es')
  if (exerciseId && session.exercises.some((candidate) => candidate.exercise_id === exerciseId)) {
    return <ExerciseLogger loaded={loaded} exerciseId={exerciseId} draft={draft} restored={restored} toast={toastView} onConfirm={confirm} />
  }
  return <SessionList loaded={loaded} draft={draft} toast={toastView} />
}

function OtherSessionOpen({ draft, requested }: { draft: Draft; requested: string }) {
  return (
    <>
      <PageHeader meta="Sessione" title={requested} size="title" />
      <p className="session-note">Hai già una sessione aperta. Chiudila prima di iniziarne un&apos;altra.</p>
      <RowLink
        to={sessionPath(draft.sessionId, draft.currentExerciseId)}
        title={`${draft.sessionName} in corso`}
        tag="Riprendi →"
        inverted
      />
    </>
  )
}
