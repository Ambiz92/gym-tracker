import type { Dispatch, SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EditablePlan, PlanDetail, SessionDetail } from '../../data/activePlan'
import {
  addSession,
  archivePlan,
  deactivatePlan,
  deletePlan,
  duplicatePlan,
  renamePlan,
  reorderSessions,
  restorePlan,
  restoreSession,
  setActivePlan,
} from '../../data/plans'
import { useAction } from '../../hooks/useAction'
import { moveItem, moveTo } from '../../lib/reorder'
import { describePlanError } from './errors'

/** What the plan-level screens do to a plan; each patches the parent's copy only once its request succeeded. */
export function usePlanActions(plan: EditablePlan, setPlan: Dispatch<SetStateAction<EditablePlan>>) {
  const navigate = useNavigate()
  const edit = useAction(describePlanError)
  const danger = useAction(describePlanError)
  const sessions = useAction(describePlanError)
  const busy = edit.busy || danger.busy || sessions.busy

  async function rename(name: string): Promise<boolean> {
    const done = await edit.run(() => renamePlan(plan.id, name), 'Rinomina non riuscita. Riprova.')
    if (done) setPlan((current) => ({ ...current, name }))
    return done
  }

  async function activate(): Promise<boolean> {
    const failure =
      'Attivazione non riuscita. Controlla la connessione: se in Schede nessuna risulta attiva, riprova ad attivarne una.'
    const done = await edit.run(() => setActivePlan(plan.id), failure)
    if (done) setPlan((current) => ({ ...current, is_active: true }))
    return done
  }

  async function deactivate(): Promise<boolean> {
    const done = await edit.run(() => deactivatePlan(plan.id), 'Disattivazione non riuscita. Controlla la connessione e riprova.')
    if (done) setPlan((current) => ({ ...current, is_active: false }))
    return done
  }

  async function archive(archived: boolean) {
    const done = await danger.run(
      () => (archived ? archivePlan(plan.id) : restorePlan(plan.id)),
      archived ? 'Archiviazione non riuscita. Riprova.' : 'Ripristino non riuscito. Riprova.',
    )
    if (done) setPlan((current) => ({ ...current, archived, is_active: false }))
  }

  async function remove() {
    if (await danger.run(() => deletePlan(plan.id), 'Eliminazione non riuscita. Riprova.')) navigate('/plans')
  }

  async function duplicate() {
    await edit.run(async () => {
      const copy = await duplicatePlan(plan.id)
      navigate(`/plans/${copy.id}`)
    }, 'Duplicazione non riuscita. Controlla la connessione e riprova.')
  }

  /** Adds a session at the end; resolves it, or null when the request failed. */
  async function addNewSession(name: string): Promise<SessionDetail | null> {
    const created: SessionDetail[] = []
    await sessions.run(async () => {
      created.push({ ...(await addSession(plan.id, { name })), exercises: [], warmup: [] })
    }, 'Aggiunta non riuscita. Controlla la connessione e riprova.')
    const [added] = created
    if (!added) return null
    setPlan((current) => ({ ...current, sessions: [...current.sessions, added] }))
    return added
  }

  async function applyOrder(reordered: PlanDetail['sessions']) {
    // The archived sessions go last in the payload: they keep their rows in the unique position index.
    const done = await sessions.run(
      () => reorderSessions([...reordered, ...plan.archivedSessions]),
      'Riordino non riuscito. Riprova.',
    )
    if (done) setPlan((current) => ({ ...current, sessions: reordered }))
  }

  async function restoreArchivedSession(id: string) {
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

  return {
    edit,
    danger,
    sessions,
    busy,
    rename,
    activate,
    deactivate,
    archive,
    remove,
    duplicate,
    addNewSession,
    moveSession: (index: number, offset: -1 | 1) => applyOrder(moveItem(plan.sessions, index, offset)),
    reorderSession: (from: number, to: number) => applyOrder(moveTo(plan.sessions, from, to)),
    restoreArchivedSession,
  }
}
