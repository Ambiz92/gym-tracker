// A leading tab or carriage return is also interpreted as a formula start by spreadsheets.
const FORMULA_START = /^[=+\-@\t\r]/
const NEEDS_QUOTING = /[",\r\n]/

function toCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const safe = FORMULA_START.test(text) ? `'${text}` : text
  return NEEDS_QUOTING.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/** RFC 4180 CSV (CRLF, no trailing newline). Text cells that look like formulas get a leading apostrophe. */
export function toCsv<Row extends object>(rows: readonly Row[], columns: readonly (keyof Row & string)[]): string {
  const header = columns.map(toCell).join(',')
  const lines = rows.map((row) => columns.map((column) => toCell(row[column])).join(','))
  return [header, ...lines].join('\r\n')
}

function sortKeys(_key: string, value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

/** Pretty-printed JSON with one array of rows per table and object keys in alphabetical order. */
export function toJson(tables: Readonly<Record<string, readonly unknown[]>>): string {
  return `${JSON.stringify(tables, sortKeys, 2)}\n`
}

/** Names an export file after the local calendar date, e.g. `gym-tracker-set_log-2026-11-17.csv`. */
export function exportFileName(kind: string, extension: 'csv' | 'json', now: Date): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `gym-tracker-${kind}-${year}-${month}-${day}.${extension}`
}
