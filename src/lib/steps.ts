// Execution steps are stored as one text column: one step per line, in order.

/** Splits the stored text into trimmed, non-blank steps. */
export function splitSteps(text: string | null): string[] {
  if (!text) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

/** Joins steps for storage, dropping blank ones; null when nothing is left. */
export function joinSteps(steps: readonly string[]): string | null {
  const kept = steps.map((step) => step.trim()).filter((step) => step !== '')
  return kept.length === 0 ? null : kept.join('\n')
}

export function setStep(steps: readonly string[], index: number, text: string): string[] {
  return steps.map((step, i) => (i === index ? text : step))
}

/** Appends an empty step to be typed into. */
export function addStep(steps: readonly string[]): string[] {
  return [...steps, '']
}

export function removeStep(steps: readonly string[], index: number): string[] {
  return steps.filter((_, i) => i !== index)
}

/** Swaps the step with its neighbour; out-of-range moves return the list unchanged. */
export function moveStep(steps: readonly string[], index: number, offset: -1 | 1): string[] {
  const target = index + offset
  if (index < 0 || index >= steps.length || target < 0 || target >= steps.length) return [...steps]
  const moved = [...steps]
  ;[moved[index], moved[target]] = [moved[target], moved[index]]
  return moved
}
