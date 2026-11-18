import { useParams } from 'react-router-dom'
import { SplitView } from '../components/SplitView'
import { useIsDesktop } from '../hooks/useIsDesktop'
import '../styles/history.css'
import { ExerciseHistoryPage } from './history/ExerciseHistoryPage'
import { HistoryList } from './history/HistoryList'

/** Both `/history` (list) and `/history/:exerciseId` (one exercise) route here; side by side on desktop. */
export function History() {
  const { exerciseId } = useParams()
  const isDesktop = useIsDesktop()
  if (!isDesktop) return exerciseId ? <ExerciseHistoryPage exerciseId={exerciseId} /> : <HistoryList />

  return (
    <SplitView
      list={<HistoryList />}
      detail={
        exerciseId ? (
          <ExerciseHistoryPage exerciseId={exerciseId} />
        ) : (
          <p className="split__hint">Scegli un esercizio per vedere pesi e grafico.</p>
        )
      }
    />
  )
}
