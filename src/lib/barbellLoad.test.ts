import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { toDisplayKg, toStoredKg } from './barbellLoad'

describe('toStoredKg', () => {
  it('stores the total of both sides of a barbell, bar excluded', () => {
    expect(toStoredKg('barbell', 15)).toBe(30)
    expect(toStoredKg('barbell', 1.25)).toBe(2.5)
    expect(toStoredKg('barbell', 0)).toBe(0)
  })

  it('rounds to the hundredths of the numeric(6, 2) column', () => {
    expect(toStoredKg('barbell', 12.345)).toBe(24.69)
  })

  it('leaves dumbbell and other weights as they are', () => {
    expect(toStoredKg('dumbbell', 12.5)).toBe(12.5)
    expect(toStoredKg('other', 40)).toBe(40)
  })
})

describe('toDisplayKg', () => {
  it('shows one side of a stored barbell total', () => {
    expect(toDisplayKg('barbell', 30)).toBe(15)
    expect(toDisplayKg('barbell', 2.5)).toBe(1.25)
    expect(toDisplayKg('barbell', 1.25)).toBe(0.63)
  })

  it('leaves dumbbell and other weights as they are', () => {
    expect(toDisplayKg('dumbbell', 12.5)).toBe(12.5)
    expect(toDisplayKg('other', 40)).toBe(40)
  })

  it('keeps a missing weight missing', () => {
    expect(toDisplayKg('barbell', null)).toBeNull()
    expect(toDisplayKg('dumbbell', null)).toBeNull()
  })

  it('undoes toStoredKg', () => {
    for (const perSide of [0, 1.25, 7.5, 62.5, 500]) expect(toDisplayKg('barbell', toStoredKg('barbell', perSide))).toBe(perSide)
  })
})

// Guard for the convention: barbellLoad.ts is the only place that doubles or halves a weight, so a screen
// cannot show a stored total as a side, or the other way round, by a stray `* 2`.

const SRC_DIR = fileURLToPath(new URL('../', import.meta.url))
const HELPER = join(SRC_DIR, 'lib/barbellLoad.ts')

const COMMENT = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g
const WEIGHT_WORD = /kg|weight|load|side/i
const BY_TWO = /\*\s*2\b|\b2\s*\*|\/\s*2\b|\b2\s*\//

/** Lines of `code` that multiply or divide a weight by two. Works on source text, so it is stricter than it has to be. */
export function doubledWeightLines(code: string): string[] {
  return code
    .replace(COMMENT, (match) => match.replace(/[^\n]/g, ' '))
    .split('\n')
    .filter((line) => WEIGHT_WORD.test(line) && BY_TWO.test(line))
    .map((line) => line.trim())
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe('the only place that converts a weight by two', () => {
  it('flags a weight multiplied or divided by two, and ignores comments and geometry', () => {
    expect(doubledWeightLines('const total = 2 * sideKg')).toHaveLength(1)
    expect(doubledWeightLines('const side = weight / 2')).toHaveLength(1)
    expect(doubledWeightLines('const half = width / 2 // the weight of a plate: weight * 2')).toEqual([])
    expect(doubledWeightLines('/* weight * 2 */')).toEqual([])
  })

  it('is barbellLoad.ts for every file under src', () => {
    const offenders = sourceFiles(SRC_DIR)
      .filter((path) => path !== HELPER)
      .flatMap((path) => doubledWeightLines(readFileSync(path, 'utf8')).map((line) => `${relative(SRC_DIR, path)}: ${line}`))
    expect(offenders).toEqual([])
  })
})
