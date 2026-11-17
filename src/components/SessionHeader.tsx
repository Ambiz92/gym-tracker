import { Link } from 'react-router-dom'

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

/** Meta row with a back link and a counter under a thick rule, then the page's h1. */
export function SessionHeader({ backTo, back, backLabel, onBack, end, title, subtitle, size = 'title' }: SessionHeaderProps) {
  return (
    <header className={`page-header page-header--title session-header session-header--${size}`}>
      <div className="page-header__meta">
        <Link to={backTo} className="session-header__back" aria-label={backLabel} onClick={onBack}>
          {back}
        </Link>
        <span>{end}</span>
      </div>
      <h1 className="page-header__title">{title}</h1>
      {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
    </header>
  )
}
