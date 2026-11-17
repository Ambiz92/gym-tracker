import { describe, expect, test } from 'vitest'
import { buildChartGeometry, type ChartLayout, type ChartPoint } from './lineChartScale'

const layout: ChartLayout = { width: 200, height: 100, left: 20, right: 0, top: 10, bottom: 10, inset: 0, minLabelGap: 30 }

const point = (x: number, y: number): ChartPoint => ({ x, y, axisLabel: `S${x}`, description: `week ${x}` })

describe('buildChartGeometry', () => {
  test('draws a step line: the value holds until the next week, then jumps', () => {
    const { line } = buildChartGeometry([point(1, 25), point(2, 25), point(4, 30)], layout)
    // plot x spans 20..200 over weeks 1..4, plot y spans 10..90 over 30..25
    expect(line).toBe('20,90 80,90 80,90 200,90 200,10')
  })

  test('maps the lowest value to the bottom and the highest to the top, with a middle tick', () => {
    const { ticks, marker } = buildChartGeometry([point(1, 25), point(2, 30)], layout)
    expect(ticks).toEqual([
      { value: 25, y: 90 },
      { value: 27.5, y: 50 },
      { value: 30, y: 10 },
    ])
    expect(marker).toEqual({ x: 200, y: 10 })
  })

  test('keeps the first and last point away from the plot edges by the inset', () => {
    const { line, plot } = buildChartGeometry([point(1, 1), point(2, 2)], { ...layout, inset: 12 })
    expect(plot).toEqual({ left: 20, right: 200, top: 10, bottom: 90 })
    expect(line.startsWith('32,')).toBe(true)
    expect(line).toContain('188,')
  })

  test('a single point, or a flat series, sits in the middle with one tick', () => {
    const single = buildChartGeometry([point(1, 20)], layout)
    expect(single.line).toBe('110,50')
    expect(single.ticks).toEqual([{ value: 20, y: 50 }])
    expect(single.marker).toEqual({ x: 110, y: 50 })

    const flat = buildChartGeometry([point(1, 20), point(2, 20)], layout)
    expect(flat.ticks).toHaveLength(1)
    expect(flat.line).toBe('20,50 200,50 200,50')
  })

  test('labels every point when there is room', () => {
    const { labels } = buildChartGeometry([point(1, 1), point(2, 2), point(3, 3)], layout)
    expect(labels.map((label) => label.index)).toEqual([0, 1, 2])
  })

  test('thins the labels when they would overlap but always keeps the first and last', () => {
    const points = Array.from({ length: 30 }, (_, i) => point(i + 1, i))
    const { labels } = buildChartGeometry(points, layout)
    expect(labels[0]!.index).toBe(0)
    expect(labels[labels.length - 1]!.index).toBe(29)
    expect(labels.length).toBeLessThan(10)
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i]!.x - labels[i - 1]!.x).toBeGreaterThanOrEqual(layout.minLabelGap)
    }
  })

  test('rejects an empty series', () => {
    expect(() => buildChartGeometry([], layout)).toThrow('at least one point')
  })
})
