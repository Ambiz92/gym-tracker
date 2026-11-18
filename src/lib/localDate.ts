/** Local calendar date as YYYY-MM-DD. Never via `toISOString()`: that is UTC and shifts the day near midnight. */
export function localDateString(now: Date): string {
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
