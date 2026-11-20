import { placePlates, platesPerSide } from '../../lib/plates'

// The scene's plates drawn at about a sixth of their size, to sit next to a number.
const SCALE = { diameter: 0.17, thickness: 0.28 }
const HEIGHT = 22
const MIN_THICKNESS = 3
const MIN_WIDTH = 22
const BAR_START = 2
const PLATE_GAP = 1

interface PlateGlyphProps {
  /** Load of one side in kg. */
  weight: number
}

/** A small bar with the plates of a load: the history's way of showing a barbell weight. */
export function PlateGlyph({ weight }: PlateGlyphProps) {
  const { plates } = platesPerSide(weight)
  const { placed, end } = placePlates(plates, {
    start: BAR_START,
    gap: PLATE_GAP,
    widthOf: (plate) => Math.max(MIN_THICKNESS, plate.thickness * SCALE.thickness),
  })
  const glyphWidth = Math.max(end + 4, MIN_WIDTH)

  return (
    <svg className="plate-glyph" viewBox={`0 0 ${glyphWidth} ${HEIGHT}`} aria-hidden="true">
      <rect className="scene-steel" y={HEIGHT / 2 - 1} width={glyphWidth} height="2" />
      {placed.map(({ plate, x, width }) => {
        const diameter = plate.diameter * SCALE.diameter
        return (
          <rect
            key={x}
            className={`plate plate-tone--${plate.id}`}
            x={x}
            y={HEIGHT / 2 - diameter / 2}
            width={width}
            height={diameter}
            rx="1"
          />
        )
      })}
    </svg>
  )
}
