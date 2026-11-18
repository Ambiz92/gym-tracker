import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExerciseList } from '../../components/ExerciseList'
import { ExerciseSearch } from '../../components/ExerciseSearch'
import { PageHeader } from '../../components/PageHeader'
import { PrimaryButton } from '../../components/PrimaryButton'
import type { AsyncState } from '../../hooks/useAsync'
import { filterExercises } from '../../lib/exerciseList'
import type { Exercise } from '../../types/db'

export interface Library {
  exercises: Exercise[]
  /** Plans using each exercise; null where the rows do not show it (the phone). */
  usage: ReadonlyMap<string, number> | null
}

interface LibraryViewProps {
  library: AsyncState<Library> & { reload: () => void }
  /** The exercise being edited next to the list, highlighted in it. */
  selectedId?: string
  /** Confirmation of the last action, announced politely. */
  notice: string | null
  onNew: () => void
  onSelect: (exercise: Exercise) => void
}

function countLabel(count: number): string {
  return count === 1 ? '1 esercizio' : `${count} esercizi`
}

/** The library screen: header, search, and the list with its loading, error and empty states. */
export function LibraryView({ library, selectedId, notice, onNew, onSelect }: LibraryViewProps) {
  const exercises = library.status === 'ready' ? library.data.exercises : []
  const activeCount = exercises.filter((exercise) => !exercise.archived).length

  return (
    <>
      <div className="exercises__bar">
        <Link to="/plans" className="exercises__bar-action">
          ‹ Schede
        </Link>
        <button type="button" className="exercises__bar-action exercises__bar-action--accent" onClick={onNew}>
          + Nuovo
        </button>
      </div>
      <PageHeader
        meta="Libreria"
        metaEnd={library.status === 'ready' ? countLabel(activeCount) : undefined}
        title={<>Libreria <em>esercizi</em></>}
        size="title"
      />
      <div role="status">{notice && <p className="exercises__status">{notice}</p>}</div>
      <Body library={library} selectedId={selectedId} onNew={onNew} onSelect={onSelect} />
    </>
  )
}

function Body({ library, selectedId, onNew, onSelect }: Omit<LibraryViewProps, 'notice'>) {
  const [query, setQuery] = useState('')

  if (library.status === 'loading') return <p role="status" className="exercises__status">Caricamento della libreria…</p>

  if (library.status === 'error') {
    return (
      <div className="exercises__empty">
        <p role="alert">Non sono riuscito a caricare la libreria. I tuoi esercizi non sono stati toccati.</p>
        <PrimaryButton onClick={library.reload}>Riprova</PrimaryButton>
      </div>
    )
  }

  const { exercises, usage } = library.data
  const visible = filterExercises(exercises, query)
  const empty =
    exercises.length === 0 ? (
      <>
        <p>La libreria è vuota. Crea il tuo primo esercizio.</p>
        <PrimaryButton onClick={onNew}>Crea esercizio</PrimaryButton>
      </>
    ) : (
      <>
        <p>Nessun esercizio corrisponde a «{query.trim()}».</p>
        <PrimaryButton variant="outline" onClick={() => setQuery('')}>
          Cancella la ricerca
        </PrimaryButton>
      </>
    )

  return (
    <>
      <ExerciseSearch value={query} onChange={setQuery} />
      <ExerciseList exercises={visible} selectedId={selectedId} usage={usage} onSelect={onSelect} empty={empty} />
    </>
  )
}
