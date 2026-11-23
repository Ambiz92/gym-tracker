// Test doubles for the coach/athlete links: a row builder and a provider that serves a fixed state. No network.

import type { ReactNode } from 'react'
import type { CoachLinks } from '../../data/coachLinks'
import type { CoachLink } from '../../types/db'
import { CoachLinksContext, type CoachLinksState } from './CoachLinksProvider'

export const ME = '3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b'
export const OTHER = '9a7b0c1d-2e3f-4a5b-8c1e-5d4a4e6f3f2b'

/** An active link where `ME` is the athlete; override what a test cares about. */
export function makeLink(overrides: Partial<CoachLink> = {}): CoachLink {
  return {
    id: 'l1',
    coach_id: OTHER,
    athlete_id: ME,
    status: 'active',
    athlete_label: 'Marta',
    consent_version: 'consent-v1',
    created_at: '2026-11-20T10:00:00Z',
    accepted_at: '2026-11-20T10:00:00Z',
    revoked_at: null,
    revoked_by: null,
    ...overrides,
  }
}

type Fixed = Pick<CoachLinks, 'asAthlete' | 'asCoach'> | 'loading' | Error

/** Serves `fixed` to everything under it, as the real provider would after loading. */
export function LinksStub({ fixed = { asAthlete: [], asCoach: [] }, children }: { fixed?: Fixed; children: ReactNode }) {
  const reload = () => undefined
  let state: CoachLinksState
  if (fixed === 'loading') state = { status: 'loading', reload }
  else if (fixed instanceof Error) state = { status: 'error', error: fixed, reload }
  else state = { status: 'ready', data: { userId: ME, ...fixed }, reload }
  return <CoachLinksContext.Provider value={state}>{children}</CoachLinksContext.Provider>
}
