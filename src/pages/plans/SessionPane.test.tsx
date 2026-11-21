import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import type { SessionDetail } from '../../data/activePlan'
import { SessionPane } from './SessionPane'

const noop = () => {}

const session: SessionDetail = {
  id: 's1',
  owner_id: 'u1',
  plan_id: 'p1',
  name: 'Full body',
  subtitle: null,
  position: 0,
  is_optional: false,
  archived: false,
  exercises: [],
  warmup: [],
}

function render(plannable: Parameters<typeof SessionPane>[0]['plannable']) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SessionPane
        session={session}
        sessionNames={['Full body']}
        plannable={plannable}
        position={{ index: 0, count: 1 }}
        planBusy={false}
        onChange={noop}
        onRemoved={noop}
        onDuplicated={noop}
        onMoveSession={noop}
        onUndoable={noop}
      />
    </MemoryRouter>,
  )
}

test('the session of the active plan offers "Pianifica", with no picker or confirmation until it is used', () => {
  const html = render([{ id: 's1', name: 'Full body' }])
  expect(html).toContain('Pianifica sessione')
  expect(html).not.toContain('<dialog')
  expect(html).not.toContain('Sessione pianificata')
})

test('a plan that is not the active one cannot be scheduled from', () => {
  expect(render(null)).not.toContain('Pianifica')
})
