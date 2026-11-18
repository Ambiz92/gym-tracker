/** Swaps the item with its neighbour; out-of-range moves return the list unchanged. */
export function moveItem<T>(items: readonly T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items]
  const moved = [...items]
  ;[moved[index], moved[target]] = [moved[target], moved[index]]
  return moved
}

/** Moves the item at `from` to index `to`, shifting the ones in between; an out-of-range index returns the list unchanged. */
export function moveTo<T>(items: readonly T[], from: number, to: number): T[] {
  const moved = [...items]
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return moved
  moved.splice(to, 0, ...moved.splice(from, 1))
  return moved
}

export interface Slot {
  top: number
  bottom: number
}

/** The row under the pointer: `slots` are the rows top to bottom; above the first gives 0, below the last the last. */
export function slotAtY(slots: readonly Slot[], y: number): number {
  const index = slots.findIndex((slot) => y < slot.bottom)
  return index === -1 ? Math.max(slots.length - 1, 0) : index
}
