import { useEffect, useState } from 'react'
import { SplitView } from '../components/SplitView'
import { listExercises } from '../data/exercises'
import { listArchivedExercises } from '../data/exercisesArchived'
import { useAsync } from '../hooks/useAsync'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { sortExercises } from '../lib/exerciseList'
import type { Exercise } from '../types/db'
import { ExerciseEditor } from './exercises/ExerciseEditor'
import { LibraryView } from './exercises/LibraryView'

/** Active exercises first, then the archived ones (restorable from their editor). */
async function loadLibrary(): Promise<Exercise[]> {
  const [active, archived] = await Promise.all([listExercises(), listArchivedExercises()])
  return sortExercises([...active, ...archived])
}

/** Exercise library: browse and search, then create or edit one in place of the list (next to it on desktop). */
export function Exercises() {
  const library = useAsync(loadLibrary, [])
  // undefined: the list; null: a new exercise; otherwise the exercise being edited.
  const [editing, setEditing] = useState<Exercise | null | undefined>(undefined)
  const [notice, setNotice] = useState<string | null>(null)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [editing])

  const editor =
    editing === undefined ? null : (
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
  const view = (
    <LibraryView
      library={library}
      selectedId={editing?.id}
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

  if (!isDesktop) return editor ?? view
  return (
    <SplitView
      list={view}
      detail={editor ?? <p className="split__hint">Scegli un esercizio da modificare, o creane uno nuovo.</p>}
    />
  )
}
