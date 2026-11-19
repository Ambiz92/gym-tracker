import { RowLink } from '../../components/RowLink'
import type { PlanSummary } from '../../data/plans'
import { groupPlans, planDetail } from '../../lib/planList'
import '../../styles/plans.css'

interface PlanGroupsProps {
  plans: readonly PlanSummary[]
  /** The plan open next to the list (desktop): its row is highlighted. */
  selectedId?: string
  /** A request is in flight: the radios are blocked. */
  busy: boolean
  /** Failure of the last activation, announced to screen readers. */
  error: string | null
  onActivate: (id: string) => void
}

interface PlanRowsProps {
  plans: readonly PlanSummary[]
  selectedId?: string
  busy: boolean
  onActivate: (id: string) => void
}

/** Rows of live plans: a radio to make one active, then the link to its editor. */
function PlanRows({ plans, selectedId, busy, onActivate }: PlanRowsProps) {
  return (
    <ul className="plans-list">
      {plans.map((plan) => (
        <li key={plan.id} className={plan.id === selectedId ? 'plan-pick plan-pick--selected' : 'plan-pick'}>
          <label className="plan-radio">
            {/* One native radio group across both lists: arrow keys move between plans, a tap activates. */}
            <input
              type="radio"
              name="active-plan"
              aria-label={`Attiva ${plan.name}`}
              checked={plan.is_active}
              disabled={busy}
              onChange={() => onActivate(plan.id)}
            />
          </label>
          <RowLink to={`/plans/${plan.id}`} title={plan.name} detail={planDetail(plan)} inverted={plan.id === selectedId} />
        </li>
      ))}
    </ul>
  )
}

/** The plans of the list screen: the active one, the others, then the archived ones. */
export function PlanGroups({ plans, selectedId, busy, error, onActivate }: PlanGroupsProps) {
  if (plans.length === 0) return <p className="plans-note empty-state">Nessuna scheda. Creane una per iniziare.</p>

  const { active, others, archived } = groupPlans(plans)
  return (
    <>
      {error && (
        <p role="alert" className="plans-error">
          {error}
        </p>
      )}
      <h2 className="plans-label">Scheda attiva</h2>
      {active ? (
        <PlanRows plans={[active]} selectedId={selectedId} busy={busy} onActivate={onActivate} />
      ) : (
        <p className="plans-note" role="status">
          Nessuna scheda attiva: tocca il cerchio di una scheda per vederla in Oggi.
        </p>
      )}
      {others.length > 0 && (
        <>
          <h2 className="plans-label">Altre schede</h2>
          <PlanRows plans={others} selectedId={selectedId} busy={busy} onActivate={onActivate} />
        </>
      )}
      <p className="plans-note">Tocca il cerchio per attivare una scheda. Lo storico non cambia mai.</p>
      {archived.length > 0 && (
        <>
          <h2 className="plans-label">Archiviate</h2>
          <ul className="plans-list">
            {archived.map((plan) => (
              <li key={plan.id}>
                <RowLink
                  to={`/plans/${plan.id}`}
                  title={plan.name}
                  detail={planDetail(plan)}
                  tag="Archiviata"
                  inverted={plan.id === selectedId}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
