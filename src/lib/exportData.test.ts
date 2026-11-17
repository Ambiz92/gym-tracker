import { describe, expect, it } from 'vitest'
import { exportFileName, toCsv, toJson } from './exportData'

interface Row {
  id: string
  name: string | null
  weight: number | null
}

describe('toCsv', () => {
  it('writes a header and CRLF separated rows', () => {
    const rows: Row[] = [
      { id: 'a', name: 'Panca', weight: 15 },
      { id: 'b', name: 'Rematore', weight: 25.5 },
    ]
    expect(toCsv(rows, ['id', 'name', 'weight'])).toBe('id,name,weight\r\na,Panca,15\r\nb,Rematore,25.5')
  })

  it('writes only the header for empty input', () => {
    expect(toCsv<Row>([], ['id', 'name'])).toBe('id,name')
  })

  it('follows the column order and ignores other fields', () => {
    expect(toCsv<Row>([{ id: 'a', name: 'x', weight: 1 }], ['weight', 'id'])).toBe('weight,id\r\n1,a')
  })

  it('writes null and undefined as empty cells', () => {
    expect(toCsv<Row>([{ id: 'a', name: null, weight: null }], ['id', 'name', 'weight'])).toBe('id,name,weight\r\na,,')
    expect(toCsv([{ id: 'a' } as Row], ['id', 'name'])).toBe('id,name\r\na,')
  })

  it('writes booleans as true or false', () => {
    expect(toCsv([{ archived: false }, { archived: true }], ['archived'])).toBe('archived\r\nfalse\r\ntrue')
  })

  it('quotes cells with commas, quotes and newlines', () => {
    const rows = [{ text: 'a,b' }, { text: 'say "hi"' }, { text: 'line1\nline2' }, { text: 'line1\r\nline2' }]
    expect(toCsv(rows, ['text'])).toBe('text\r\n"a,b"\r\n"say ""hi"""\r\n"line1\nline2"\r\n"line1\r\nline2"')
  })

  it('does not quote plain text with spaces', () => {
    expect(toCsv([{ text: 'Panca piana' }], ['text'])).toBe('text\r\nPanca piana')
  })

  it('quotes the header when a column name needs it', () => {
    expect(toCsv([{ 'a,b': 1 }], ['a,b'])).toBe('"a,b"\r\n1')
  })

  describe('formula injection', () => {
    it.each(['=SUM(A1)', '+1', '-1', '@cmd', '\tx', '\rx'])('prefixes text starting with %j', (text) => {
      const csv = toCsv([{ text }], ['text'])
      const cell = csv.split('\r\n').slice(1).join('\r\n')
      expect(cell.replace(/^"|"$/g, '')).toBe(`'${text}`)
    })

    it('prefixes before quoting', () => {
      expect(toCsv([{ text: '=HYPERLINK("x","y")' }], ['text'])).toBe('text\r\n"\'=HYPERLINK(""x"",""y"")"')
    })

    it('keeps number-typed negatives as plain numbers', () => {
      expect(toCsv([{ delta: -2.5 }], ['delta'])).toBe('delta\r\n-2.5')
    })

    it('prefixes negative numbers stored as text', () => {
      expect(toCsv([{ delta: '-2.5' }], ['delta'])).toBe("delta\r\n'-2.5")
    })

    it('leaves symbols that are not at the start alone', () => {
      expect(toCsv([{ text: 'a=b+c-d@e' }], ['text'])).toBe('text\r\na=b+c-d@e')
    })
  })

  it('serializes objects as JSON text', () => {
    expect(toCsv([{ tags: ['a', 'b'] }], ['tags'])).toBe('tags\r\n"[""a"",""b""]"')
  })
})

describe('toJson', () => {
  it('writes one object keyed by table name, pretty-printed with a trailing newline', () => {
    const json = toJson({ exercise: [{ id: 'a', name: 'Panca' }], plan: [] })
    expect(json).toBe('{\n  "exercise": [\n    {\n      "id": "a",\n      "name": "Panca"\n    }\n  ],\n  "plan": []\n}\n')
  })

  it('is stable regardless of key insertion order', () => {
    const a = toJson({ b: [{ y: 1, x: 2 }], a: [] })
    const b = toJson({ a: [], b: [{ x: 2, y: 1 }] })
    expect(a).toBe(b)
    expect(Object.keys(JSON.parse(a))).toEqual(['a', 'b'])
  })

  it('keeps row order and nulls, and round-trips', () => {
    const tables = { set_log: [{ id: 2, rpe: null }, { id: 1, rpe: 8.5 }] }
    expect(JSON.parse(toJson(tables))).toEqual(tables)
    expect(JSON.parse(toJson(tables)).set_log.map((row: { id: number }) => row.id)).toEqual([2, 1])
  })

  it('handles no tables', () => {
    expect(toJson({})).toBe('{}\n')
  })
})

describe('exportFileName', () => {
  it('uses the local calendar date', () => {
    expect(exportFileName('all', 'json', new Date(2026, 10, 17, 23, 59, 59))).toBe('gym-tracker-all-2026-11-17.json')
    expect(exportFileName('set_log', 'csv', new Date(2026, 10, 17, 0, 0, 1))).toBe('gym-tracker-set_log-2026-11-17.csv')
  })

  it('zero-pads month and day', () => {
    expect(exportFileName('all', 'csv', new Date(2027, 0, 5))).toBe('gym-tracker-all-2027-01-05.csv')
  })
})
