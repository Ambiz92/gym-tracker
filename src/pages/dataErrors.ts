import { DataError } from '../data/client'

/** Italian message for failures every data call can hit, or null when the error is specific to the action. */
export function describeCommonDataError(cause: unknown): string | null {
  if (cause instanceof DataError && cause.code === 'not_signed_in') return 'Sessione scaduta. Accedi di nuovo.'
  return null
}

/** Italian message for a failed coach/athlete link action; `fallback` covers anything without a specific wording. */
export function describeCoachLinkError(cause: unknown, fallback: string): string {
  const common = describeCommonDataError(cause)
  if (common) return common
  if (cause instanceof DataError) {
    const message = COACH_LINK_MESSAGES[cause.code ?? '']
    if (message) return message
  }
  return fallback
}

const COACH_LINK_MESSAGES: Record<string, string> = {
  invalid_code: 'Il codice non è valido: incollalo per intero, così com’è.',
  unknown_coach: 'Nessun allenatore ha questo codice. Controlla di averlo copiato per intero.',
  already_has_coach: 'Hai già un allenatore o una richiesta in corso: revocala prima di farne un’altra.',
  link_exists: 'Con questo allenatore esiste già un collegamento, anche se revocato. Per riattivarlo serve l’amministratore.',
  self_link: 'Questo è il tuo codice: serve quello del tuo allenatore.',
  invalid_label: 'Il nome non è accettato: usa da 1 a 60 caratteri visibili.',
  not_allowed: 'Operazione non consentita. Per accettare richieste e leggere i dati degli atleti serve il secondo fattore.',
  not_found: 'La richiesta non è più disponibile: è già stata gestita o revocata. Aggiorna la pagina.',
  not_linked: 'Non hai accesso ai dati di questo atleta: il collegamento non è attivo.',
  invalid_athlete: 'Atleta non trovato.',
}
