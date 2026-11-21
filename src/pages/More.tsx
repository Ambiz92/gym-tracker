import { useAuth } from '../auth/AuthProvider'
import { LogoutButton } from '../auth/LogoutButton'
import { PageHeader } from '../components/PageHeader'
import { useIsDesktop } from '../hooks/useIsDesktop'
import '../styles/history.css'
import { CoachSection } from './more/coach/CoachSection'
import { ExportActions } from './more/ExportActions'
import { ThemeSetting } from './more/ThemeSetting'
import { applyStoredTheme } from './more/theme'

// Runs when the app bundle loads (App imports this page), so the saved theme applies on every screen.
applyStoredTheme()

export function More() {
  const { email } = useAuth()
  const isDesktop = useIsDesktop()

  return (
    <>
      <PageHeader meta="Altro" metaEnd={isDesktop && email ? email : undefined} title="Altro" />
      <div className="more-sections">
        <section>
          <h2 className="history-label">Dati</h2>
          <ExportActions />
        </section>
        <section>
          <h2 className="history-label">Allenatore</h2>
          <CoachSection />
        </section>
        <section>
          <h2 className="history-label">Aspetto</h2>
          <ThemeSetting />
        </section>
        <section>
          <h2 className="history-label">Account</h2>
          {isDesktop && (
            <p className="more-factor">
              <span className="row-link__title">Secondo fattore</span>
              <span className="row-link__detail">Authenticator attivo</span>
            </p>
          )}
          <LogoutButton />
        </section>
      </div>
    </>
  )
}
