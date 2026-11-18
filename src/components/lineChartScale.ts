export interface ChartPoint {
  x: number
  y: number
  /** Short label under the point on the x axis. */
  axisLabel: string
  /** Full sentence for the text alternative. */
  description: string
}

export interface ChartLayout {
  width: number
  height: number
  /** Room for the y tick labels. */
  left: number
  right: number
  top: number
  /** Room for the x axis labels. */
  bottom: number
  /** Keeps the end marker inside the plot. */
  inset: number
  /** Minimum horizontal distance between two x axis labels. */
  minLabelGap: number
}

export interface ChartGeometry {
  /** SVG `points` of the stepped line: the value holds until the next point, then jumps. */
  line: string
  ticks: { value: number; y: number }[]
  labels: { index: number; x: number }[]
  marker: { x: number; y: number }
  plot: { left: number; right: number; top: number; bottom: number }
}

/** Lays out a stepped line chart; `points` must be sorted by x and not empty. */
export function buildChartGeometry(points: readonly ChartPoint[], layout: ChartLayout): ChartGeometry {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) throw new Error('buildChartGeometry needs at least one point')

  const plot = {
    left: layout.left,
    right: layout.width - layout.right,
    top: layout.top,
    bottom: layout.height - layout.bottom,
  }
  const xStart = plot.left + layout.inset
  const xEnd = plot.right - layout.inset
  const values = points.map((point) => point.y)
  const yMin = Math.min(...values)
  const yMax = Math.max(...values)

  const xOf = (x: number) => (last.x === first.x ? (xStart + xEnd) / 2 : xStart + ((x - first.x) / (last.x - first.x)) * (xEnd - xStart))
  const yOf = (y: number) => (yMax === yMin ? (plot.top + plot.bottom) / 2 : plot.top + ((yMax - y) / (yMax - yMin)) * (plot.bottom - plot.top))

  const coordinates: string[] = []
  points.forEach((point, index) => {
    const previous = points[index - 1]
    if (previous) coordinates.push(`${xOf(point.x)},${yOf(previous.y)}`)
    coordinates.push(`${xOf(point.x)},${yOf(point.y)}`)
  })

  const tickValues = yMax === yMin ? [yMin] : [yMin, (yMin + yMax) / 2, yMax]

  return {
    line: coordinates.join(' '),
    ticks: tickValues.map((value) => ({ value, y: yOf(value) })),
    labels: pickLabels(points.map((point) => xOf(point.x)), layout.minLabelGap),
    marker: { x: xOf(last.x), y: yOf(last.y) },
    plot,
  }
}

/** Greedy left to right, then makes room so the last point is always labelled. */
function pickLabels(xs: readonly number[], minGap: number): { index: number; x: number }[] {
  const kept: { index: number; x: number }[] = []
  xs.forEach((x, index) => {
    const previous = kept[kept.length - 1]
    if (!previous || x - previous.x >= minGap) kept.push({ index, x })
  })

  const lastIndex = xs.length - 1
  if (kept[kept.length - 1]?.index === lastIndex) return kept
  const lastX = xs[lastIndex]!
  while (kept.length > 0 && lastX - kept[kept.length - 1]!.x < minGap) kept.pop()
  kept.push({ index: lastIndex, x: lastX })
  return kept
}
