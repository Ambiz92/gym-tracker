interface ExerciseHistoryRow {
  key: string
  date: string
  /** One entry per run of identical sets, already formatted (e.g. "3×8 · 30 kg"). */
  sets: readonly string[]
}

/** Workouts of one exercise, one row each, with its sets as reps × weight. */
export function ExerciseHistoryTable({ rows }: { rows: readonly ExerciseHistoryRow[] }) {
  return (
    <table className="history-table">
      <caption className="visually-hidden">Allenamenti con questo esercizio, dal più recente</caption>
      <thead>
        <tr>
          <th scope="col">Data</th>
          <th scope="col">Serie</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, date, sets }) => (
          <tr key={key}>
            <th scope="row">{date}</th>
            <td>
              {sets.map((group, index) => (
                <span key={`${index}-${group}`} className="history-table__group">
                  {group}
                </span>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
