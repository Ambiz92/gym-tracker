import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Oggi', end: true },
  { to: '/plans', label: 'Schede', end: false },
  { to: '/history', label: 'Storico', end: false },
  { to: '/more', label: 'Altro', end: false },
] as const

/** Bottom navigation; NavLink sets aria-current="page" on the active tab. */
export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Navigazione principale">
      <ul className="tab-bar__list">
        {TABS.map(({ to, label, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className="tab-bar__link">
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
