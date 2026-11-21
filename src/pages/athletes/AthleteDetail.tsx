import { type AthleteData, loadAthleteData } from '../../data/athletes'
import { useAsync } from '../../hooks/useAsync'
import { localDateString } from '../../lib/localDate'
import { describeCoachLinkError } from '../dataErrors'
import { LoadState } from '../history/LoadState'
import { AthleteExercises } from './AthleteExercises'
import { AthletePlans } from './AthletePlans'
import { AthleteSessions } from './AthleteSessions'
import { buildAthleteExercises, buildAthleteSessions, buildPlanViews } from './model'

const RECENT_WORKOUTS = 10

/** What the coach sees once the data is in: sessions with notes, exercises, plans. */
export function AthleteContent({ data }: { data: AthleteData }) {
  const today = localDateString(new Date())
  return (
    <>
      <AthleteSessions sessions={buildAthleteSessions(data.workouts, data.exercises, today)} />
      <AthleteExercises exercises={buildAthleteExercises(data.exercises, data.sets)} />
      <AthletePlans plans={buildPlanViews(data.plans, data.exercises)} />
    </>
  )
}

/** Loads and shows what the coach may read of one athlete. Read-only: there is no control here that writes. */
export function AthleteDetail({ athleteId }: { athleteId: string }) {
  const state = useAsync(() => loadAthleteData(athleteId, RECENT_WORKOUTS), [athleteId])
  return (
    <LoadState state={state} what="i dati dell’atleta" describe={(error) => describeCoachLinkError(error, error.message)}>
      {(data) => <AthleteContent data={data} />}
    </LoadState>
  )
}
