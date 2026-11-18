import type { ReactNode } from 'react'
import { HeadingLevel } from './PageHeading'

interface SplitViewProps {
  list: ReactNode
  detail: ReactNode
  /** Extra modifier class of the grid, e.g. to narrow the list pane. */
  className?: string
}

/** Desktop master-detail: a list pane next to the selected item. The list owns the page's h1, the detail uses h2. */
export function SplitView({ list, detail, className }: SplitViewProps) {
  return (
    <div className={className ? `split ${className}` : 'split'}>
      <div className="split__list">{list}</div>
      <div className="split__detail">
        <HeadingLevel value="h2">{detail}</HeadingLevel>
      </div>
    </div>
  )
}
