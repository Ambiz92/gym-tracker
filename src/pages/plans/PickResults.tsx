import { useId } from 'react'
import { PrimaryButton } from '../../components/PrimaryButton'
import { Skeleton } from '../../components/Skeleton'
import type { AsyncState } from '../../hooks/useAsync'
import { EQUIPMENT_LABELS, EQUIPMENT_ORDER } from '../../lib/exerciseForm'
import { exerciseDetail, exerciseSections } from '../../lib/exerciseList'
import { formatNumber } from '../../lib/formatNumber'
import type { SheetSnapshot } from '../../lib/exerciseSheet'
import type { CatalogExercise, Equipment, Exercise } from '../../types/db'

/** The catalog and the catalog ids the user already copied, archived copies included. */
export interface CatalogData {
  entries: readonly CatalogExercise[]
  adoptedIds: ReadonlySet<string>
}
export type CatalogState = AsyncState<CatalogData> & { reload: () => void }

export interface PickFilters {
  equipment?: Equipment
  muscle?: string
}

const collator = new Intl.Collator('it', { sensitivity: 'base' })

interface FilterBarProps {
  catalog: CatalogState
  value: PickFilters
  onChange: (filters: PickFilters) => void
}

/** Equipment and primary-muscle keys; tapping the pressed one clears it. */
export function PickFilterBar({ catalog, value, onChange }: FilterBarProps) {
  const muscles = catalog.status === 'ready' ? [...new Set(catalog.data.entries.map((entry) => entry.primary_muscle))].sort(collator.compare) : []
  return (
    <div className="add-sheet__filters">
      <div className="add-sheet__filter-group" role="group" aria-label="Filtra per attrezzo">
        {EQUIPMENT_ORDER.map((equipment) => (
          <button
            key={equipment}
            type="button"
            className="builder-chip"
            aria-pressed={value.equipment === equipment}
            onClick={() => onChange({ ...value, equipment: value.equipment === equipment ? undefined : equipment })}
          >
            {EQUIPMENT_LABELS[equipment]}
          </button>
        ))}
      </div>
      {muscles.length > 0 && (
        <div className="add-sheet__filter-group" role="group" aria-label="Filtra per muscolo">
          {muscles.map((muscle) => (
            <button
              key={muscle}
              type="button"
              className="builder-chip"
              aria-pressed={value.muscle === muscle}
              onClick={() => onChange({ ...value, muscle: value.muscle === muscle ? undefined : muscle })}
            >
              {muscle}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface PickResultsProps {
  exercises: readonly Exercise[]
  catalog: CatalogState
  query: string
  filters: PickFilters
  state: SheetSnapshot
  onToggle: (exercise: Exercise) => void
  onAdopt: (entry: CatalogExercise) => void
}

/** The search result in two sections: the user's exercises (toggle) and the catalog entries not copied yet (tap to copy and add). */
export function PickResults({ exercises, catalog, query, filters, state, onToggle, onAdopt }: PickResultsProps) {
  const data = catalog.status === 'ready' ? catalog.data : null
  const text = query.trim()
  const filtered = text !== '' || filters.equipment !== undefined || filters.muscle !== undefined
  const sections = exerciseSections(exercises, data?.entries ?? [], { query, ...filters, adoptedCatalogIds: data?.adoptedIds })
  const mineId = useId()
  const catalogId = useId()

  return (
    <>
      <section aria-labelledby={mineId}>
        <h3 id={mineId} className="add-sheet__section">
          I tuoi esercizi
        </h3>
        {sections.mine.length > 0 ? (
          <MineList exercises={sections.mine} state={state} onToggle={onToggle} />
        ) : (
          <p className="add-sheet__empty">{mineEmpty(exercises.length, text, filtered)}</p>
        )}
      </section>
      <section aria-labelledby={catalogId}>
        <h3 id={catalogId} className="add-sheet__section">
          Catalogo
        </h3>
        <CatalogBody catalog={catalog} entries={sections.catalog} filtered={filtered} query={text} busy={state.creating} onAdopt={onAdopt} />
      </section>
    </>
  )
}

function mineEmpty(libraryCount: number, query: string, filtered: boolean): string {
  if (libraryCount === 0) return 'La libreria è vuota. Scegli dal catalogo o aggiungi un esercizio personalizzato.'
  if (query) return `Nessun tuo esercizio corrisponde a «${query}».`
  return filtered ? 'Nessun tuo esercizio corrisponde ai filtri.' : 'Non hai esercizi da mostrare.'
}

interface CatalogBodyProps {
  catalog: CatalogState
  entries: readonly CatalogExercise[]
  filtered: boolean
  query: string
  busy: boolean
  onAdopt: (entry: CatalogExercise) => void
}

/** The catalog list, or why there is none: it is loading, it failed (the user's exercises stay usable) or nothing matches. */
function CatalogBody({ catalog, entries, filtered, query, busy, onAdopt }: CatalogBodyProps) {
  if (catalog.status === 'loading') return <Skeleton label="Caricamento del catalogo…" rows={2} />

  if (catalog.status === 'error') {
    return (
      <div role="alert" className="add-sheet__catalog-error">
        <p>Catalogo non disponibile. Controlla la connessione e riprova. I tuoi esercizi funzionano lo stesso.</p>
        <PrimaryButton variant="outline" onClick={catalog.reload}>
          Riprova
        </PrimaryButton>
      </div>
    )
  }

  if (entries.length > 0) {
    return (
      <ul className="add-sheet__list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className="add-sheet__pick"
              disabled={busy}
              aria-label={`${entry.name_it}, dal catalogo: tocca per aggiungere`}
              onClick={() => onAdopt(entry)}
            >
              <span>
                <span className="exercise-row__name">{entry.name_it}</span>
                <span className="exercise-row__detail">{exerciseDetail({ equipment: entry.equipment, muscles: entry.primary_muscle })}</span>
              </span>
              <span className="add-sheet__state" aria-hidden="true">
                +
              </span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  if (catalog.data.entries.length === 0) return <p className="add-sheet__empty">Il catalogo è vuoto.</p>
  if (!filtered) return <p className="add-sheet__empty">Hai già tutti gli esercizi del catalogo.</p>
  return <p className="add-sheet__empty">{query ? `Nessuna voce del catalogo corrisponde a «${query}».` : 'Nessuna voce del catalogo corrisponde ai filtri.'}</p>
}

interface MineListProps {
  exercises: readonly Exercise[]
  state: SheetSnapshot
  onToggle: (exercise: Exercise) => void
}

function MineList({ exercises, state, onToggle }: MineListProps) {
  return (
    <ul className="add-sheet__list">
      {exercises.map((exercise) => {
        const added = state.added.has(exercise.id)
        return (
          <li key={exercise.id}>
            <button
              type="button"
              className="add-sheet__pick"
              aria-pressed={added}
              aria-busy={state.busy.has(exercise.id) || undefined}
              aria-label={`${exercise.name}, ${added ? 'aggiunto: tocca per rimuovere' : 'tocca per aggiungere'}`}
              onClick={() => onToggle(exercise)}
            >
              <span>
                <span className="exercise-row__name">{exercise.name}</span>
                <span className="exercise-row__detail">
                  {exercise.starting_weight_kg === null
                    ? exerciseDetail({ ...exercise, muscles: null })
                    : `${EQUIPMENT_LABELS[exercise.equipment]} · ${formatNumber(exercise.starting_weight_kg)} kg`}
                </span>
              </span>
              <span className="add-sheet__state" aria-hidden="true">
                {added ? '✓ Aggiunto' : '+'}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
