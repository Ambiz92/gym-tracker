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
}

/** Meta row with a back link and a counter under a thick rule, then the page's title (h1, or h2 in a secondary pane). */
export function SessionHeader({ backTo, back, backLabel, onBack, end, title, subtitle, size = 'title' }: SessionHeaderProps) {
  return (
    <header className={`page-header page-header--title session-header session-header--${size}`}>
      <div className="page-header__meta">
        <Link to={backTo} className="session-header__back" aria-label={backLabel} onClick={onBack}>
          {back}
        </Link>
        <span>{end}</span>
      </div>
      <PageHeading className="page-header__title">{title}</PageHeading>
      {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
    </header>
  )
}
