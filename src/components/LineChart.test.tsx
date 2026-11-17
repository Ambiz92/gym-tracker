import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { ExerciseHistoryTable } from './ExerciseHistoryTable'
import { KpiRow } from './KpiRow'
import { LineChart } from './LineChart'

const points = [
  { x: 1, y: 25, axisLabel: 'S1', description: 'Settimana 1: 25 kg' },
  { x: 2, y: 30, axisLabel: 'S2', description: 'Settimana 2: 30 kg' },
]

test('LineChart is one named image plus a hidden text list of every point', () => {
  const html = renderToStaticMarkup(<LineChart points={points} summary="Da 25 a 30 kg" formatTick={String} />)
  expect(html).toContain('role="img"')
  expect(html).toContain('aria-label="Da 25 a 30 kg"')
  expect(html).toContain('<li>Settimana 1: 25 kg</li>')
  expect(html).toContain('<li>Settimana 2: 30 kg</li>')
  expect(html).toContain('>S2</text>')
  expect(html).toContain('>27.5</text>')
})

test('LineChart renders nothing without data', () => {
  expect(renderToStaticMarkup(<LineChart points={[]} summary="" formatTick={String} />)).toBe('')
})

test('KpiRow shows value then caption and marks the accent value', () => {
  const html = renderToStaticMarkup(
    <KpiRow items={[{ value: '25', label: 'kg partenza' }, { value: '+20%', label: 'vs sett. 1', accent: true }]} />,
  )
  expect(html).toContain('<strong class="kpi-row__value">25</strong><span class="kpi-row__label">kg partenza</span>')
  expect(html).toContain('kpi-row__value kpi-row__value--accent">+20%')
})

test('ExerciseHistoryTable has real headers and one line per set group', () => {
  const html = renderToStaticMarkup(
    <ExerciseHistoryTable rows={[{ key: 'w1', date: '17.11', sets: ['2×8 · 30 kg', '1×6 · 27,5 kg'] }]} />,
  )
  expect(html).toContain('<th scope="col">Data</th>')
  expect(html).toContain('<th scope="row">17.11</th>')
  expect(html).toContain('2×8 · 30 kg</span>')
  expect(html).toContain('1×6 · 27,5 kg</span>')
})
