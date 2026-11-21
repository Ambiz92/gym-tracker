/** Shown with the request and stored by the database default (0007): keep the two in step, a test checks it. */
export const CONSENT_VERSION = 'consent-v1'

/**
 * PLACEHOLDER: the wording has not been reviewed or approved. It must be replaced (and CONSENT_VERSION raised,
 * together with the database default) before any real athlete uses it. It follows S-A1-05: it lists the
 * data, the free-text notes and the past.
 */
export const CONSENT_TEXT_PLACEHOLDER = {
  notice: 'Testo provvisorio: da rivedere e approvare prima dell’uso reale.',
  intro: 'Se invii la richiesta e il tuo allenatore la accetta, potrà leggere, senza modificare nulla:',
  items: [
    'le tue schede, gli esercizi e il calendario;',
    'tutti gli allenamenti e le serie registrate, anche quelli di prima del collegamento;',
    'le note che hai scritto su allenamenti ed esercizi.',
  ],
  outro: 'Puoi revocare l’accesso quando vuoi, con un tocco: da quel momento non legge più nulla. Un collegamento revocato non si riattiva da solo.',
}
