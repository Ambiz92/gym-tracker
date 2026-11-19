import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeading } from './PageHeading'

interface SessionHeaderProps {
  backTo: string
  /** Visible text of the back link, e.g. "‹ Forza base". */
  back: string
  /** What the back link does for assistive tech. */
  backLabel: string
  onBack?: () => void
  end: string
  title: string
  subtitle?: string
  size?: 'title' | 'exercise'
  /** Shown at the end of the title row, e.g. the set pills. */
  aside?: ReactNode
}

/** Meta row with a back link and a counter, then the page's title (h1, or h2 in a secondary pane). */
export function SessionHeader({ backTo, back, backLabel, onBack, end, title, subtitle, size = 'title', aside }: SessionHeaderProps) {
  return (
    <header className={`session-header session-header--${size}`}>
      <div className="session-header__meta">
        <Link to={backTo} className="session-header__back" aria-label={backLabel} onClick={onBack}>
          {back}
        </Link>
        <span>{end}</span>
      </div>
      <div className="session-header__row">
        <PageHeading className="session-header__title">{title}</PageHeading>
        {aside}
      </div>
      {subtitle && <p className="session-header__subtitle">{subtitle}</p>}
    </header>
  )
}
