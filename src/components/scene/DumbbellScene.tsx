import { formatNumber } from '../../lib/formatNumber'
import { clamp } from '../../lib/slider'
import { CENTER_Y, SceneFrame, ShadedRect, VerticalLabel, knurl, shade, sheen, useSceneId } from './SceneFrame'

const GRIP = { x: 124, width: 112 }
const MAX_HEAD_HEIGHT = 124
const MAX_HEAD_WIDTH = 42

interface DumbbellSceneProps {
  /** Weight of a single dumbbell. */
  weight: number
}

/** One dumbbell whose heads grow with the load. */
export function DumbbellScene({ weight }: DumbbellSceneProps) {
  const id = useSceneId()
  const height = clamp(44 + weight * 3.2, 44, MAX_HEAD_HEIGHT)
  const width = clamp(20 + weight * 0.6, 20, MAX_HEAD_WIDTH)
  const top = CENTER_Y - height / 2
  const heads = [GRIP.x - 8 - width, GRIP.x + GRIP.width + 8]

  return (
    <SceneFrame
      id={id}
      shadow={{ cx: 180, rx: width + 80 }}
      svgProps={{ role: 'img', 'aria-label': `Manubrio da ${formatNumber(weight)} kg, il peso di un singolo manubrio` }}
    >
      <g className="lifter">
        <rect className="scene-steel" x={GRIP.x} y="74" width={GRIP.width} height="12" />
        <rect x={GRIP.x + 8} y="74" width={GRIP.width - 16} height="12" fill={knurl(id)} />
        <rect x={GRIP.x} y="74" width={GRIP.width} height="12" fill={sheen(id)} />
        <rect className="scene-steel" x={GRIP.x - 8} y="64" width="8" height="32" rx="2" />
        <rect className="scene-steel" x={GRIP.x + GRIP.width} y="64" width="8" height="32" rx="2" />
        {heads.map((x) => (
          <g key={`${x}-${weight}`} className="scene-pop">
            <ShadedRect className="scene-iron" x={x} y={top} width={width} height={height} rx="9" overlay={shade(id)} />
            <rect className="scene-head-inset" x={x + 4} y={top + 6} width={width - 8} height={height - 12} rx="6" />
            <VerticalLabel className={width >= 28 ? 'scene-label--head' : 'scene-label--head-small'} x={x} width={width} dy={5}>
              {formatNumber(weight)}
            </VerticalLabel>
          </g>
        ))}
      </g>
    </SceneFrame>
  )
}
