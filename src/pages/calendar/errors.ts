import { DataError } from '../../data/client'

/** Italian message for a failed calendar action; `fallback` covers anything without a specific wording. */
export function describeScheduleError(cause: unknown, fallback: string): string {
  if (cause instanceof DataError) {
    if (cause.code === 'already_scheduled') return 'Questa sessione è già in programma in uno dei giorni scelti.'
    if (cause.code === 'not_planned') {
      return 'La sessione non è più in programma (fatta, saltata o già cambiata): aggiorna il calendario.'
    }
    if (cause.code === 'not_deletable') return 'Si possono eliminare solo le sessioni in programma da oggi in poi.'
  }
  return fallback
}
