import { LogoutButton } from '../auth/LogoutButton'
import { PageHeader } from '../components/PageHeader'
import '../styles/history.css'
import { ExportActions } from './more/ExportActions'
import { ThemeSetting } from './more/ThemeSetting'
import { applyStoredTheme } from './more/theme'

// Runs when the app bundle loads (App imports this page), so the saved theme applies on every screen.
applyStoredTheme()

export function More() {
  return (
    <>
      <PageHeader meta="Altro" title="Altro" />
      <div className="more-sections">
        <section>
          <h2 className="history-label">Dati</h2>
          <ExportActions />
        </section>
        <section>
          <h2 className="history-label">Aspetto</h2>
          <ThemeSetting />
        </section>
        <section>
          <h2 className="history-label">Account</h2>
          <LogoutButton />
        </section>
      </div>
    </>
  )
}
