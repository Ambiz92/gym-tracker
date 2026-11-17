import { Link } from 'react-router-dom'
import { ExerciseHistoryTable } from '../../components/ExerciseHistoryTable'
import { KpiRow } from '../../components/KpiRow'
import { LineChart } from '../../components/LineChart'
import { PageHeader } from '../../components/PageHeader'
import { getHistoryExercise } from '../../data/history'
import { getExerciseHistory } from '../../data/workouts'
import { useAsync } from '../../hooks/useAsync'
import { localDateString } from '../../lib/localDate'
import { formatNumber } from './format'
import { LoadState } from './LoadState'
import { buildExerciseView, type ExerciseView } from './model'

/** Null when the exercise does not exist. */
async function loadExerciseView(exerciseId: string): Promise<ExerciseView | null> {
  const exercise = await getHistoryExercise(exerciseId)
  if (!exercise) return null
  const sets = await getExerciseHistory(exerciseId)
  return buildExerciseView(exercise, sets, localDateString(new Date()))
}

/** Weight history of one exercise: starting weight, last weight, change, weekly chart, workouts. */
export function ExerciseHistoryPage({ exerciseId }: { exerciseId: string }) {
  const state = useAsync(() => loadExerciseView(exerciseId), [exerciseId])

  return (
    <>
      <Link to="/history" className="history-back">
        ‹ Storico
      </Link>
      <LoadState state={state} what="lo storico di questo esercizio">
        {(view) => (view ? <Loaded view={view} /> : <NotFound />)}
      </LoadState>
    </>
  )
}

function NotFound() {
  return (
    <section className="history-empty">
      <h1 className="history-empty__title">Esercizio non trovato.</h1>
      <p className="history-empty__text">Potrebbe essere stato rimosso, oppure il link non è corretto.</p>
    </section>
  )
}

function Loaded({ view }: { view: ExerciseView }) {
  const subtitle = view.archived ? `${view.equipment} · archiviato` : view.equipment

  return (
    <>
      <PageHeader meta="Esercizio" title={view.name} subtitle={subtitle} size="title" />
      {view.workouts.length === 0 ? (
        <section className="history-empty">
          <h2 className="history-empty__title">Nessuna serie registrata.</h2>
          <p className="history-empty__text">Dopo il primo allenamento con questo esercizio trovi qui pesi e grafico.</p>
        </section>
      ) : (
        <>
          <KpiRow items={view.kpis} />
          <section>
            <h2 className="history-label">Peso per settimana</h2>
            <p className="history-note">Il massimo di ogni settimana.</p>
            <LineChart points={view.chartPoints} summary={view.chartSummary} formatTick={formatNumber} />
          </section>
          <section>
            <h2 className="history-label">Allenamenti</h2>
            <ExerciseHistoryTable rows={view.workouts} />
          </section>
        </>
      )}
    </>
  )
}
