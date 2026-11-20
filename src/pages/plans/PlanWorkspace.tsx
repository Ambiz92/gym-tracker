import { useEffect, useRef, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import type { EditablePlan } from '../../data/activePlan'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { planListSignature } from '../../lib/planList'
import { PlanBuilder } from './PlanBuilder'
import { PlanScreen } from './PlanScreen'
import type { PlanOutletContext } from './planContext'

interface PlanWorkspaceProps {
  initial: EditablePlan
  /** Called when an edit changed what the plan list shows. */
  onListStale?: () => void
}

/**
 * Holds the plan being edited. On the phone the builder shows the whole plan on one screen; on
 * desktop the plan screen and the session screen (the child route) read and patch the same copy
 * after each saved edit, side by side.
 */
export function PlanWorkspace({ initial, onListStale }: PlanWorkspaceProps) {
  const { sessionId } = useParams()
  const isDesktop = useIsDesktop()
  const [plan, setPlan] = useState(initial)
  const signature = planListSignature(plan)
  const listed = useRef(signature)

  useEffect(() => {
    if (listed.current === signature) return
    listed.current = signature
    onListStale?.()
  }, [signature, onListStale])

  if (!isDesktop) return <PlanBuilder plan={plan} onChange={setPlan} initialSessionId={sessionId} />

  const screen = <PlanScreen plan={plan} onChange={setPlan} />
  const sessionEditor = <Outlet context={{ plan, setPlan } satisfies PlanOutletContext} />
  return (
    <div className="plan-panes">
      <div className="plan-panes__sessions">{screen}</div>
      <div className="plan-panes__editor">
        {sessionId ? sessionEditor : <p className="split__hint">Scegli una sessione per modificarne gli esercizi.</p>}
      </div>
    </div>
  )
}
