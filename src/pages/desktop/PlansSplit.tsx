import { Outlet, useMatch, useParams } from 'react-router-dom'
import { SplitView } from '../../components/SplitView'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { Plans } from '../Plans'

/**
 * Layout route of /plans: the plan list, with the plan or session editor (the child route) beside
 * it on desktop. On the phone each screen keeps its own page.
 */
export function PlansSplit() {
  const isDesktop = useIsDesktop()
  const { id } = useParams()
  const atList = useMatch({ path: '/plans', end: true }) !== null

  if (!isDesktop) return atList ? <Plans /> : <Outlet />
  return (
    <SplitView
      // The list reloads when another plan opens, so names and counts edited in the previous one are fresh.
      list={<Plans key={id ?? 'none'} />}
      detail={atList ? <p className="split__hint">Scegli una scheda da modificare, o creane una nuova.</p> : <Outlet />}
    />
  )
}
