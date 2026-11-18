import { useState } from 'react'
import { ExerciseForm } from '../../components/ExerciseForm'
import { ExercisePicker } from '../../components/ExercisePicker'
import { PageHeader } from '../../components/PageHeader'
import { PrimaryButton } from '../../components/PrimaryButton'
import { listExercises } from '../../data/exercises'
import { useAsync } from '../../hooks/useAsync'
import { emptyForm } from '../../lib/exerciseForm'
import type { Exercise, ExerciseInsert } from '../../types/db'
import { LoadState } from '../history/LoadState'
import '../../styles/plans.css'

interface AddExerciseProps {
  sessionName: string
  /** Exercises already in the session: hidden from the picker. */
  excludeIds: readonly string[]
  busy: boolean
  /** Failure of the last add, announced to screen readers. */
  error: string | null
  /** Confirmation of the last add, announced politely. */
  notice: string | null
  onPick: (exercise: Exercise) => void
  /** Creates the exercise in the library and adds it to the session. */
  onCreate: (exercise: ExerciseInsert) => void
  onClose: () => void
}

/** Pick exercises from the library to add to the session, or create a new one on the spot. */
export function AddExercise({ sessionName, excludeIds, busy, error, notice, onPick, onCreate, onClose }: AddExerciseProps) {
  const library = useAsync(listExercises, [])
  const [creating, setCreating] = useState(false)

  return (
    <>
      <div className="plans-bar">
        <button type="button" className="plans-bar__action" onClick={creating ? () => setCreating(false) : onClose}>
          {creating ? '‹ Libreria' : '✕ Fine'}
        </button>
      </div>
      <PageHeader
        meta={sessionName}
        title={creating ? <>Nuovo <em>esercizio</em></> : <>Aggiungi <em>esercizio</em></>}
        size="title"
      />
      <div role="status">{notice && <p className="plans-note">{notice}</p>}</div>
      {creating ? (
        <ExerciseForm initial={emptyForm()} busy={busy} error={error} submitLabel="Salva e aggiungi alla sessione" onSubmit={onCreate} />
      ) : (
        <>
          {error && (
            <p role="alert" className="plans-error">
              {error}
            </p>
          )}
          <LoadState state={library} what="la libreria">
            {(exercises) => (
              <>
                <ExercisePicker exercises={exercises} excludeIds={excludeIds} onPick={busy ? () => {} : onPick} />
                <div className="plans-actions">
                  <PrimaryButton variant="outline" disabled={busy} onClick={() => setCreating(true)}>
                    Crea un nuovo esercizio
                  </PrimaryButton>
                </div>
              </>
            )}
          </LoadState>
        </>
      )}
    </>
  )
}
