import { useEffect, useState } from 'react'
import { listExercises } from '../data/exercises'
import { listArchivedExercises } from '../data/exercisesArchived'
import { useAsync } from '../hooks/useAsync'
import { sortExercises } from '../lib/exerciseList'
import type { Exercise } from '../types/db'
import { ExerciseEditor } from './exercises/ExerciseEditor'
import { LibraryView } from './exercises/LibraryView'

/** Active exercises first, then the archived ones (restorable from their editor). */
async function loadLibrary(): Promise<Exercise[]> {
  const [active, archived] = await Promise.all([listExercises(), listArchivedExercises()])
  return sortExercises([...active, ...archived])
}

/** Exercise library: browse and search, then create or edit one in place of the list. */
export function Exercises() {
  const library = useAsync(loadLibrary, [])
  // undefined: the list; null: a new exercise; otherwise the exercise being edited.
  const [editing, setEditing] = useState<Exercise | null | undefined>(undefined)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [editing])

  if (editing !== undefined) {
    return (
      <ExerciseEditor
        key={editing?.id ?? 'new'}
        exercise={editing}
        onCancel={() => setEditing(undefined)}
        onDone={(message) => {
          setNotice(message)
          setEditing(undefined)
          library.reload()
        }}
      />
    )
  }

  return (
    <LibraryView
      library={library}
      notice={notice}
      onNew={() => {
        setNotice(null)
        setEditing(null)
      }}
      onSelect={(exercise) => {
        setNotice(null)
        setEditing(exercise)
      }}
    />
  )
}
