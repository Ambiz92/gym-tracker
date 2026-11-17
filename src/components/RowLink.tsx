import { Link } from 'react-router-dom'

interface RowLinkProps {
  to: string
  title: string
  detail?: string
  /** Big leading numeral; omit for a plain row. */
  index?: number
  /** Replaces the trailing arrow with a short red label. */
  tag?: string
  inverted?: boolean
}

/** List row that navigates: optional numeral, title, detail line, trailing arrow or tag. */
export function RowLink({ to, title, detail, index, tag, inverted = false }: RowLinkProps) {
  const classes = ['row-link']
  if (index !== undefined) classes.push('row-link--indexed')
  if (inverted) classes.push('row-link--inverted')

  return (
    <Link to={to} className={classes.join(' ')}>
      {index !== undefined && <span className="row-link__index">{index}</span>}
      <span>
        <span className="row-link__title">{title}</span>
        {detail && <span className="row-link__detail">{detail}</span>}
      </span>
      {tag ? (
        <em className="row-link__tag">{tag}</em>
      ) : (
        <span className="row-link__arrow" aria-hidden="true">
          →
        </span>
      )}
    </Link>
  )
}
