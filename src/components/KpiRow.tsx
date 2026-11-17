interface Kpi {
  value: string
  label: string
  /** Colors the value with the accent; the sign or text still carries the meaning. */
  accent?: boolean
}

/** Three-up row of big numbers with a small caption each. */
export function KpiRow({ items }: { items: readonly Kpi[] }) {
  return (
    <ul className="kpi-row">
      {items.map(({ value, label, accent = false }) => (
        <li key={label} className="kpi-row__item">
          <strong className={accent ? 'kpi-row__value kpi-row__value--accent' : 'kpi-row__value'}>{value}</strong>
          <span className="kpi-row__label">{label}</span>
        </li>
      ))}
    </ul>
  )
}
