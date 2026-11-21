import { DataError } from '../../data/client'
import { describeCommonDataError } from '../dataErrors'

/** Italian message for a failed library action; `fallback` covers anything without a specific wording. */
export function describeError(cause: unknown, fallback: string): string {
  const common = describeCommonDataError(cause)
  if (common) return common
  if (cause instanceof DataError) {
    if (cause.code === 'in_use') {
      return 'L’esercizio è usato in una scheda o ha uno storico: archivialo invece di eliminarlo.'
    }
    if (cause.code === 'not_found') {
      return 'Esercizio non trovato: torna alla libreria e riprova.'
    }
  }
  return fallback
}
