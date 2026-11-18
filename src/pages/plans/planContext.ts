import type { Dispatch, SetStateAction } from 'react'
import type { EditablePlan } from '../../data/activePlan'

/** What PlanEdit hands to the session route: the plan it holds and the way to patch it after a saved edit. */
export interface PlanOutletContext {
  plan: EditablePlan
  setPlan: Dispatch<SetStateAction<EditablePlan>>
}
