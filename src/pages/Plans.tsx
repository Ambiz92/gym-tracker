import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { createPlan, listPlanSummaries } from '../data/plans'
import { useAction } from '../hooks/useAction'
import { useAsync } from '../hooks/useAsync'
import { LoadState } from './history/LoadState'
import { NameForm } from './plans/NameForm'
import { describePlanError } from './plans/errors'
import { PlanList } from './plans/PlanList'
import '../styles/plans.css'

/** Plan list: create a plan, open one to edit it, reach the exercise library. */
export function Plans() {
  const plans = useAsync(listPlanSummaries, [])
  const navigate = useNavigate()
  const create = useAction(describePlanError)
  const [creating, setCreating] = useState(false)

  async function handleCreate(name: string) {
    await create.run(async () => {
      const plan = await createPlan(name)
      navigate(`/plans/${plan.id}`)
    }, 'Creazione non riuscita. Controlla la connessione e riprova.')
  }

  return (
    <>
      <div className="plans-bar">
        <Link to="/exercises" className="plans-bar__action">
          Libreria esercizi
        </Link>
        {!creating && (
          <button type="button" className="plans-bar__action plans-bar__action--accent" onClick={() => setCreating(true)}>
            + Nuova
          </button>
        )}
      </div>
      <PageHeader meta="Schede" title={<>Le tue <em>schede</em></>} size="title" />
      {creating && (
        <NameForm
          noun="scheda"
          submitLabel="Crea scheda"
          busy={create.busy}
          error={create.error}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}
      <LoadState state={plans} what="le schede">
        {(data) => <PlanList initial={data} />}
      </LoadState>
    </>
  )
}
