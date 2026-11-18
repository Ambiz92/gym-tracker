import { DataError } from '../../data/client'

/** Italian message for a failed plan action; `fallback` covers anything without a specific wording. */
export function describePlanError(cause: unknown, fallback: string): string {
  if (cause instanceof DataError) {
    if (cause.code === 'in_use') return 'La scheda ha allenamenti nello storico: archiviala invece di eliminarla.'
    if (cause.code === 'archived') return 'Una scheda archiviata non si può attivare: ripristinala prima.'
    if (cause.code === 'not_found') return 'Elemento non trovato: torna indietro e riprova.'
  }
  return fallback
}

/** Same for the session and exercise actions: a logged session cannot be removed (it has no archive). */
export function describeSessionError(cause: unknown, fallback: string): string {
  if (cause instanceof DataError && cause.code === 'in_use') {
    return 'La sessione ha allenamenti nello storico: non si può rimuovere.'
  }
  return describePlanError(cause, fallback)
}
