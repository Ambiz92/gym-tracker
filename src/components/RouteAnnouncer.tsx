import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const APP_NAME = 'Gym Tracker'

interface PageDocument {
  title: string
  querySelector(selectors: string): { textContent: string | null; focus(): void } | null
}

/** Titles the document after the page's h1 and, after a navigation, moves focus to <main>. */
export function syncDocumentToRoute(doc: PageDocument, moveFocus: boolean) {
  const heading = doc.querySelector('main h1')?.textContent?.trim()
  doc.title = heading ? `${heading} · ${APP_NAME}` : APP_NAME
  if (moveFocus) doc.querySelector('main')?.focus()
}

/** Renders nothing; keeps the title and focus in step with the route, without stealing focus on first load. */
export function RouteAnnouncer() {
  const { pathname } = useLocation()
  const previousPathname = useRef<string | null>(null)

  useEffect(() => {
    const navigated = previousPathname.current !== null && previousPathname.current !== pathname
    syncDocumentToRoute(document, navigated)
    previousPathname.current = pathname
  }, [pathname])

  return null
}
