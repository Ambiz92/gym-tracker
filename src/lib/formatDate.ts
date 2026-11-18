const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'] as const

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'] as const

const pad = (value: number): string => String(value).padStart(2, '0')

/** "13.11" from a YYYY-MM-DD date. */
export function dayMonth(isoDate: string): string {
  const [, month = '', day = ''] = isoDate.split('-')
  return `${day}.${month}`
}

/** "13 nov" from a YYYY-MM-DD date. */
export function dayMonthName(isoDate: string): string {
  const [, month = '', day = ''] = isoDate.split('-')
  return `${Number(day)} ${MONTHS[Number(month) - 1]}`
}

/** "Gio 17.11" for a local date. */
export function weekdayDayMonth(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${pad(date.getDate())}.${pad(date.getMonth() + 1)}`
}
