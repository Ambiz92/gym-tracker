import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExerciseList } from '../../components/ExerciseList'
import { ExerciseSearch } from '../../components/ExerciseSearch'
import { PageHeader } from '../../components/PageHeader'
import { PrimaryButton } from '../../components/PrimaryButton'
import type { AsyncState } from '../../hooks/useAsync'
import { filterExercises } from '../../lib/exerciseList'
import type { Exercise } from '../../types/db'

interface LibraryViewProps {
  library: AsyncState<Exercise[]> & { reload: () => void }
  /** Confirmation of the last action, announced politely. */
  notice: string | null
  onNew: () => void
  onSelect: (exercise: Exercise) => void
}

function countLabel(count: number): string {
  return count === 1 ? '1 esercizio' : `${count} esercizi`
}

/** The library screen: header, search, and the list with its loading, error and empty states. */
export function LibraryView({ library, notice, onNew, onSelect }: LibraryViewProps) {
  const exercises = library.status === 'ready' ? library.data : []
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
      <Body library={library} onNew={onNew} onSelect={onSelect} />
    </>
  )
}

function Body({ library, onNew, onSelect }: Omit<LibraryViewProps, 'notice'>) {
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

  const visible = filterExercises(library.data, query)
  const empty =
    library.data.length === 0 ? (
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
      <ExerciseList exercises={visible} onSelect={onSelect} empty={empty} />
    </>
  )
}
