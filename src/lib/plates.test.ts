import { describe, expect, it } from 'vitest'
import {
  BAR_KG,
  PLATES,
  cableBlock,
  cableWeightAt,
  platesPerSide,
  rulerMax,
  rulerValueAt,
  rulerX,
} from './plates'

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

  it('reports an exact load when the plates add up', () => {
    expect(platesPerSide(62.5).exact).toBe(true)
    expect(platesPerSide(45).exact).toBe(true)
  })

  it('draws what fits and flags a weight the plates cannot reach', () => {
    expect(platesPerSide(21)).toEqual({ plates: [], exact: false })
    expect(kgs(23)).toEqual([1.25])
    expect(platesPerSide(23).exact).toBe(false)
  })

  it('does not drift on decimal weights', () => {
    expect(platesPerSide(22.5).exact).toBe(true)
    expect(kgs(22.5)).toEqual([1.25])
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
