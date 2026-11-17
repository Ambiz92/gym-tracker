const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'] as const

const pad = (value: number): string => String(value).padStart(2, '0')

/** "13.11" from a YYYY-MM-DD date. */
export function dayMonth(isoDate: string): string {
  const [, month = '', day = ''] = isoDate.split('-')
  return `${day}.${month}`
}

/** "Gio 17.11" for a local date. */
export function weekdayDayMonth(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${pad(date.getDate())}.${pad(date.getMonth() + 1)}`
}
