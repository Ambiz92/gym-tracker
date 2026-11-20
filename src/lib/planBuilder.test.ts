import { describe, expect, it } from 'vitest'
import { activationStep, duplicateSessionName, footerState, nextSessionName, pickSession } from './planBuilder'

describe('nextSessionName', () => {
  it('starts at A and takes the first free letter', () => {
    expect(nextSessionName([])).toBe('A')
    expect(nextSessionName(['A', 'B'])).toBe('C')
    expect(nextSessionName(['A', 'C'])).toBe('B')
  })

  it('ignores case and spaces when looking for a taken letter', () => {
    expect(nextSessionName([' a ', 'b'])).toBe('C')
  })

  it('does not run out of names once the 26 letters are used', () => {
    expect(nextSessionName([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'])).toBe('Sessione 27')
  })
})

describe('duplicateSessionName', () => {
  it('gives a letter session the next free letter', () => {
    expect(duplicateSessionName('A', ['A', 'B'])).toBe('C')
  })

  it('names a session called something else "<name> (copia)"', () => {
    expect(duplicateSessionName('Upper body', ['Upper body'])).toBe('Upper body (copia)')
  })

  it('numbers further copies of the same session', () => {
    expect(duplicateSessionName('Upper body', ['Upper body', 'Upper body (copia)'])).toBe('Upper body (copia 2)')
    expect(duplicateSessionName('Upper body', ['Upper body (copia)', 'upper body (copia 2)'])).toBe('Upper body (copia 3)')
  })

  it('falls back to a copy name for a letter when every letter is taken', () => {
    expect(duplicateSessionName('A', [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'])).toBe('A (copia)')
  })

  it('keeps the copy name within the 120-character limit', () => {
    const name = duplicateSessionName('x'.repeat(120), [])
    expect([...name]).toHaveLength(120)
    expect(name.endsWith(' (copia)')).toBe(true)
  })
})

describe('pickSession', () => {
  const sessions = [{ id: 'a' }, { id: 'b' }]

  it('returns the chosen session', () => {
    expect(pickSession(sessions, 'b')).toBe(sessions[1])
  })

  it('falls back to the first when nothing is chosen or the chosen one is gone', () => {
    expect(pickSession(sessions, null)).toBe(sessions[0])
    expect(pickSession(sessions, 'gone')).toBe(sessions[0])
  })

  it('is null for a plan without sessions', () => {
    expect(pickSession([], 'a')).toBeNull()
  })
})

describe('activationStep', () => {
  it('turns an active plan off', () => {
    expect(activationStep({ is_active: true }, false)).toBe('deactivate')
  })

  it('activates straight away when no other plan is active', () => {
    expect(activationStep({ is_active: false }, false)).toBe('activate')
  })

  it('asks before replacing the plan that is active now', () => {
    expect(activationStep({ is_active: false }, true)).toBe('confirm-replace')
  })
})

describe('footerState', () => {
  it('says a draft stays out of Oggi and cannot be activated while empty', () => {
    expect(footerState({ is_active: false, archived: false }, 0)).toEqual({
      status: 'Bozza · non compare in Oggi',
      button: { label: 'Attiva', pressed: false, disabled: true },
    })
    expect(footerState({ is_active: false, archived: false }, 1).button?.disabled).toBe(false)
  })

  it('shows an active plan as pressed, and lets it be turned off even when empty', () => {
    expect(footerState({ is_active: true, archived: false }, 0)).toEqual({
      status: 'Attiva · compare in Oggi',
      button: { label: '✓ Attiva', pressed: true, disabled: false },
    })
  })

  it('has no button on an archived plan', () => {
    expect(footerState({ is_active: false, archived: true }, 5).button).toBeNull()
  })
})
