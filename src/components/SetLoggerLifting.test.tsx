import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { SetLogger } from './SetLogger'

vi.mock('./useLiftConfirm', () => ({ useLiftConfirm: () => ({ lifting: true, confirm: vi.fn() }) }))

const noop = () => {}

it('locks the numbers, the step buttons and the scene while the save lift runs, but not the way back', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <SetLogger
        exercise={{ name: 'Curl', muscles: null, executionSteps: null }}
        unit="reps"
        setNumber={1}
        targetSets={3}
        position={{ current: 1, total: 2 }}
        initial={{ weight: 15, reps: 10, equipment: 'other' }}
        hint=""
        backTo="/session/s1"
        onBack={noop}
        toast={null}
        onConfirm={noop}
      />
    </MemoryRouter>,
  )
  // The weight and its hint, the scene and the controls: one inert region each.
  expect(html.match(/inert=""/g)).toHaveLength(3)
  expect(html).toMatch(/<div inert=""><div class="number-stepper">/)
  expect(html).toMatch(/<div class="logger__controls" inert="">/)
  expect(html).toMatch(/<div class="scene scene--lifting" inert="">/)
  expect(html.indexOf('Torna alla sessione')).toBeGreaterThan(-1)
  expect(html.indexOf('Torna alla sessione')).toBeLessThan(html.indexOf('inert'))
})
