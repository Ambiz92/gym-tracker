import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Field } from '../../components/Field'
import { PageHeader } from '../../components/PageHeader'
import { RowLink } from '../../components/RowLink'
import { listHistoryExercises, listLoggedSets, listRecentWorkouts } from '../../data/history'
import { useAsync } from '../../hooks/useAsync'
import { localDateString } from '../../lib/localDate'
import { formatVariation } from './format'
import { LoadState } from './LoadState'
import {
  buildExerciseSummaries,
  buildSessionSummaries,
  filterSummaries,
  summaryDetail,
  type ExerciseSummary,
  type SessionSummary,
} from './model'

const RECENT_SESSIONS = 10

interface HistoryListData {
  sessions: SessionSummary[]
  exercises: ExerciseSummary[]
}

async function loadHistoryList(): Promise<HistoryListData> {
  const [exercises, sets, workouts] = await Promise.all([
    listHistoryExercises(),
    listLoggedSets(),
    listRecentWorkouts(RECENT_SESSIONS),
  ])
  const names = new Map(exercises.map((exercise) => [exercise.id, exercise.name]))
  return {
    sessions: buildSessionSummaries(workouts, names, localDateString(new Date())),
    exercises: buildExerciseSummaries(exercises, sets),
  }
}

/** Storico tab: recent sessions, then every logged exercise with its last weight and trend. */
export function HistoryList() {
  const state = useAsync(loadHistoryList, [])

  return (
    <>
      <PageHeader meta="Storico" title="Storico" />
      <LoadState state={state} what="lo storico">
        {(data) => (data.sessions.length === 0 && data.exercises.length === 0 ? <EmptyHistory /> : <Loaded {...data} />)}
      </LoadState>
    </>
  )
}

function EmptyHistory() {
  return (
    <section className="history-empty">
      <h2 className="history-empty__title">Ancora nessun allenamento.</h2>
      <p className="history-empty__text">Dopo la prima sessione trovi pesi e grafici.</p>
      <RowLink to="/" title="Vai a Oggi" />
    </section>
  )
}

function Loaded({ sessions, exercises }: HistoryListData) {
  return (
    <>
      <SessionList sessions={sessions} />
      <ExerciseList exercises={exercises} />
    </>
  )
}

function SessionList({ sessions }: { sessions: readonly SessionSummary[] }) {
  if (sessions.length === 0) return null
  return (
    <section>
      <h2 className="history-label">Ultime sessioni</h2>
      {sessions.map((session) => (
        <details key={session.id} className="session-log">
          <summary className="session-log__summary">
            <span>
              <span className="row-link__title">{session.title}</span>
              <span className="row-link__detail">{session.detail}</span>
            </span>
            <span className="session-log__arrow" aria-hidden="true">
              ↓
            </span>
          </summary>
          <ul className="session-log__exercises">
            {session.exercises.map((exercise) => (
              <li key={exercise.exerciseId}>
                <Link to={`/history/${exercise.exerciseId}`} className="session-log__exercise">
                  <span>{exercise.name}</span>
                  <span className="row-link__detail">{exercise.sets.join(', ')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  )
}

function ExerciseList({ exercises }: { exercises: readonly ExerciseSummary[] }) {
  const [query, setQuery] = useState('')
  const shown = filterSummaries(exercises, query)

  return (
    <section>
      <h2 className="history-label">Esercizi</h2>
      <Field label="Cerca un esercizio" value={query} onChange={setQuery} autoComplete="off" />
      {shown.length === 0 && (
        <div role="status" className="history-status">
          <p>Nessun esercizio corrisponde a «{query.trim()}».</p>
          <button type="button" className="history-status__action" onClick={() => setQuery('')}>
            Cancella la ricerca
          </button>
        </div>
      )}
      {shown.map((summary) => (
        <RowLink
          key={summary.id}
          to={`/history/${summary.id}`}
          title={summary.name}
          detail={summaryDetail(summary)}
          tag={summary.variationPct === null ? undefined : formatVariation(summary.variationPct)}
        />
      ))}
    </section>
  )
}
