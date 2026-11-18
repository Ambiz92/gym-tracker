import { useEffect, useRef, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import type { EditablePlan } from '../../data/activePlan'
import { planListSignature } from '../../lib/planList'
import { PlanScreen } from './PlanScreen'
import type { PlanOutletContext } from './planContext'

interface PlanWorkspaceProps {
  initial: EditablePlan
  /** Called when an edit changed what the plan list shows. */
  onListStale?: () => void
}

/**
 * Holds the plan being edited, so the plan screen and the session screen (the child route) read and
 * patch the same copy after each saved edit. On the phone each is its own page.
 */
export function PlanWorkspace({ initial, onListStale }: PlanWorkspaceProps) {
  const { sessionId } = useParams()
  const [plan, setPlan] = useState(initial)
  const signature = planListSignature(plan)
  const listed = useRef(signature)

  useEffect(() => {
    if (listed.current === signature) return
    listed.current = signature
    onListStale?.()
  }, [signature, onListStale])

  if (sessionId) return <Outlet context={{ plan, setPlan } satisfies PlanOutletContext} />
  return <PlanScreen plan={plan} onChange={setPlan} />
}
