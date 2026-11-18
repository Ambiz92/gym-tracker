import { expect, test } from 'vitest'
import { syncDocumentToRoute } from './RouteAnnouncer'

function fakeDocument(h1: string | null) {
  const focused: string[] = []
  const doc = {
    title: '',
    querySelector(selectors: string) {
      if (selectors === 'main h1') return h1 === null ? null : { textContent: h1, focus: () => undefined }
      return { textContent: null, focus: () => focused.push(selectors) }
    },
  }
  return { doc, focused }
}

test('titles the document after the page heading', () => {
  const { doc } = fakeDocument('  Storico ')
  syncDocumentToRoute(doc, false)
  expect(doc.title).toBe('Storico · Gym Tracker')
})

test('falls back to the app name when the page has no heading', () => {
  const { doc } = fakeDocument(null)
  syncDocumentToRoute(doc, false)
  expect(doc.title).toBe('Gym Tracker')
})

test('moves focus to main only after a navigation', () => {
  const first = fakeDocument('Oggi')
  syncDocumentToRoute(first.doc, false)
  expect(first.focused).toEqual([])

  const later = fakeDocument('Schede')
  syncDocumentToRoute(later.doc, true)
  expect(later.focused).toEqual(['main'])
})
