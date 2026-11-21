import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { MAX_REPEAT_WEEKS } from '../../lib/calendar'
import { SchedulePicker } from './SchedulePicker'

const sessions = [
  { id: 's1', name: 'Upper body' },
  { id: 's2', name: 'Lower body' },
]

function render(props: Partial<Parameters<typeof SchedulePicker>[0]> = {}) {
  return renderToStaticMarkup(
    <SchedulePicker sessions={sessions} date="2026-11-27" today="2026-11-21" onSaved={() => undefined} onClose={() => undefined} {...props} />,
  )
}

test('is a labelled dialog with a title and a close button', () => {
  const html = render()
  expect(html).toMatch(/<dialog[^>]*aria-labelledby="([^"]+)"/)
  expect(html).toContain('Pianifica una sessione')
  expect(html).toContain('>Chiudi<')
})

test('offers exactly the sessions it is given, the first one chosen', () => {
  const html = render()
  expect(html).toContain('<option value="s1" selected="">Upper body</option>')
  expect(html).toContain('<option value="s2">Lower body</option>')
})

test('a preselected session wins over the first', () => {
  expect(render({ sessionId: 's2' })).toContain('<option value="s2" selected="">Lower body</option>')
})

test('the day field starts on the given day and cannot go before today', () => {
  const html = render()
  expect(html).toMatch(/<input[^>]*type="date"[^>]*min="2026-11-21"[^>]*value="2026-11-27"/)
})

test('the repeat field goes from a single day up to the maximum number of weeks', () => {
  const html = render()
  expect(html).toContain('>Solo questo giorno<')
  expect(html).toContain('>Ripeti per 2 settimane<')
  expect(html).toContain(`>Ripeti per ${MAX_REPEAT_WEEKS} settimane<`)
  expect(html).not.toContain(`Ripeti per ${MAX_REPEAT_WEEKS + 1} settimane`)
})

test('starts with no error and a plain submit button', () => {
  const html = render()
  expect(html).not.toContain('role="alert"')
  expect(html).not.toContain('field__message')
  expect(html).toMatch(/type="submit"[^>]*><span>Pianifica<\/span>/)
})

test('without sessions it says so and offers no form fields', () => {
  const html = render({ sessions: [] })
  expect(html).toContain('La scheda attiva non ha sessioni da pianificare.')
  expect(html).not.toContain('<select')
  expect(html).not.toContain('type="submit"')
})
