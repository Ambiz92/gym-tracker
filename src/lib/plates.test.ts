import { describe, expect, it } from 'vitest'
import {
  BAR_KG,
  MAX_KG_PER_SIDE,
  MAX_PLATES_PER_SIDE,
  PLATES,
  cableBlock,
  cableWeightAt,
  perSideFromTotal,
  placePlates,
  platesPerSide,
  rulerMax,
  rulerValueAt,
  rulerX,
  stepBarbellTotal,
  totalFromPerSide,
} from './plates'
import { MAX_WEIGHT_KG } from './validation'

const kgs = (total: number) => platesPerSide(total).plates.map((plate) => plate.kg)

describe('platesPerSide', () => {
  it('draws the bare bar at and below the bar weight', () => {
    expect(platesPerSide(BAR_KG)).toEqual({ plates: [], exact: true })
    expect(platesPerSide(15)).toEqual({ plates: [], exact: false })
    expect(platesPerSide(0)).toEqual({ plates: [], exact: false })
  })

  it('fills each side greedily with the heaviest plates first', () => {
    expect(kgs(62.5)).toEqual([20, 1.25])
    expect(kgs(100)).toEqual([25, 15])
    expect(kgs(60)).toEqual([20])
    expect(kgs(190)).toEqual([25, 25, 25, 10])
  })

  it('never calls a weight above the logger maximum exact', () => {
    expect(platesPerSide(MAX_WEIGHT_KG + 5).exact).toBe(false)
  })

  it('reports an exact load when the plates add up', () => {
    expect(platesPerSide(62.5).exact).toBe(true)
    expect(platesPerSide(45).exact).toBe(true)
  })

  it('draws what fits and flags a weight the plates cannot reach', () => {
    expect(platesPerSide(21)).toEqual({ plates: [], exact: false })
    expect(kgs(23)).toEqual([1.25])
    expect(platesPerSide(23).exact).toBe(false)
  })

  it('draws nothing for a weight that is not a finite number', () => {
    for (const weight of [Infinity, -Infinity, NaN]) expect(platesPerSide(weight)).toEqual({ plates: [], exact: false })
  })

  it('treats a huge weight as the largest the logger takes', () => {
    expect(platesPerSide(1e12)).toEqual(platesPerSide(1000))
    expect(platesPerSide(1000).plates.length).toBeLessThanOrEqual(MAX_PLATES_PER_SIDE)
  })

  it('never puts more plates on a side than the cap, and says the load is not exact', () => {
    const load = platesPerSide(900)
    expect(load.plates).toHaveLength(MAX_PLATES_PER_SIDE)
    expect(load.exact).toBe(false)
  })

  it('does not drift on decimal weights', () => {
    expect(platesPerSide(22.5).exact).toBe(true)
    expect(kgs(22.5)).toEqual([1.25])
  })
})

describe('placePlates', () => {
  const plates = PLATES.filter((plate) => [25, 5].includes(plate.kg))

  it('lays the plates side by side from the start, with the gap', () => {
    const { placed, end } = placePlates(plates, { start: 84, gap: 2, widthOf: (plate) => plate.thickness })
    expect(placed.map(({ x, width }) => [x, width])).toEqual([
      [84, 24],
      [110, 14],
    ])
    expect(end).toBe(126)
  })

  it('measures each plate with the given width', () => {
    const { placed } = placePlates(plates, { start: 0, gap: 0, widthOf: () => 3 })
    expect(placed.map(({ x }) => x)).toEqual([0, 3])
  })

  it('ends at the start when there are no plates', () => {
    expect(placePlates([], { start: 84, gap: 2, widthOf: (plate) => plate.thickness })).toEqual({ placed: [], end: 84 })
  })
})

it('gives the four competition plates one diameter and decreasing thickness', () => {
  const competition = PLATES.filter((plate) => plate.kg >= 10)
  expect(new Set(competition.map((plate) => plate.diameter)).size).toBe(1)
  const thickness = competition.map((plate) => plate.thickness)
  expect(thickness).toEqual([...thickness].sort((a, b) => b - a))
  for (const small of PLATES.filter((plate) => plate.kg < 10)) expect(small.diameter).toBeLessThan(competition[0].diameter)
})

