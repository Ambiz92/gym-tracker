import { formatNumber } from '../../lib/formatNumber'
import { RULER_STEP, clamp, rulerMax, rulerValueAt, rulerX } from '../../lib/plates'
import type { TargetUnit } from '../../types/db'
import { SceneFrame, shade, useSceneId } from './SceneFrame'
import { useSlider } from './useSlider'

const X0 = 84
const X1 = 276
const TRACK_Y = 118

export type RulerUnit = Exclude<TargetUnit, 'reps'>

const COPY: Record<RulerUnit, { label: string; spoken: string; labelEvery: number }> = {
  seconds: { label: 'Durata della tenuta', spoken: 'secondi', labelEvery: 30 },
  meters: { label: 'Distanza del trasporto', spoken: 'metri', labelEvery: 20 },
}

interface RulerSceneProps {
  value: number
  unit: RulerUnit
  onChange: (value: number) => void
}

/** A ruler painted on the platform for holds and carries; drag the marker or use the arrow keys. */
export function RulerScene({ value, unit, onChange }: RulerSceneProps) {
  const id = useSceneId()
  const { label, spoken, labelEvery } = COPY[unit]
  const max = rulerMax(unit, value)
  const range = { min: RULER_STEP, max, step: RULER_STEP }
  const shown = clamp(value, range.min, max)
  const markerX = rulerX(shown, max, X0, X1)

  const slider = useSlider({
    range,
    value: shown,
    label,
    valueText: `${formatNumber(shown)} ${spoken}, su ${max}`,
    orientation: 'horizontal',
    valueAt: ({ x }) => rulerValueAt(x, max, X0, X1),
    onChange,
  })

  const ticks = Array.from({ length: max / RULER_STEP + 1 }, (_, index) => index * RULER_STEP)

  return (
    <SceneFrame id={id} shadow={{ cx: 180, rx: 100 }} svgProps={slider}>
      <rect className="ruler-board" x="70" y="92" width="220" height="48" rx="6" />
      {ticks.map((tick) => {
        const x = rulerX(tick, max, X0, X1)
        const major = tick % labelEvery === 0
        return (
          <g key={tick}>
            <path className={major ? 'ruler-tick ruler-tick--major' : 'ruler-tick'} d={`M${x} 100V${major ? 114 : 106}`} />
            {major && (
              <text className="ruler-label" x={x} y="139" textAnchor="middle">
                {tick}
              </text>
            )}
          </g>
        )
      })}
      <rect className="ruler-track" x={X0} y={TRACK_Y} width={X1 - X0} height="8" rx="4" />
      <rect className="ruler-fill" x={X0} y={TRACK_Y} width={markerX - X0} height="8" rx="4" />
      <g className="lifter">
        <rect className="ruler-marker" x={markerX - 6} y="62" width="12" height="66" rx="3" />
        <rect x={markerX - 6} y="62" width="12" height="66" rx="3" fill={shade(id)} />
        <path className="ruler-grip" d={`M${markerX - 3} 80h6M${markerX - 3} 86h6M${markerX - 3} 92h6`} />
      </g>
    </SceneFrame>
  )
}
