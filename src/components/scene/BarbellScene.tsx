import { formatNumber } from '../../lib/formatNumber'
import { BAR_KG, platesPerSide, type Plate } from '../../lib/plates'
import { CENTER_Y, SceneFrame, ShadedRect, VerticalLabel, knurl, shade, sheen, useSceneId } from './SceneFrame'

const SLEEVE_START = 84
const PLATE_GAP = 2
const STAGGER_MS = 70
// Plates are labelled only when they are thick enough to hold the number.
const MIN_LABEL_THICKNESS = 14

interface PlacedPlate {
  plate: Plate
  x: number
}

function placePlates(plates: readonly Plate[]): { placed: PlacedPlate[]; end: number } {
  let x = SLEEVE_START
  const placed = plates.map((plate) => {
    const at = x
    x += plate.thickness + PLATE_GAP
    return { plate, x: at }
  })
  return { placed, end: x }
}

function describeLoad(weight: number, plates: readonly Plate[], exact: boolean): string {
  const bar = `Bilanciere: sbarra da ${BAR_KG} kg`
  const load = plates.length > 0 ? ` e ${plates.map((plate) => formatNumber(plate.kg)).join(', ')} kg per lato` : ' senza dischi'
  if (exact) return bar + load
  const problem = weight < BAR_KG ? 'è inferiore alla sbarra' : 'non si ottiene esattamente con i dischi'
  return `${bar}${load}. Il peso di ${formatNumber(weight)} kg ${problem}`
}

interface BarbellSceneProps {
  /** Total weight, bar included. */
  weight: number
}

/** A barbell with the competition plates of the weight on one side; the other side is off screen. */
export function BarbellScene({ weight }: BarbellSceneProps) {
  const id = useSceneId()
  const { plates, exact } = platesPerSide(weight)
  const { placed, end } = placePlates(plates)
  const tip = Math.max(end + 14, 280)

  return (
    <SceneFrame
      id={id}
      shadow={{ cx: end / 2 + 80, rx: end / 2 + 40 }}
      svgProps={{ role: 'img', 'aria-label': describeLoad(weight, plates, exact) }}
    >
      <g className="lifter">
        <rect className="scene-steel" x="0" y="76" width="90" height="8" />
        <rect x="0" y="76" width="64" height="8" fill={knurl(id)} />
        <rect x="0" y="76" width="90" height="8" fill={sheen(id)} />
        <ShadedRect className="scene-steel" x="72" y="62" width="12" height="36" rx="2" overlay={sheen(id)} />
        <ShadedRect className="scene-steel" x={SLEEVE_START} y="71" width={tip - SLEEVE_START} height="18" overlay={sheen(id)} />
        <path className="scene-steel" d={`M${tip} 71 l14 3 v12 l-14 3z`} />
        <g key={plates.map((plate) => plate.id).join('-')}>
          {placed.map(({ plate, x }, index) => (
            <g key={index} className={`plate-g plate-tone--${plate.id}`} style={{ animationDelay: `${index * STAGGER_MS}ms` }}>
              <ShadedRect className="plate" x={x} y={CENTER_Y - plate.diameter / 2} width={plate.thickness} height={plate.diameter} rx="4" overlay={shade(id)} />
              <rect className="plate-edge" x={x} y={CENTER_Y - plate.diameter / 2} width="2" height={plate.diameter} />
              {plate.thickness >= MIN_LABEL_THICKNESS && (
                <VerticalLabel className="plate__label" x={x} width={plate.thickness} dy={4}>
                  {formatNumber(plate.kg)}
                </VerticalLabel>
              )}
            </g>
          ))}
        </g>
        <ShadedRect className="scene-iron" x={end + 1} y="64" width="12" height="32" rx="3" overlay={sheen(id)} />
        <circle className="scene-hub" cx={end + 7} cy={CENTER_Y} r="2.6" />
      </g>
    </SceneFrame>
  )
}
