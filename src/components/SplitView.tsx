import type { ReactNode } from 'react'
import { HeadingLevel } from './PageHeading'

interface SplitViewProps {
  list: ReactNode
  detail: ReactNode
}

/** Desktop master-detail: a list pane next to the selected item. The list owns the page's h1, the detail uses h2. */
export function SplitView({ list, detail }: SplitViewProps) {
  return (
    <div className="split">
      <div className="split__list">{list}</div>
      <div className="split__detail">
        <HeadingLevel value="h2">{detail}</HeadingLevel>
      </div>
    </div>
  )
}
