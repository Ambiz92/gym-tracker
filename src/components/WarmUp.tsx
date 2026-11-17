import { useId, useState } from 'react'
import type { WarmupItem } from '../types/db'

interface WarmUpProps {
  items: readonly Pick<WarmupItem, 'id' | 'name' | 'reps_text' | 'note'>[]
}

/** Collapsible warm-up block; closed by default so the exercises stay in view. */
export function WarmUp({ items }: WarmUpProps) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  if (items.length === 0) return null

  return (
    <section className="warm-up" aria-label="Riscaldamento">
      <button type="button" className="warm-up__toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
        <span>
          <span className="exercise-card__name">Riscaldamento</span>
          <small className="exercise-card__detail">{items.length === 1 ? '1 movimento' : `${items.length} movimenti`}</small>
        </span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <ul id={listId} className="warm-up__list" hidden={!open}>
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.name}</span>
            <small>{[item.reps_text, item.note].filter(Boolean).join(' · ')}</small>
          </li>
        ))}
      </ul>
    </section>
  )
}
