import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { slotAtY, type Slot } from '../lib/reorder'

interface Drag {
  from: number
  to: number
  /** Vertical distance the pointer has travelled, applied to the dragged row. */
  offset: number
}

interface Gesture {
  startY: number
  slots: Slot[]
}

interface RowProps {
  'data-drag'?: 'source' | 'before' | 'after'
  style?: CSSProperties
}

/**
 * Drag-and-drop reorder of the rows of one list, with pointer events (mouse, touch and pen alike).
 * Attach `listRef` to the list, `gripProps(i)` to each row's handle and spread `rowProps(i)` on each row.
 * The handle is pointer-only (aria-hidden): the move buttons stay the keyboard and screen-reader path.
 * `onReorder(from, to)` runs on release over another row.
 */
export function useDragReorder({ disabled, onReorder }: { disabled: boolean; onReorder: (from: number, to: number) => void }) {
  const listRef = useRef<HTMLUListElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const gesture = useRef<Gesture | null>(null)
  // Mirrors `drag` so the release handler never reads a stale render.
  const latest = useRef<Drag | null>(null)

  function update(next: Drag | null) {
    latest.current = next
    setDrag(next)
  }

  function start(index: number, event: PointerEvent<HTMLElement>) {
    const rows = listRef.current?.children
    if (disabled || !rows || (event.pointerType === 'mouse' && event.button !== 0)) return
    // Page coordinates, measured once: the dragged row moves but the layout under it does not.
    const slots = Array.from(rows, (row) => {
      const { top, bottom } = row.getBoundingClientRect()
      return { top: top + window.scrollY, bottom: bottom + window.scrollY }
    })
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { startY: event.pageY, slots }
    update({ from: index, to: index, offset: 0 })
  }

  function move(event: PointerEvent<HTMLElement>) {
    if (!gesture.current || !latest.current) return
    const { startY, slots } = gesture.current
    update({ ...latest.current, to: slotAtY(slots, event.pageY), offset: event.pageY - startY })
  }

  function end(commit: boolean) {
    const finished = latest.current
    gesture.current = null
    update(null)
    if (commit && finished && finished.from !== finished.to) onReorder(finished.from, finished.to)
  }

  return {
    listRef,
    gripProps: (index: number) => ({
      className: 'plan-row__grip',
      'aria-hidden': true as const,
      onPointerDown: (event: PointerEvent<HTMLElement>) => start(index, event),
      onPointerMove: move,
      onPointerUp: () => end(true),
      onPointerCancel: () => end(false),
    }),
    rowProps: (index: number): RowProps => {
      if (!drag) return {}
      if (index === drag.from) return { 'data-drag': 'source', style: { transform: `translateY(${drag.offset}px)` } }
      if (index === drag.to) return { 'data-drag': drag.to < drag.from ? 'before' : 'after' }
      return {}
    },
  }
}
