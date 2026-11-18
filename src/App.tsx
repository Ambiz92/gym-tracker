import { HashRouter, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { AuthStep, RequireAuth } from './auth/RequireAuth'
import { AuthLayout } from './components/AuthLayout'
import { Layout } from './components/Layout'
import { RouteAnnouncer } from './components/RouteAnnouncer'
import { supabase } from './lib/supabase'
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
          <Route
            path="/login/enroll"
            element={
              <AuthStep path="/login/enroll">
                <MfaEnroll />
              </AuthStep>
            }
          />
        </Route>
        <Route element={<RequireAuth />}>
          <Route
            element={
              <Layout>
                <Outlet />
              </Layout>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/session/:id" element={<Session />} />
            <Route path="/plans" element={<PlansSplit />}>
              <Route path=":id" element={<PlanEdit />}>
                <Route path="sessions/:sessionId" element={<PlanSessionEdit />} />
              </Route>
            </Route>
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:exerciseId" element={<History />} />
            <Route path="/more" element={<More />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}

// HashRouter: GitHub Pages has no SPA fallback for deep links.
export function App() {
  return (
    <AuthProvider api={supabase.auth}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}
