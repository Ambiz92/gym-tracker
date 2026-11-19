import { BAR_KG, platesPerSide } from '../../lib/plates'

// The scene's plates drawn at about a sixth of their size, to sit next to a number.
const SCALE = { diameter: 0.17, thickness: 0.28 }
const HEIGHT = 22
const MIN_THICKNESS = 3
const MIN_WIDTH = 22

interface PlateGlyphProps {
  /** Total barbell weight, bar included. */
  weight: number
}

/** A small bar with the plates of a load: the history's way of showing a barbell weight. */
export function PlateGlyph({ weight }: PlateGlyphProps) {
  const { plates } = platesPerSide(Math.max(weight, BAR_KG))
  let x = 2
  const drawn = plates.map((plate) => {
    const thickness = Math.max(MIN_THICKNESS, plate.thickness * SCALE.thickness)
    const diameter = plate.diameter * SCALE.diameter
    const at = x
    x += thickness + 1
    return (
      <rect
        key={at}
        className={`plate plate-tone--${plate.id}`}
        x={at}
        y={HEIGHT / 2 - diameter / 2}
        width={thickness}
        height={diameter}
        rx="1"
      />
    )
  })
  const width = Math.max(x + 4, MIN_WIDTH)

  return (
    <svg className="plate-glyph" viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
      <rect className="scene-steel" y={HEIGHT / 2 - 1} width={width} height="2" />
      {drawn}
    </svg>
  )
}
