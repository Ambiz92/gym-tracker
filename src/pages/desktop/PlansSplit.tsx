import { useCallback, useMemo, useState } from 'react'
import { Outlet, useMatch, useParams } from 'react-router-dom'
import { SplitView } from '../../components/SplitView'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { Plans } from '../Plans'
import type { PlansOutletContext } from '../plans/planContext'

/**
 * Layout route of /plans: the plan list, with the plan or session editor (the child route) beside
 * it on desktop. On the phone each screen keeps its own page.
 */
export function PlansSplit() {
  const isDesktop = useIsDesktop()
  const { id } = useParams()
  const atList = useMatch({ path: '/plans', end: true }) !== null
  // Each side bumps the other's counter when it changes what the other shows.
  const [listKey, setListKey] = useState(0)
  const [editorKey, setEditorKey] = useState(0)
  const onPlanChanged = useCallback(() => setListKey((key) => key + 1), [])
  const context = useMemo<PlansOutletContext>(() => ({ refreshKey: editorKey, onPlanChanged }), [editorKey, onPlanChanged])

  if (!isDesktop) return atList ? <Plans /> : <Outlet context={context} />
  return (
    <SplitView
      // The list reloads when another plan opens, so names and counts edited in the previous one are fresh.
      list={
        <Plans
          key={id ?? 'none'}
          selectedId={id}
          refreshKey={listKey}
          onActivated={() => setEditorKey((key) => key + 1)}
        />
      }
      detail={
        atList ? <p className="split__hint">Scegli una scheda da modificare, o creane una nuova.</p> : <Outlet context={context} />
      }
    />
  )
}
