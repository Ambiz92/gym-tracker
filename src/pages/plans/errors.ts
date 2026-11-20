import { DataError } from '../../data/client'

/** Italian message for a failed plan action; `fallback` covers anything without a specific wording. */
export function describePlanError(cause: unknown, fallback: string): string {
  if (cause instanceof DataError) {
    if (cause.code === 'in_use') return 'La scheda ha allenamenti nello storico: archiviala invece di eliminarla.'
    if (cause.code === 'archived') return 'Una scheda archiviata non si può attivare: ripristinala prima.'
    if (cause.code === 'partial_copy') {
      return "Duplicazione non riuscita e la copia parziale non è stata rimossa: eliminala dall'elenco delle schede."
    }
    if (cause.code === 'partial_create') {
      return "Creazione non riuscita e la scheda vuota non è stata rimossa: eliminala dall'elenco delle schede."
    }
    if (cause.code === 'partial_session') {
      return 'Duplicazione non riuscita e la sessione copiata a metà non è stata rimossa: aprila dalla scheda e rimuovila.'
    }
    if (cause.code === 'not_found') return 'Elemento non trovato: torna indietro e riprova.'
  }
  return fallback
}
