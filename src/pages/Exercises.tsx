import { useEffect, useState } from 'react'
import { SplitView } from '../components/SplitView'
import { listExerciseUsage, listExercises } from '../data/exercises'
import { listArchivedExercises } from '../data/exercisesArchived'
import { useAsync } from '../hooks/useAsync'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { sortExercises } from '../lib/exerciseList'
import type { Exercise } from '../types/db'
import { ExerciseEditor } from './exercises/ExerciseEditor'
import { LibraryView, type Library } from './exercises/LibraryView'

/** Active exercises first, then the archived ones (restorable from their editor); plan usage only when shown. */
async function loadLibrary(withUsage: boolean): Promise<Library> {
  const [active, archived, usage] = await Promise.all([
    listExercises(),
    listArchivedExercises(),
    withUsage ? listExerciseUsage() : null,
  ])
  return { exercises: sortExercises([...active, ...archived]), usage }
}

/** Exercise library: browse and search, then create or edit one in place of the list (next to it on desktop). */
export function Exercises() {
  const isDesktop = useIsDesktop()
  const library = useAsync(() => loadLibrary(isDesktop), [isDesktop])
  // undefined: the list; null: a new exercise; otherwise the exercise being edited.
  const [editing, setEditing] = useState<Exercise | null | undefined>(undefined)
  const [notice, setNotice] = useState<string | null>(null)

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
