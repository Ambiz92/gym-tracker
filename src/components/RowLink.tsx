import { Link } from 'react-router-dom'

interface RowLinkProps {
  to: string
  title: string
  detail?: string
  /** Big decorative numeral, hidden from assistive tech (the list conveys the order); omit for a plain row. */
  index?: number
  /** Replaces the trailing arrow with a short red label. */
  tag?: string
  /** The row of the item open next to the list (desktop): highlighted and marked as current. */
  inverted?: boolean
}

/** List row that navigates: optional numeral, title, detail line, trailing arrow or tag. */
export function RowLink({ to, title, detail, index, tag, inverted = false }: RowLinkProps) {
  const classes = ['row-link']
  if (index !== undefined) classes.push('row-link--indexed')
  if (inverted) classes.push('row-link--inverted')

  return (
    <Link to={to} className={classes.join(' ')} aria-current={inverted ? 'true' : undefined}>
      {index !== undefined && <span className="row-link__index" aria-hidden="true">{index}</span>}
      <span>
        <span className="row-link__title">{title}</span>
        {detail && <span className="row-link__detail">{detail}</span>}
      </span>
      {tag ? (
        <span className="row-link__tag">{tag}</span>
      ) : (
        <span className="row-link__arrow" aria-hidden="true">
          →
        </span>
      )}
    </Link>
  )
}
