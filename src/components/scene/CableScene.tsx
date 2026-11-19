import { formatNumber } from '../../lib/formatNumber'
import { CABLE_BLOCKS, CABLE_BLOCK_KG, cableBlock, cableWeightAt } from '../../lib/plates'
import { FLOOR_Y, SceneFrame, ShadedRect, sheen, useSceneId } from './SceneFrame'
import { useSlider } from './useSlider'

const BLOCK_HEIGHT = 12
const STACK_TOP = FLOOR_Y - CABLE_BLOCKS * BLOCK_HEIGHT
const STACK = { x: 152, width: 116 }
// The stack column and the pin head beside it: the part of the scene that holds the page still on touch.
const DRAG_RIGHT = 290
const RANGE = { min: CABLE_BLOCK_KG, max: CABLE_BLOCKS * CABLE_BLOCK_KG, step: CABLE_BLOCK_KG }

const blockTop = (index: number): number => STACK_TOP + (index - 1) * BLOCK_HEIGHT

interface CableBlockProps {
  index: number
  lifted: boolean
  /** Scene id of the sheen gradient. */
  id: string
}

function CableBlock({ index, lifted, id }: CableBlockProps) {
  const y = blockTop(index) + 1
  return (
    <g className={lifted ? 'cable-block cable-block--lifted' : 'cable-block'}>
      <ShadedRect className="cable-block__body" x={STACK.x} y={y} width={STACK.width} height={BLOCK_HEIGHT - 1} rx="2" overlay={sheen(id)} />
      <text className="cable-block__label" x={STACK.x + 38} y={y + 8.6} textAnchor="middle">
        {formatNumber(index * CABLE_BLOCK_KG)}
      </text>
    </g>
  )
}

interface CableSceneProps {
  weight: number
  onChange: (weightKg: number) => void
}

/** A cable weight stack: the pin picks how many blocks move; drag it or use the arrow keys. */
export function CableScene({ weight, onChange }: CableSceneProps) {
  const id = useSceneId()
  const pinned = cableBlock(weight)
  const pinnedKg = pinned * CABLE_BLOCK_KG
  const blocks = Array.from({ length: CABLE_BLOCKS }, (_, index) => index + 1)
  const pinY = blockTop(pinned) + BLOCK_HEIGHT / 2 + 0.5

  const slider = useSlider({
    range: RANGE,
    value: pinnedKg,
    label: 'Peso del cavo',
    // The real weight, which the pin only approximates when it is off the blocks.
    valueText: `${formatNumber(weight)} chili, perno al blocco ${pinned} di ${CABLE_BLOCKS}`,
    orientation: 'vertical',
    valueAt: ({ y }) => cableWeightAt(y - STACK_TOP, BLOCK_HEIGHT),
    onChange,
  })

  return (
    <SceneFrame id={id} shadow={{ cx: 210, rx: 90 }} svgProps={slider}>
      <rect className="scene-steel scene-rail" x="163" y="0" width="3" height={FLOOR_Y} />
      <rect className="scene-steel scene-rail" x="254" y="0" width="3" height={FLOOR_Y} />
      {blocks.filter((index) => index > pinned).map((index) => (
        <CableBlock key={index} index={index} lifted={false} id={id} />
      ))}
      <g className="lifter">
        {blocks.filter((index) => index <= pinned).map((index) => (
          <CableBlock key={index} index={index} lifted id={id} />
        ))}
        <rect className="cable-pin" x="220" y={pinY - 2.2} width="54" height="4.4" rx="2" />
        <circle className="cable-pin-head" cx="278" cy={pinY} r="9" />
        <path className="cable-pin-grip" d={`M274 ${pinY - 2.5}h8M274 ${pinY + 2.5}h8`} />
        <rect className="scene-steel" x="209" y="0" width="2" height={STACK_TOP - 2} />
      </g>
      <rect className="cable-drag" x={STACK.x} y={STACK_TOP} width={DRAG_RIGHT - STACK.x} height={FLOOR_Y - STACK_TOP} />
    </SceneFrame>
  )
}
