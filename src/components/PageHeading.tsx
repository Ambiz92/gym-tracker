import { createContext, type ReactNode, useContext } from 'react'

type Level = 'h1' | 'h2'

/** A pane shown next to the page's main one provides 'h2', so the page keeps a single h1. */
export const HeadingLevel = createContext<Level>('h1')

interface PageHeadingProps {
  className: string
  children: ReactNode
}

/** The title of a page or pane: h1, or h2 inside a secondary pane. */
export function PageHeading({ className, children }: PageHeadingProps) {
  const Tag = useContext(HeadingLevel)
  return <Tag className={className}>{children}</Tag>
}
