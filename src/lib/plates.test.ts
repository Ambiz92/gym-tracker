import { describe, expect, it } from 'vitest'
import {
  MAX_PLATES_PER_SIDE,
  PLATES,
  cableBlock,
  cableWeightAt,
  placePlates,
  platesPerSide,
  rulerMax,
  rulerValueAt,
  rulerX,
} from './plates'
import { MAX_KG_PER_SIDE } from './validation'

// The weight is the load of ONE side: the plates drawn add up to it, with no halving and no bar.
const kgs = (sideKg: number) => platesPerSide(sideKg).plates.map((plate) => plate.kg)

describe('platesPerSide', () => {
  it('draws no plates for no weight, and nothing for a negative one', () => {
    expect(platesPerSide(0)).toEqual({ plates: [], exact: true })
    expect(platesPerSide(-5)).toEqual({ plates: [], exact: false })
  })

  it('draws the plates that add up to the weight itself, for one side', () => {
    expect(kgs(15)).toEqual([15])
    expect(kgs(17.5)).toEqual([15, 2.5])
    expect(kgs(7.5)).toEqual([5, 2.5])
    expect(platesPerSide(15).exact).toBe(true)
  })

  it('fills the side greedily with the heaviest plates first', () => {
    expect(kgs(62.5)).toEqual([25, 25, 10, 2.5])
    expect(kgs(100)).toEqual([25, 25, 25, 25])
    expect(kgs(40)).toEqual([25, 15])
    expect(kgs(150)).toEqual([25, 25, 25, 25, 25, 25])
  })

  it('never calls a weight above the logger maximum exact', () => {
    expect(platesPerSide(MAX_KG_PER_SIDE + 5).exact).toBe(false)
  })

  it('reports an exact load when the plates add up', () => {
    expect(platesPerSide(62.5).exact).toBe(true)
    expect(platesPerSide(45).exact).toBe(true)
    expect(platesPerSide(2 * 62.5).exact).toBe(true)
  })

  it('draws what fits and flags a weight the plates cannot reach', () => {
    expect(platesPerSide(1)).toEqual({ plates: [], exact: false })
    expect(kgs(3)).toEqual([2.5])
    expect(platesPerSide(3).exact).toBe(false)
  })

  it('draws nothing for a weight that is not a finite number', () => {
    for (const weight of [Infinity, -Infinity, NaN]) expect(platesPerSide(weight)).toEqual({ plates: [], exact: false })
  })

  it('treats a huge weight as the largest the logger takes', () => {
    expect(platesPerSide(1e12)).toEqual(platesPerSide(MAX_KG_PER_SIDE))
    expect(platesPerSide(1e12).plates.length).toBeLessThanOrEqual(MAX_PLATES_PER_SIDE)
  })

  it('never puts more plates on a side than the cap, and says the load is not exact', () => {
    const load = platesPerSide(450)
    expect(load.plates).toHaveLength(MAX_PLATES_PER_SIDE)
    expect(load.exact).toBe(false)
  })

  it('does not drift on decimal weights', () => {
    expect(platesPerSide(1.25).exact).toBe(true)
    expect(kgs(1.25)).toEqual([1.25])
    expect(kgs(3.75)).toEqual([2.5, 1.25])
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
