/** Number as Italians read it: comma decimal, no thousands separator, at most two decimals. */
export function formatNumber(value: number): string {
  return value.toLocaleString('it-IT', { useGrouping: false, maximumFractionDigits: 2 })
}
