import { useState } from 'react'
import { filterExercises } from '../lib/exerciseList'
import type { Exercise } from '../types/db'
import { ExerciseList } from './ExerciseList'
import { ExerciseSearch } from './ExerciseSearch'
import { PrimaryButton } from './PrimaryButton'

interface ExercisePickerProps {
  /** Candidates, already loaded by the caller (the picker never fetches). */
  exercises: readonly Exercise[]
  onPick: (exercise: Exercise) => void
  /** Exercises to hide, for example the ones already in the session. */
  excludeIds: readonly string[]
}

/** Searchable list of exercises to add to something; the caller decides what picking means. */
export function ExercisePicker({ exercises, onPick, excludeIds }: ExercisePickerProps) {
  const [query, setQuery] = useState('')
  const available = exercises.filter((exercise) => !excludeIds.includes(exercise.id))
  const visible = filterExercises(available, query)

  let empty = <p>La libreria è vuota. Crea un esercizio per iniziare.</p>
  if (available.length > 0) {
    empty = (
      <>
        <p>Nessun esercizio corrisponde a «{query.trim()}».</p>
        <PrimaryButton variant="outline" onClick={() => setQuery('')}>
          Cancella la ricerca
        </PrimaryButton>
      </>
    )
  } else if (exercises.length > 0) {
    empty = <p>Hai già aggiunto tutti gli esercizi della libreria.</p>
  }

  return (
    <div>
      <ExerciseSearch value={query} onChange={setQuery} />
      <ExerciseList exercises={visible} onSelect={onPick} variant="add" empty={empty} />
    </div>
  )
}
