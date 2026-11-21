import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ExerciseSearch } from '../../components/ExerciseSearch'
import { Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import type { AsyncState } from '../../hooks/useAsync'
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_ORDER,
  emptyForm,
  validateExerciseForm,
  type ExerciseFormErrors,
} from '../../lib/exerciseForm'
import { hasExactName } from '../../lib/exerciseList'
import type { SheetSnapshot } from '../../lib/exerciseSheet'
import type { CatalogExercise, Equipment, Exercise, ExerciseInsert } from '../../types/db'
import { LoadState } from '../history/LoadState'
import '../../styles/session.css'
import '../../styles/exercises.css'
import '../../styles/builder.css'
import { PickFilterBar, PickResults, type CatalogState, type PickFilters } from './PickResults'

interface AddExercisesSheetProps {
  sessionName: string
  library: AsyncState<readonly Exercise[]> & { reload: () => void }
  /** The shared catalog: its failure leaves the user's own exercises usable. */
  catalog: CatalogState
  state: SheetSnapshot
  onToggle: (exercise: Exercise) => void
  /** Creates the exercise and adds it to the session; resolves true when both worked. */
  onCreate: (exercise: ExerciseInsert) => Promise<boolean>
  /** Copies the catalog entry into the library and adds the copy; resolves true when both worked. */
  onAdopt: (entry: CatalogExercise) => Promise<boolean>
  onClose: () => void
}

/** Bottom sheet to fill a session: tap an exercise to add it, tap again to take it out, pick from the catalog or create what is missing without leaving. */
export function AddExercisesSheet({ sessionName, library, catalog, state, onToggle, onCreate, onAdopt, onClose }: AddExercisesSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<PickFilters>({})
  const [formOpen, setFormOpen] = useState(false)
  const text = query.trim()
  const catalogEntries = catalog.status === 'ready' ? catalog.data.entries : []

  // A native modal dialog traps focus, closes on Escape and gives focus back to the opener.
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    searchRef.current?.focus()
  }, [])

  async function create(values: ExerciseInsert) {
    if (!(await onCreate(values))) return
    setFormOpen(false)
    setQuery('')
    searchRef.current?.focus()
  }

  async function adopt(entry: CatalogExercise) {
    if (await onAdopt(entry)) searchRef.current?.focus()
  }

  return (
    <dialog
      ref={dialogRef}
      className="how-to add-sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <div className="add-sheet__body">
        <div className="add-sheet__top">
          <div>
            <h2 id={titleId} className="add-sheet__title">
              Aggiungi esercizi
            </h2>
            <p className="add-sheet__meta">Sessione {sessionName}</p>
          </div>
          <button type="button" className="add-sheet__done" onClick={() => dialogRef.current?.close()}>
            Fine
          </button>
        </div>
        <ExerciseSearch value={query} onChange={setQuery} inputRef={searchRef} />
        <button type="button" className="add-sheet__new" aria-expanded={formOpen} onClick={() => setFormOpen((open) => !open)}>
          + Aggiungi personalizzato
        </button>
        {!formOpen && <PickFilterBar catalog={catalog} value={filters} onChange={setFilters} />}
        <div className="add-sheet__status">
          <span>Tocca per aggiungere, tocca ancora per togliere</span>
          <span role="status">{state.addedCount > 0 && `${state.addedCount} aggiunti`}</span>
        </div>
        {state.failure && (
          <p role="alert" className="field__message field__message--error">
            {state.failure}
          </p>
        )}
        <div className="add-sheet__results">
          {formOpen ? (
            <NewExerciseForm initialName={text} busy={state.creating} onSubmit={create} onCancel={() => setFormOpen(false)} />
          ) : (
            <LoadState state={library} what="la libreria">
              {(exercises) => (
                <>
                  {text !== '' && !hasExactName(exercises, text, catalogEntries) && <QuickCreate name={text} busy={state.creating} onCreate={create} />}
                  <PickResults exercises={exercises} catalog={catalog} query={query} filters={filters} state={state} onToggle={onToggle} onAdopt={(entry) => void adopt(entry)} />
                </>
              )}
            </LoadState>
          )}
        </div>
      </div>
    </dialog>
  )
}

interface EquipmentKeysProps {
  label: string
  value: Equipment | null
  onPick: (equipment: Equipment) => void
}

/** The equipment of an exercise as one-tap keys. */
function EquipmentKeys({ label, value, onPick }: EquipmentKeysProps) {
  return (
    <div className="how-to__options" role="group" aria-label={label}>
      {EQUIPMENT_ORDER.map((equipment) => (
        <button key={equipment} type="button" className="how-to__option" aria-pressed={value === null ? undefined : equipment === value} onClick={() => onPick(equipment)}>
          {EQUIPMENT_LABELS[equipment]}
        </button>
      ))}
    </div>
  )
}

interface QuickCreateProps {
  name: string
  busy: boolean
  onCreate: (exercise: ExerciseInsert) => void
}

/** "Crea «name»": one tap on the equipment creates the exercise and adds it. */
export function QuickCreate({ name, busy, onCreate }: QuickCreateProps) {
  const [error, setError] = useState<string>()

  function pick(equipment: Equipment) {
    if (busy) return
    const result = validateExerciseForm({ ...emptyForm(), name, equipment })
    if (!result.ok) {
      setError(result.errors.name)
      return
    }
    setError(undefined)
    onCreate(result.exercise)
  }

  return (
    <div className="add-sheet__quick">
      <p className="add-sheet__quick-title">Crea «{name}»</p>
      <EquipmentKeys label={`Attrezzo di ${name}`} value={null} onPick={pick} />
      <p className={error ? 'field__message field__message--error' : 'field__message'} role={error ? 'alert' : undefined}>
        {error ?? 'Un tocco sull’attrezzo lo crea e lo aggiunge.'}
      </p>
    </div>
  )
}

interface NewExerciseFormProps {
  initialName: string
  busy: boolean
  onSubmit: (exercise: ExerciseInsert) => void
  onCancel: () => void
}

/** Name, equipment and starting weight of a new exercise, in the sheet: nothing else of the library form is needed to start. */
export function NewExerciseForm({ initialName, busy, onSubmit, onCancel }: NewExerciseFormProps) {
  const [values, setValues] = useState({ ...emptyForm(), name: initialName })
  const [errors, setErrors] = useState<ExerciseFormErrors>({})
  const nameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    nameRef.current?.querySelector('input')?.focus()
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const result = validateExerciseForm(values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(result.exercise)
  }

  return (
    <form className="add-sheet__form" onSubmit={handleSubmit} noValidate>
      <div ref={nameRef}>
        <Field
          label="Nome"
          required
          value={values.name}
          onChange={(name) => setValues((current) => ({ ...current, name }))}
          enterKeyHint="next"
          autoComplete="off"
          placeholder="Ad esempio Curl a martello"
          error={errors.name}
        />
      </div>
      <EquipmentKeys label="Attrezzo" value={values.equipment} onPick={(equipment) => setValues((current) => ({ ...current, equipment }))} />
      <Field
        label="Peso di partenza (kg, facoltativo)"
        value={values.startingWeight}
        onChange={(startingWeight) => setValues((current) => ({ ...current, startingWeight }))}
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        error={errors.startingWeight}
      />
      <div className="plans-actions">
        <PrimaryButton type="submit" busy={busy}>
          Crea e aggiungi
        </PrimaryButton>
        <PrimaryButton variant="outline" disabled={busy} onClick={onCancel}>
          Annulla
        </PrimaryButton>
      </div>
    </form>
  )
}
