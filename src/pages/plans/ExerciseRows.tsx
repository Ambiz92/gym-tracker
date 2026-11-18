import { useState } from 'react'
import { ReorderButtons } from '../../components/ReorderButtons'
import type { PlanExerciseDetail } from '../../data/activePlan'
import { useDragReorder } from '../../hooks/useDragReorder'
import { targetFormFrom, type PlanTarget } from '../../lib/planForm'
import { targetLabel } from '../../lib/sessionProgress'
import { RemoveConfirm } from './RemoveConfirm'
import { TargetForm } from './TargetForm'
import '../../styles/plans.css'

interface ExerciseRowsProps {
  exercises: readonly PlanExerciseDetail[]
  /** The row whose target is being edited, if any. */
  editingId: string | null
  /** A request is in flight: moving and removing are blocked. */
  busy: boolean
  /** Failure of the last target save, shown in the open form. */
  error: string | null
  onEdit: (id: string | null) => void
  onSave: (id: string, target: PlanTarget) => void
  onMove: (index: number, offset: -1 | 1) => void
  /** A row was dragged onto another one. */
  onReorder: (from: number, to: number) => void
  onRemove: (id: string) => void
}

/** Exercises of a session in execution order: sets×reps only (weights live in the edit form), reorder (drag or buttons) and remove. */
export function ExerciseRows({ exercises, editingId, busy, error, onEdit, onSave, onMove, onReorder, onRemove }: ExerciseRowsProps) {
  const drag = useDragReorder({ disabled: busy, onReorder })
  const [removingId, setRemovingId] = useState<string | null>(null)

  if (exercises.length === 0) return <p className="plans-note">Questa sessione non ha ancora esercizi.</p>

  return (
    <ul ref={drag.listRef} className="plans-list">
      {exercises.map((row, index) => {
        const { name } = row.exercise
        const open = row.id === editingId
        return (
          <li key={row.id} {...drag.rowProps(index)}>
            <div className="plan-row">
              <span {...drag.gripProps(index)}>⋮⋮</span>
              <button
                type="button"
                className="plan-row__main"
                aria-expanded={open}
                aria-label={`Modifica ${name}`}
                onClick={() => onEdit(open ? null : row.id)}
              >
                <span className="row-link__title">{name}</span>
                <span className="row-link__detail">{targetLabel(row)}</span>
              </button>
              <ReorderButtons
                name={name}
                index={index}
                count={exercises.length}
                disabled={busy}
                onMove={(offset) => onMove(index, offset)}
              />
              <button type="button" className="plan-row__button" aria-label={`Rimuovi ${name}`} disabled={busy} onClick={() => setRemovingId(row.id)}>
                ✕
              </button>
            </div>
            {row.id === removingId && (
              <RemoveConfirm name={name} busy={busy} onRemove={() => onRemove(row.id)} onCancel={() => setRemovingId(null)} />
            )}
            {open && (
              <TargetForm
                initial={targetFormFrom(row)}
                busy={busy}
                error={error}
                onSubmit={(target) => onSave(row.id, target)}
                onCancel={() => onEdit(null)}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
