import { useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import type { EditablePlan } from '../../data/activePlan'
import { PlanScreen } from './PlanScreen'
import type { PlanOutletContext } from './planContext'

/**
 * Holds the plan being edited, so the plan screen and the session screen (the child route) read and
 * patch the same copy after each saved edit. On the phone each is its own page.
 */
export function PlanWorkspace({ initial }: { initial: EditablePlan }) {
  const { sessionId } = useParams()
  const [plan, setPlan] = useState(initial)

  if (sessionId) return <Outlet context={{ plan, setPlan } satisfies PlanOutletContext} />
  return <PlanScreen plan={plan} onChange={setPlan} />
}
