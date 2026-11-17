import { buildChartGeometry, type ChartLayout, type ChartPoint } from './lineChartScale'

const LAYOUT: ChartLayout = {
  width: 340,
  height: 180,
  left: 40,
  right: 8,
  top: 16,
  bottom: 28,
  inset: 12,
  minLabelGap: 30,
}
const MARKER_SIZE = 16

interface LineChartProps {
  points: readonly ChartPoint[]
  /** One sentence with the trend, used as the accessible name of the drawing. */
  summary: string
  formatTick: (value: number) => string
}

/**
 * Stepped line chart in plain SVG. The drawing is one image for assistive tech; the same data is
 * available as a visually hidden list, and the page also shows it as a table.
 */
export function LineChart({ points, summary, formatTick }: LineChartProps) {
  if (points.length === 0) return null
  const { line, ticks, labels, marker, plot } = buildChartGeometry(points, LAYOUT)

  return (
    <figure className="line-chart">
      <svg viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} role="img" aria-label={summary} className="line-chart__svg">
        {ticks.map(({ value, y }) => (
          <g key={value}>
            <line x1={plot.left} x2={plot.right} y1={y} y2={y} className="line-chart__grid" />
            <text x={0} y={y + 4} className="line-chart__text">
              {formatTick(value)}
            </text>
          </g>
        ))}
        <polyline points={line} fill="none" className="line-chart__line" />
        <rect
          x={marker.x - MARKER_SIZE / 2}
          y={marker.y - MARKER_SIZE / 2}
          width={MARKER_SIZE}
          height={MARKER_SIZE}
          className="line-chart__marker"
        />
        {labels.map(({ index, x }) => (
          <text key={index} x={x} y={LAYOUT.height - 8} textAnchor="middle" className="line-chart__text">
            {points[index]!.axisLabel}
          </text>
        ))}
      </svg>
      <ul className="visually-hidden">
        {points.map((point) => (
          <li key={point.x}>{point.description}</li>
        ))}
      </ul>
    </figure>
  )
}
