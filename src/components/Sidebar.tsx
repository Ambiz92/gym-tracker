import { TabBar } from './TabBar'

/** Desktop navigation: brand above the main links. Below the desktop breakpoint only the tab bar shows. */
export function Sidebar() {
  return (
    <div className="sidebar">
      <p className="sidebar__brand">Gym Tracker</p>
      <TabBar />
    </div>
  )
}
