import type { ReactNode } from 'react'
import { PageHeading } from './PageHeading'

interface PageHeaderProps {
  meta: string
  metaEnd?: string
  /** Wrap a part in <em> to color it with the accent. */
  title: ReactNode
  subtitle?: string
  size?: 'display' | 'title'
}

/** Meta row under a thick rule, then the big page title (the page's h1, an h2 in a secondary pane). */
export function PageHeader({ meta, metaEnd, title, subtitle, size = 'display' }: PageHeaderProps) {
  return (
    <header className={`page-header page-header--${size}`}>
      <div className="page-header__meta">
        <span>{meta}</span>
        {metaEnd && <span>{metaEnd}</span>}
      </div>
      <PageHeading className="page-header__title">{title}</PageHeading>
      {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
    </header>
  )
}
