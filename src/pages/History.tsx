import { useParams } from 'react-router-dom'
import '../styles/history.css'
import { ExerciseHistoryPage } from './history/ExerciseHistoryPage'
import { HistoryList } from './history/HistoryList'

/** Both `/history` (list) and `/history/:exerciseId` (one exercise) route here. */
export function History() {
  const { exerciseId } = useParams()
  return exerciseId ? <ExerciseHistoryPage exerciseId={exerciseId} /> : <HistoryList />
}
