import { useState, type Dispatch, type SetStateAction } from 'react'
import { PrimaryButton } from '../../components/PrimaryButton'
import { SessionHeader } from '../../components/SessionHeader'
import type { EditablePlan } from '../../data/activePlan'
import { countLabel } from '../../lib/planList'
import { ArchivedSessions } from './ArchivedSessions'
import { NameForm } from './NameForm'
import { PlanManage } from './PlanManage'
import { SessionRows } from './SessionRows'
import { usePlanActions } from './usePlanActions'
import '../../styles/plans.css'

function statusLabel(plan: EditablePlan): string {
  if (plan.archived) return 'Archiviata'
  return plan.is_active ? 'Attiva' : 'Non attiva'
}

type Panel = 'rename' | 'add-session' | null

interface PlanScreenProps {
  plan: EditablePlan
  /** Patches the plan held by the parent; called only once a request succeeded, so nothing reloads under the user's finger. */
  onChange: Dispatch<SetStateAction<EditablePlan>>
}

/** One plan: rename, activate, duplicate, archive or delete it, and add, reorder or restore its sessions. */
export function PlanScreen({ plan, onChange: setPlan }: PlanScreenProps) {
  const [panel, setPanel] = useState<Panel>(null)
  const actions = usePlanActions(plan, setPlan)
  const { edit, danger, sessions, busy } = actions

  async function handleRename(name: string) {
    if (await actions.rename(name)) setPanel(null)
  }

  async function handleAddSession(name: string) {
    if (await actions.addNewSession(name)) setPanel(null)
  }

  return (
    <>
      <SessionHeader
        backTo="/plans"
        back="‹ Schede"
        backLabel="Torna alle schede"
        end={countLabel(plan.sessions.length, 'sessione', 'sessioni')}
        title={plan.name}
        subtitle={statusLabel(plan)}
      />
      {panel !== 'rename' && edit.error && (
        <p role="alert" className="plans-error">
          {edit.error}
        </p>
      )}
      {panel === 'rename' ? (
        <NameForm
          noun="scheda"
          initial={plan.name}
          submitLabel="Salva nome"
          busy={edit.busy}
          error={edit.error}
          onSubmit={handleRename}
          onCancel={() => setPanel(null)}
        />
      ) : (
        <div className="plans-actions">
          {!plan.archived && !plan.is_active && (
            <PrimaryButton busy={edit.busy} disabled={busy} onClick={() => void actions.activate()}>
              Imposta come attiva
            </PrimaryButton>
          )}
          <PrimaryButton variant="outline" disabled={busy} onClick={() => setPanel('rename')}>
            Rinomina
          </PrimaryButton>
          <PrimaryButton variant="outline" disabled={busy} onClick={() => void actions.duplicate()}>
            Duplica scheda
          </PrimaryButton>
        </div>
      )}

      <h2 className="plans-label">Sessioni</h2>
      {panel !== 'add-session' && sessions.error && (
        <p role="alert" className="plans-error">
          {sessions.error}
        </p>
      )}
      <SessionRows
        planId={plan.id}
        sessions={plan.sessions}
        busy={busy}
        onMove={actions.moveSession}
        onReorder={actions.reorderSession}
      />
      {panel === 'add-session' ? (
        <NameForm
          noun="sessione"
          submitLabel="Aggiungi sessione"
          busy={sessions.busy}
          error={sessions.error}
          onSubmit={handleAddSession}
          onCancel={() => setPanel(null)}
        />
      ) : (
        <div className="plans-actions">
          <PrimaryButton variant="outline" disabled={busy} onClick={() => setPanel('add-session')}>
            Aggiungi sessione
          </PrimaryButton>
        </div>
      )}

      <ArchivedSessions sessions={plan.archivedSessions} busy={busy} onRestore={actions.restoreArchivedSession} />

      <PlanManage
        name={plan.name}
        archived={plan.archived}
        busy={busy}
        error={danger.error}
        onArchive={actions.archive}
        onDelete={actions.remove}
      />
    </>
  )
}
