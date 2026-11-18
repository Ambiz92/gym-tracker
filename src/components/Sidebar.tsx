import { useAuth } from '../auth/AuthProvider'
import { FormError } from '../auth/FormParts'
import { useFormAction } from '../auth/useFormAction'
import { TabBar } from './TabBar'

/** Desktop navigation: brand above the main links, the account below. Below the desktop breakpoint only the tab bar shows. */
export function Sidebar() {
  return (
    <div className="sidebar">
      <p className="sidebar__brand">Gym Tracker</p>
      <TabBar />
      <SidebarAccount />
    </div>
  )
}

function SidebarAccount() {
  const { email, signOut } = useAuth()
  const { busy, error, run } = useFormAction()

  return (
    <div className="sidebar__account">
      {email && <strong className="sidebar__email">{email}</strong>}
      <button type="button" className="sidebar__logout" disabled={busy} onClick={() => void run(signOut)}>
        Esci
      </button>
      <FormError message={error} />
    </div>
  )
}
