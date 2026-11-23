import { athleteName, linkDay, linkStatusLabel } from '../../../lib/coachLink'
import type { CoachLink } from '../../../types/db'
import { LinkActions } from './LinkActions'

interface LinkListProps {
  title: string
  links: readonly CoachLink[]
  onChanged: () => void
}

/** Coach side: one row per athlete (the name they chose, shown as isolated text) with the actions the status allows. */
export function LinkList({ title, links, onChanged }: LinkListProps) {
  if (links.length === 0) return null
  return (
    <div>
      <h3 className="coach-subhead">{title}</h3>
      <ul className="coach-links">
        {links.map((link) => (
          <li key={link.id} className="coach-link">
            <p className="coach-link__title">
              <bdi>{athleteName(link)}</bdi>
            </p>
            <p className="history-note">
              {linkStatusLabel('coach', link.status)} · dal {linkDay(link.accepted_at ?? link.created_at)}
            </p>
            <LinkActions link={link} role="coach" onChanged={onChanged} />
          </li>
        ))}
      </ul>
    </div>
  )
}
