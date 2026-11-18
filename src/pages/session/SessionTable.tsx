import { Link } from 'react-router-dom'
import type { SessionDetail } from '../../data/activePlan'
import { dayMonthName } from '../../lib/formatDate'
import { sessionPath } from './paths'

interface SessionTableProps {
  sessions: readonly SessionDetail[]
  lastDates: ReadonlyMap<string, string>
  nextId: string | null
}

/** Desktop Oggi: the sessions of the active plan as a table, the next one highlighted. */
export function SessionTable({ sessions, lastDates, nextId }: SessionTableProps) {
  return (
    <table className="session-table">
      <thead>
        <tr>
          <th scope="col">
            <span className="session-vh">Numero</span>
          </th>
          <th scope="col">Sessione</th>
          <th scope="col">Ultima volta</th>
          <th scope="col">Esercizi</th>
          <th scope="col">
            <span className="session-vh">Apri</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((session, index) => {
          const lastDate = lastDates.get(session.id)
          return (
            <tr key={session.id} className={session.id === nextId ? 'session-table__row session-table__row--next' : 'session-table__row'}>
              <td className="session-table__index" aria-hidden="true">
                {index + 1}
              </td>
              <td>
                <Link to={sessionPath(session.id)} className="session-table__name">
                  {session.name}
                </Link>
                {session.id === nextId && <span className="session-table__tag">prossima</span>}
                {session.is_optional && <span className="session-table__bonus">bonus</span>}
              </td>
              <td>{lastDate ? dayMonthName(lastDate) : 'mai fatta'}</td>
              <td>{session.exercises.length}</td>
              <td className="session-table__go" aria-hidden="true">
                Vedi →
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
