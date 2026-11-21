import { Link, useLocation } from 'react-router-dom'

interface Tab {
  to: string
  label: string
  /** Routes that keep this tab highlighted besides `to` and its sub-paths. */
  also?: readonly string[]
  /** Shown only to a user with at least one active athlete. */
  coachOnly?: boolean
}

const TABS: readonly Tab[] = [
  { to: '/', label: 'Oggi' },
  { to: '/calendar', label: 'Calendario' },
  // The exercise library is reached from the plan editor.
  { to: '/plans', label: 'Schede', also: ['/exercises'] },
  { to: '/history', label: 'Storico' },
  { to: '/athletes', label: 'Atleti', coachOnly: true },
  { to: '/more', label: 'Altro' },
]

function startsAt(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`)
}

function isCurrent({ to, also = [] }: Tab, pathname: string): boolean {
  if (to === '/') return pathname === '/'
  return [to, ...also].some((base) => startsAt(pathname, base))
}

/** Bottom navigation; the current tab carries aria-current="page". "Atleti" shows only with `hasAthletes`. */
export function TabBar({ hasAthletes = false }: { hasAthletes?: boolean }) {
  const { pathname } = useLocation()
  const tabs = TABS.filter((tab) => !tab.coachOnly || hasAthletes)
  return (
    <nav className="tab-bar" aria-label="Navigazione principale">
      <ul className="tab-bar__list">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <Link
              to={tab.to}
              className="tab-bar__link"
              aria-current={isCurrent(tab, pathname) ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
