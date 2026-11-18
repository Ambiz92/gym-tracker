import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PrimaryButton } from '../../components/PrimaryButton'
import { SessionHeader } from '../../components/SessionHeader'
import type { EditablePlan } from '../../data/activePlan'
import {
  addSession,
  archivePlan,
  deletePlan,
  duplicatePlan,
  renamePlan,
  reorderSessions,
  restorePlan,
  restoreSession,
  setActivePlan,
} from '../../data/plans'
import { useAction } from '../../hooks/useAction'
import { countLabel } from '../../lib/planList'
import { moveItem } from '../../lib/reorder'
import { ArchivedSessions } from './ArchivedSessions'
import { describePlanError } from './errors'
import { NameForm } from './NameForm'
import { PlanManage } from './PlanManage'
import { SessionRows } from './SessionRows'
import '../../styles/plans.css'

function statusLabel(plan: EditablePlan): string {
  if (plan.archived) return 'Archiviata'
  return plan.is_active ? 'Attiva' : 'Non attiva'
}

type Panel = 'rename' | 'add-session' | null

/** One plan: rename, activate, duplicate, archive or delete it, and add, reorder or restore its sessions. */
export function PlanScreen({ initial }: { initial: EditablePlan }) {
  const navigate = useNavigate()
  // Edits update this copy once the request succeeds, so the list never reloads under the user's finger.
  const [plan, setPlan] = useState(initial)
  const [panel, setPanel] = useState<Panel>(null)
  const edit = useAction(describePlanError)
  const danger = useAction(describePlanError)
  const sessions = useAction(describePlanError)
  const busy = edit.busy || danger.busy || sessions.busy

  async function handleRename(name: string) {
    if (!(await edit.run(() => renamePlan(plan.id, name), 'Rinomina non riuscita. Riprova.'))) return
    setPlan((current) => ({ ...current, name }))
    setPanel(null)
  }

  async function handleActivate() {
    const failure =
      'Attivazione non riuscita. Controlla la connessione: se in Schede nessuna risulta attiva, riprova ad attivarne una.'
    if (await edit.run(() => setActivePlan(plan.id), failure)) setPlan((current) => ({ ...current, is_active: true }))
  }

  async function handleArchive(archived: boolean) {
    const done = await danger.run(
      () => (archived ? archivePlan(plan.id) : restorePlan(plan.id)),
      archived ? 'Archiviazione non riuscita. Riprova.' : 'Ripristino non riuscito. Riprova.',
    )
    if (done) setPlan((current) => ({ ...current, archived, is_active: false }))
  }

  async function handleDelete() {
    if (await danger.run(() => deletePlan(plan.id), 'Eliminazione non riuscita. Riprova.')) navigate('/plans')
  }

  async function handleAddSession(name: string) {
    const added = await sessions.run(async () => {
      const session = await addSession(plan.id, { name })
      setPlan((current) => ({ ...current, sessions: [...current.sessions, { ...session, exercises: [], warmup: [] }] }))
    }, 'Aggiunta non riuscita. Controlla la connessione e riprova.')
    if (added) setPanel(null)
  }

  async function handleMove(index: number, offset: -1 | 1) {
    const reordered = moveItem(plan.sessions, index, offset)
    // The archived sessions go last in the payload: they keep their rows in the unique position index.
    const done = await sessions.run(
      () => reorderSessions([...reordered, ...plan.archivedSessions]),
      'Riordino non riuscito. Riprova.',
    )
    if (done) setPlan((current) => ({ ...current, sessions: reordered }))
  }

  async function handleRestoreSession(id: string) {
    let position = 0
    const done = await sessions.run(async () => {
      position = await restoreSession(plan.id, id)
    }, 'Ripristino non riuscito. Riprova.')
    if (!done) return
    setPlan((current) => {
      const restored = current.archivedSessions.find((session) => session.id === id)
      if (!restored) return current
      return {
        ...current,
        sessions: [...current.sessions, { ...restored, archived: false, position }],
        archivedSessions: current.archivedSessions.filter((session) => session.id !== id),
      }
    })
  }

  async function handleDuplicate() {
    await edit.run(async () => {
      const copy = await duplicatePlan(plan.id)
      navigate(`/plans/${copy.id}`)
    }, 'Duplicazione non riuscita. Controlla la connessione e riprova.')
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
            <PrimaryButton busy={edit.busy} disabled={busy} onClick={handleActivate}>
              Imposta come attiva
            </PrimaryButton>
          )}
          <PrimaryButton variant="outline" disabled={busy} onClick={() => setPanel('rename')}>
            Rinomina
          </PrimaryButton>
          <PrimaryButton variant="outline" disabled={busy} onClick={handleDuplicate}>
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
      <SessionRows planId={plan.id} sessions={plan.sessions} busy={busy} onMove={handleMove} />
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

      <ArchivedSessions sessions={plan.archivedSessions} busy={busy} onRestore={handleRestoreSession} />

      <PlanManage
        name={plan.name}
        archived={plan.archived}
        busy={busy}
        error={danger.error}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />
    </>
  )
}
