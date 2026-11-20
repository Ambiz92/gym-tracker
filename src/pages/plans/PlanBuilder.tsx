import { useState, type Dispatch, type SetStateAction } from 'react'
import { PrimaryButton } from '../../components/PrimaryButton'
import { SessionHeader } from '../../components/SessionHeader'
import { UndoToast } from '../../components/UndoToast'
import type { EditablePlan, SessionDetail } from '../../data/activePlan'
import { getActivePlanHead, type SessionRemoval } from '../../data/plans'
import { useAsync } from '../../hooks/useAsync'
import { useUndoToast } from '../../hooks/useUndoToast'
import { activationStep, nextSessionName, pickSession } from '../../lib/planBuilder'
import { countLabel, planCounts } from '../../lib/planList'
import { ArchivedSessions } from './ArchivedSessions'
import { NameForm } from './NameForm'
import { PlanFooter } from './PlanFooter'
import { PlanManage } from './PlanManage'
import { SessionChips } from './SessionChips'
import { SessionPane } from './SessionPane'
import { usePlanActions } from './usePlanActions'
import '../../styles/plans.css'
import '../../styles/builder.css'

interface PlanBuilderProps {
  plan: EditablePlan
  /** Patches the plan held by the parent; called only once a request succeeded. */
  onChange: Dispatch<SetStateAction<EditablePlan>>
  /** The session to open first (a deep link); the first one otherwise. */
  initialSessionId?: string
}

/** A plan on one phone screen: its sessions as keys, the exercises of the open one edited in place, and the bar that activates the plan. */
export function PlanBuilder({ plan, onChange: setPlan, initialSessionId }: PlanBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSessionId ?? null)
  const [renaming, setRenaming] = useState(false)
  const [replacing, setReplacing] = useState<string | null>(null)
  const actions = usePlanActions(plan, setPlan)
  const undo = useUndoToast()
  const { toast } = undo
  const active = useAsync(getActivePlanHead, [plan.is_active])
  const session = pickSession(plan.sessions, selectedId)
  const { edit, danger, sessions, busy } = actions
  const { sessionCount, exerciseCount } = planCounts(plan)
  const otherActive = active.status === 'ready' && active.data !== null && active.data.id !== plan.id ? active.data.name : null

  // An Undo belongs to the session it was shown in: it goes away when another one opens.
  function openSession(id: string) {
    undo.dismiss()
    setSelectedId(id)
  }

  async function handleAddSession() {
    const added = await actions.addNewSession(nextSessionName(plan.sessions.map((candidate) => candidate.name)))
    if (added) openSession(added.id)
  }

  function patchSession(id: string, update: (session: SessionDetail) => SessionDetail) {
    setPlan((current) => ({ ...current, sessions: current.sessions.map((candidate) => (candidate.id === id ? update(candidate) : candidate)) }))
  }

  function handleDuplicated(copy: SessionDetail) {
    setPlan((current) => ({ ...current, sessions: [...current.sessions, copy] }))
    openSession(copy.id)
  }

  function handleSessionRemoved(removed: SessionDetail, removal: SessionRemoval) {
    setPlan((current) => ({
      ...current,
      sessions: current.sessions.filter((candidate) => candidate.id !== removed.id),
      archivedSessions: removal === 'archived' ? [...current.archivedSessions, { ...removed, archived: true }] : current.archivedSessions,
    }))
    setSelectedId(null)
  }

  async function handleRename(name: string) {
    if (await actions.rename(name)) setRenaming(false)
  }

  async function handleToggle() {
    const step = activationStep(plan, otherActive !== null)
    if (step === 'deactivate') await actions.deactivate()
    else if (step === 'confirm-replace') setReplacing(otherActive)
    else await actions.activate()
  }

  async function handleConfirmReplace() {
    if (await actions.activate()) setReplacing(null)
  }

  return (
    <>
      <SessionHeader
        backTo="/plans"
        back="‹ Schede"
        backLabel="Torna alle schede"
        end={countLabel(sessionCount, 'sessione', 'sessioni')}
        title={plan.name}
      />
      <SessionChips
        sessions={plan.sessions}
        selectedId={session?.id ?? null}
        busy={busy}
        onSelect={openSession}
        onAdd={() => void handleAddSession()}
      />
      {sessions.error && (
        <p role="alert" className="plans-error">
          {sessions.error}
        </p>
      )}
      {session ? (
        <SessionPane
          key={session.id}
          session={session}
          sessionNames={plan.sessions.map((candidate) => candidate.name)}
          position={{ index: plan.sessions.indexOf(session), count: plan.sessions.length }}
          planBusy={busy}
          onChange={(update) => patchSession(session.id, update)}
          onRemoved={(removal) => handleSessionRemoved(session, removal)}
          onDuplicated={handleDuplicated}
          onMoveSession={(offset) => void actions.moveSession(plan.sessions.indexOf(session), offset)}
          onUndoable={undo.show}
        />
      ) : (
        <p className="plans-note empty-state">Questa scheda non ha ancora sessioni. Tocca + per aggiungere la prima.</p>
      )}

      <details className="builder-details">
        <summary>Gestisci la scheda</summary>
        {renaming ? (
          <NameForm
            noun="scheda"
            initial={plan.name}
            submitLabel="Salva nome"
            busy={edit.busy}
            error={edit.error}
            onSubmit={handleRename}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <div className="plans-actions">
            <PrimaryButton variant="outline" disabled={busy} onClick={() => setRenaming(true)}>
              Rinomina
            </PrimaryButton>
            <PrimaryButton variant="outline" disabled={busy} onClick={() => void actions.duplicate()}>
              Duplica scheda
            </PrimaryButton>
          </div>
        )}
        <ArchivedSessions sessions={plan.archivedSessions} busy={busy} onRestore={actions.restoreArchivedSession} />
        <PlanManage name={plan.name} archived={plan.archived} busy={busy} error={danger.error} onArchive={actions.archive} onDelete={actions.remove} />
      </details>

      <PlanFooter
        plan={plan}
        sessionCount={sessionCount}
        exerciseCount={exerciseCount}
        replacing={replacing}
        busy={edit.busy || (!plan.is_active && active.status === 'loading')}
        error={renaming ? null : edit.error}
        toast={toast && <UndoToast message={toast.message} onUndo={() => { undo.dismiss(); toast.onUndo() }} />}
        onToggle={() => void handleToggle()}
        onConfirmReplace={() => void handleConfirmReplace()}
        onCancelReplace={() => setReplacing(null)}
      />
    </>
  )
}
