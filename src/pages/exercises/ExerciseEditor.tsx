import { useState } from 'react'
import { ExerciseForm } from '../../components/ExerciseForm'
import { PageHeader } from '../../components/PageHeader'
import { PrimaryButton } from '../../components/PrimaryButton'
import { archiveExercise, createExercise, deleteExercise, updateExercise } from '../../data/exercises'
import { emptyForm, formFromExercise } from '../../lib/exerciseForm'
import type { Exercise, ExerciseInsert } from '../../types/db'
import { useAction } from './useAction'

interface ExerciseEditorProps {
  /** null creates a new exercise. */
  exercise: Exercise | null
  onCancel: () => void
  /** Called after a successful save, archive, restore or delete, with the confirmation to show. */
  onDone: (notice: string) => void
}

/** Create or edit one exercise; for an existing one also archive, restore or delete it. */
export function ExerciseEditor({ exercise, onCancel, onDone }: ExerciseEditorProps) {
  const save = useAction()
  const manage = useAction()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const busy = save.busy || manage.busy

  async function handleSave(values: ExerciseInsert) {
    const saved = await save.run(
      () => (exercise ? updateExercise(exercise.id, values) : createExercise(values)),
      'Salvataggio non riuscito. Controlla la connessione e riprova: i dati nel modulo sono ancora qui.',
    )
    if (saved) onDone(exercise ? 'Esercizio salvato.' : 'Esercizio creato.')
  }

  async function handleArchive(archived: boolean) {
    if (!exercise) return
    const done = await manage.run(
      () => (archived ? archiveExercise(exercise.id) : updateExercise(exercise.id, { archived: false })),
      archived ? 'Archiviazione non riuscita. Riprova.' : 'Ripristino non riuscito. Riprova.',
    )
    if (done) onDone(archived ? 'Esercizio archiviato.' : 'Esercizio ripristinato.')
  }

  async function handleDelete() {
    if (!exercise) return
    const done = await manage.run(() => deleteExercise(exercise.id), 'Eliminazione non riuscita. Riprova.')
    if (done) {
      onDone('Esercizio eliminato.')
      return
    }
    setConfirmingDelete(false)
  }

  return (
    <>
      <div className="exercises__bar">
        <button type="button" className="exercises__bar-action" onClick={onCancel}>
          ✕ Annulla
        </button>
      </div>
      <PageHeader
        meta="Libreria"
        metaEnd={exercise ? 'Modifica' : 'Nuovo'}
        title={exercise ? exercise.name : <>Nuovo <em>esercizio</em></>}
        subtitle={exercise?.archived ? 'Archiviato' : undefined}
        size="title"
      />
      <ExerciseForm
        initial={exercise ? formFromExercise(exercise) : emptyForm()}
        busy={busy}
        error={save.error}
        submitLabel={exercise ? 'Salva modifiche' : 'Crea esercizio'}
        onSubmit={handleSave}
      />
      {exercise && (
        <section className="exercise-editor__manage" aria-labelledby="exercise-manage-heading">
          <h2 id="exercise-manage-heading" className="exercise-editor__heading">
            Archivia o elimina
          </h2>
          <p className="exercise-editor__manage-text">
            Con uno storico un esercizio non si cancella: si archivia. Sparisce dalla libreria, ma i dati restano e
            puoi ripristinarlo.
          </p>
          {manage.error && (
            <p role="alert" className="field__message field__message--error">
              {manage.error}
            </p>
          )}
          <div className="exercise-form__actions">
            <PrimaryButton
              variant="outline"
              busy={manage.busy && !confirmingDelete}
              disabled={busy}
              onClick={() => handleArchive(!exercise.archived)}
            >
              {exercise.archived ? 'Ripristina' : 'Archivia'}
            </PrimaryButton>
            {confirmingDelete ? (
              <div role="group" aria-label="Conferma eliminazione">
                <p className="exercise-editor__confirm-text">
                  Eliminare «{exercise.name}» per sempre? Non si può annullare.
                </p>
                <div className="exercise-form__actions">
                  <PrimaryButton busy={manage.busy} disabled={busy} onClick={handleDelete}>
                    Elimina definitivamente
                  </PrimaryButton>
                  <PrimaryButton variant="outline" disabled={busy} onClick={() => setConfirmingDelete(false)}>
                    Non eliminare
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="exercise-editor__danger"
                disabled={busy}
                onClick={() => setConfirmingDelete(true)}
              >
                Elimina esercizio
              </button>
            )}
          </div>
        </section>
      )}
    </>
  )
}