describe('cable stack', () => {
  it('maps a weight to its block, clamped to the stack', () => {
    expect(cableBlock(25)).toBe(5)
    expect(cableBlock(5)).toBe(1)
    expect(cableBlock(0)).toBe(1)
    expect(cableBlock(500)).toBe(11)
  })

  it('maps a vertical offset to the weight of the block under it', () => {
    expect(cableWeightAt(0, 12)).toBe(5)
    expect(cableWeightAt(11.9, 12)).toBe(5)
    expect(cableWeightAt(12, 12)).toBe(10)
    expect(cableWeightAt(131, 12)).toBe(55)
  })
})

describe('ruler', () => {
  it('uses 90 seconds or 60 meters, growing by whole scales for larger values', () => {
    expect(rulerMax('seconds', 30)).toBe(90)
    expect(rulerMax('meters', 60)).toBe(60)
    expect(rulerMax('seconds', 100)).toBe(180)
    expect(rulerMax('meters', 61)).toBe(120)
    expect(rulerMax('seconds', 0)).toBe(90)
  })

  it('converts between value and position', () => {
    expect(rulerX(0, 90, 84, 276)).toBe(84)
    expect(rulerX(90, 90, 84, 276)).toBe(276)
    expect(rulerX(45, 90, 84, 276)).toBe(180)
    expect(rulerX(500, 90, 84, 276)).toBe(276)
    expect(rulerValueAt(180, 90, 84, 276)).toBe(45)
  })
})

describe('perSideFromTotal', () => {
  it('takes the bar off and halves the rest', () => {
    expect(perSideFromTotal(62.5)).toBe(21.25)
    expect(perSideFromTotal(BAR_KG)).toBe(0)
    expect(perSideFromTotal(142.5)).toBe(61.25)
  })

  it('reads a total below the bar as an empty side, never a negative one', () => {
    expect(perSideFromTotal(15)).toBe(0)
    expect(perSideFromTotal(0)).toBe(0)
  })

  it('rounds to cents', () => {
    expect(perSideFromTotal(62.51)).toBe(21.26)
  })
})

describe('totalFromPerSide', () => {
  it('doubles the side and adds the bar', () => {
    expect(totalFromPerSide(21.25)).toBe(62.5)
    expect(totalFromPerSide(0)).toBe(BAR_KG)
  })

  it('rounds to cents', () => {
    expect(totalFromPerSide(1.005)).toBe(22.01)
  })

  it('keeps the total between the bare bar and the logger maximum', () => {
    expect(totalFromPerSide(-5)).toBe(BAR_KG)
    expect(totalFromPerSide(MAX_KG_PER_SIDE)).toBe(MAX_WEIGHT_KG)
    expect(totalFromPerSide(MAX_KG_PER_SIDE + 100)).toBe(MAX_WEIGHT_KG)
  })

  it('round-trips with perSideFromTotal above the bar', () => {
    expect(totalFromPerSide(perSideFromTotal(87.5))).toBe(87.5)
  })
})

describe('stepBarbellTotal', () => {
  it('moves one side, so the total moves twice as much', () => {
    expect(stepBarbellTotal(62.5, 1.25)).toBe(65)
    expect(stepBarbellTotal(62.5, -1.25)).toBe(60)
  })

  it('goes from a total below the bar to the first step over it', () => {
    expect(stepBarbellTotal(15, 1.25)).toBe(22.5)
  })

  it('does not go below the bare bar or the stored value', () => {
    expect(stepBarbellTotal(BAR_KG, -1.25)).toBe(BAR_KG)
    expect(stepBarbellTotal(15, -1.25)).toBe(15)
  })

  it('stops at the logger maximum', () => {
    expect(stepBarbellTotal(MAX_WEIGHT_KG, 1.25)).toBe(MAX_WEIGHT_KG)
  })
})
