import { PageHeader } from '../components/PageHeader'
import { RowLink } from '../components/RowLink'

export function NotFound() {
  return (
    <>
      <PageHeader meta="Gym Tracker" title="Pagina non trovata" subtitle="Questo indirizzo non esiste" />
      <RowLink to="/" title="Torna a Oggi" />
    </>
  )
}
