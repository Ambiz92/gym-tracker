/** Shown with the request and stored by the database default (0007): keep the two in step, a test checks it. */
export const CONSENT_VERSION = 'consent-v1'

/**
 * Consent wording approved by the owner. If it changes once real links exist, raise CONSENT_VERSION together
 * with a migration for the database default, so nobody is credited with accepting a different text.
 * It follows S-A1-05: it lists the data, the free-text notes and the past, and how to revoke.
 */
export const CONSENT_TEXT = {
  title: 'Cosa vede il tuo allenatore',
  intro: 'Se invii la richiesta e il tuo allenatore la accetta, potrà solo leggere questi dati, senza poterli modificare:',
  items: [
    'le tue schede, gli esercizi e il calendario delle sessioni;',
    'tutti i tuoi allenamenti e le serie registrate, anche quelli precedenti al collegamento;',
    'le note che scrivi su allenamenti ed esercizi.',
  ],
  health:
    'Questi dati riguardano la tua attività fisica e possono dire qualcosa sulla tua salute: invia la richiesta solo a una persona di cui ti fidi.',
  revoke:
    'Puoi cambiare idea quando vuoi. Con un tocco in Altro revochi l’accesso: da quel momento l’allenatore non legge più nulla e i tuoi dati restano tuoi. Un collegamento revocato non si riattiva: per ricollegarti serve una nuova richiesta.',
  outro: 'Un solo allenatore alla volta. Il consenso vale finché il collegamento è attivo.',
}
