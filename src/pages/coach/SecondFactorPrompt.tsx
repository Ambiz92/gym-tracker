import { Link } from 'react-router-dom'

/** Shown to a coach below aal2: the database refuses the accept and every read of an athlete's data until the code is verified. */
export function SecondFactorPrompt() {
  return (
    <div role="status" className="coach-prompt">
      <p>Per accettare richieste e vedere i dati dei tuoi atleti serve il secondo fattore.</p>
      <Link to="/login/enroll" className="coach-prompt__link">
        Attiva il secondo fattore
      </Link>
    </div>
  )
}
