import { describe, expect, test } from 'vitest'
import { applyTheme, parseTheme, readTheme, saveTheme } from './theme'

function fakeRoot() {
  const attributes = new Map<string, string>()
  return {
    attributes,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
  }
}

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

const throwing = () => {
  throw new Error('SecurityError')
}

test('parseTheme accepts the two explicit themes and treats anything else as auto', () => {
  expect(parseTheme('light')).toBe('light')
  expect(parseTheme('dark')).toBe('dark')
  expect(parseTheme('auto')).toBe('auto')
  expect(parseTheme(null)).toBe('auto')
  expect(parseTheme('sepia')).toBe('auto')
})

test('applyTheme sets data-theme for light and dark and removes it for auto', () => {
  const root = fakeRoot()
  applyTheme('dark', root)
  expect(root.attributes.get('data-theme')).toBe('dark')
  applyTheme('auto', root)
  expect(root.attributes.has('data-theme')).toBe(false)
})

describe('storage', () => {
  test('a saved choice is applied and read back', () => {
    const storage = fakeStorage()
    const root = fakeRoot()
    saveTheme('light', () => storage, root)
    expect(root.attributes.get('data-theme')).toBe('light')
    expect(readTheme(() => storage)).toBe('light')
  })

  test('blocked storage still applies the theme and reads as auto', () => {
    const root = fakeRoot()
    expect(() => saveTheme('dark', throwing, root)).not.toThrow()
    expect(root.attributes.get('data-theme')).toBe('dark')
    expect(readTheme(throwing)).toBe('auto')
  })

  test('a corrupted stored value reads as auto', () => {
    expect(readTheme(() => fakeStorage({ 'gym-tracker.theme': '??' }))).toBe('auto')
  })
})
