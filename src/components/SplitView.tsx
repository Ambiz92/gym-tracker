import type { ReactNode } from 'react'

interface SplitViewProps {
  list: ReactNode
  detail: ReactNode
}

/** Desktop master-detail: a list pane next to the selected item. */
export function SplitView({ list, detail }: SplitViewProps) {
  return (
    <div className="split">
      <div className="split__list">{list}</div>
      <div className="split__detail">{detail}</div>
    </div>
  )
}
