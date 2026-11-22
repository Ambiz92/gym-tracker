import { DataError } from '../../data/client'
import { describeCommonDataError } from '../dataErrors'

/** Italian message for a failed calendar action; `fallback` covers anything without a specific wording. */
export function describeScheduleError(cause: unknown, fallback: string): string {
  const common = describeCommonDataError(cause)
  if (common) return common
  if (cause instanceof DataError) {
    if (cause.code === 'already_scheduled') return 'Questa sessione è già in programma in uno dei giorni scelti.'
    if (cause.code === 'not_planned') {
      return 'La sessione non è più in programma (fatta, saltata o già cambiata): aggiorna il calendario.'
    }
    if (cause.code === 'already_done') return 'Questa sessione risulta già fatta: aggiorna il calendario.'
    if (cause.code === 'past_date') return 'Non si può spostare una sessione in una data passata.'
    if (cause.code === 'not_deletable') return 'Si possono eliminare solo le sessioni in programma da oggi in poi.'
  }
  return fallback
}
