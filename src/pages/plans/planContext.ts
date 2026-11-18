import type { Dispatch, SetStateAction } from 'react'
import type { EditablePlan } from '../../data/activePlan'

/** What PlanEdit hands to the session route: the plan it holds and the way to patch it after a saved edit. */
export interface PlanOutletContext {
  plan: EditablePlan
  setPlan: Dispatch<SetStateAction<EditablePlan>>
}

/** What PlansSplit hands to the plan route, so the list and the editor beside it stay in step on desktop. */
export interface PlansOutletContext {
  /** Changes when the list changed something the editor shows (the active plan): the editor reloads. */
  refreshKey: number
  /** The editor changed something the list shows (name, status, counts): the list reloads. */
  onPlanChanged: () => void
}
