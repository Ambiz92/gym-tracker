import type { PlanExerciseDetail } from '../../data/activePlan'
import { useDragReorder } from '../../hooks/useDragReorder'
import type { PlanTarget } from '../../lib/planForm'
import { ExerciseEditRow } from './ExerciseEditRow'
import '../../styles/plans.css'
import '../../styles/builder.css'

interface ExerciseEditRowsProps {
  exercises: readonly PlanExerciseDetail[]
  /** A structural request (reorder, remove) is in flight: moving, dragging and removing are blocked. */
  busy: boolean
  onSave: (id: string, target: PlanTarget) => Promise<void>
  onApply: (id: string, target: PlanTarget) => void
  onMove: (index: number, offset: -1 | 1) => void
  /** A row was dragged onto another one. */
  onReorder: (from: number, to: number) => void
  onRemove: (id: string) => void
}

/** Exercises of a session in execution order, every number editable in place; reorder by dragging the handle or with the buttons. */
export function ExerciseEditRows({ exercises, busy, onSave, onApply, onMove, onReorder, onRemove }: ExerciseEditRowsProps) {
  const drag = useDragReorder({ disabled: busy, onReorder })

  if (exercises.length === 0) {
    return <p className="plans-note empty-state">Questa sessione non ha ancora esercizi. Tocca «Aggiungi esercizi» per cominciare.</p>
  }

  return (
    <ul ref={drag.listRef} className="builder-list">
      {exercises.map((row, index) => (
        <li key={row.id} {...drag.rowProps(index)}>
          <ExerciseEditRow
            row={row}
            index={index}
            count={exercises.length}
            busy={busy}
            grip={<span {...drag.gripProps(index)}>⋮⋮</span>}
            onSave={onSave}
            onApply={onApply}
            onMove={onMove}
            onRemove={onRemove}
          />
        </li>
      ))}
    </ul>
  )
}
