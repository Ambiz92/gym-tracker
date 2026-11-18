import { RowLink } from '../../components/RowLink'
import type { PlanSummary } from '../../data/plans'
import { groupPlans, planDetail } from '../../lib/planList'
import '../../styles/plans.css'

function PlanRows({ plans, tag }: { plans: readonly PlanSummary[]; tag?: string }) {
  return (
    <ul className="plans-list">
      {plans.map((plan) => (
        <li key={plan.id}>
          <RowLink to={`/plans/${plan.id}`} title={plan.name} detail={planDetail(plan)} tag={tag} />
        </li>
      ))}
    </ul>
  )
}

/** The plans of the list screen: the active one, the others, then the archived ones. */
export function PlanGroups({ plans }: { plans: readonly PlanSummary[] }) {
  if (plans.length === 0) return <p className="plans-note">Nessuna scheda. Creane una per iniziare.</p>

  const { active, others, archived } = groupPlans(plans)
  return (
    <>
      <h2 className="plans-label">Scheda attiva</h2>
      {active ? (
        <PlanRows plans={[active]} tag="Attiva" />
      ) : (
        <p className="plans-note" role="status">
          Nessuna scheda attiva: apri una scheda e attivala per vederla in Oggi.
        </p>
      )}
      {others.length > 0 && (
        <>
          <h2 className="plans-label">Altre schede</h2>
          <PlanRows plans={others} />
        </>
      )}
      {archived.length > 0 && (
        <>
          <h2 className="plans-label">Archiviate</h2>
          <PlanRows plans={archived} tag="Archiviata" />
        </>
      )}
    </>
  )
}
