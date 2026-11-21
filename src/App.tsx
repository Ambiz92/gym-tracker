import { HashRouter, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import type { OAuthReturn } from './auth/oauthReturn'
import { AuthStep, RequireAuth } from './auth/RequireAuth'
import { AuthLayout } from './components/AuthLayout'
import { Layout } from './components/Layout'
import { RouteAnnouncer } from './components/RouteAnnouncer'
import { activeAthletes } from './lib/coachLink'
import { supabase } from './lib/supabase'
import { AthleteView } from './pages/AthleteView'
import { Athletes } from './pages/Athletes'
import { Calendar } from './pages/Calendar'
import { CoachLinksProvider, useCoachLinks } from './pages/coach/CoachLinksProvider'
import { PlansSplit } from './pages/desktop/PlansSplit'
import { Exercises } from './pages/Exercises'
import { History } from './pages/History'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { MfaChallenge } from './pages/MfaChallenge'
import { MfaEnroll } from './pages/MfaEnroll'
import { More } from './pages/More'
import { NotFound } from './pages/NotFound'
import { PlanEdit } from './pages/PlanEdit'
import { PlanSessionEdit } from './pages/PlanSessionEdit'
import { Session } from './pages/Session'

/** The app frame; the Atleti tab shows once the links have loaded and one of them is an active athlete. */
function AppLayout() {
  const links = useCoachLinks()
  const hasAthletes = links.status === 'ready' && activeAthletes(links.data.asCoach).length > 0
  return (
    <Layout hasAthletes={hasAthletes}>
      <Outlet />
    </Layout>
  )
}

export function AppRoutes() {
  return (
    <>
      <RouteAnnouncer />
      <Routes>
        <Route
          element={
            <AuthLayout>
              <Outlet />
            </AuthLayout>
          }
        >
          <Route
            path="/login"
            element={
              <AuthStep path="/login">
                <Login />
              </AuthStep>
            }
          />
          <Route
            path="/login/code"
            element={
              <AuthStep path="/login/code">
                <MfaChallenge />
              </AuthStep>
            }
          />
        </Route>
        <Route element={<RequireAuth />}>
          {/* Voluntary: nothing links here, since a session without a factor is already signed in. */}
          <Route
            element={
              <AuthLayout>
                <Outlet />
              </AuthLayout>
            }
          >
            <Route path="/login/enroll" element={<MfaEnroll />} />
          </Route>
          <Route
            element={
              <CoachLinksProvider>
                <AppLayout />
              </CoachLinksProvider>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/session/:id" element={<Session />} />
            <Route path="/plans" element={<PlansSplit />}>
              <Route path=":id" element={<PlanEdit />}>
                <Route path="sessions/:sessionId" element={<PlanSessionEdit />} />
              </Route>
            </Route>
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:exerciseId" element={<History />} />
            <Route path="/athletes" element={<Athletes />} />
            <Route path="/athletes/:athleteId" element={<AthleteView />} />
            <Route path="/more" element={<More />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}

// HashRouter: GitHub Pages has no SPA fallback for deep links.
export function App({ oauthReturn }: { oauthReturn: OAuthReturn | null }) {
  return (
    <AuthProvider api={supabase.auth} oauthReturn={oauthReturn}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}
