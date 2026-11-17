import { HashRouter, Outlet, Route, Routes } from 'react-router-dom'
import { AuthLayout } from './components/AuthLayout'
import { Layout } from './components/Layout'
import { RouteAnnouncer } from './components/RouteAnnouncer'
import { Exercises } from './pages/Exercises'
import { History } from './pages/History'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { More } from './pages/More'
import { NotFound } from './pages/NotFound'
import { PlanEdit } from './pages/PlanEdit'
import { Plans } from './pages/Plans'
import { Session } from './pages/Session'

export function AppRoutes() {
  return (
    <>
      <RouteAnnouncer />
      <Routes>
        <Route
          path="/login"
          element={
            <AuthLayout>
              <Login />
            </AuthLayout>
          }
        />
        <Route
          element={
            <Layout>
              <Outlet />
            </Layout>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/session/:id" element={<Session />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/plans/:id" element={<PlanEdit />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:exerciseId" element={<History />} />
          <Route path="/more" element={<More />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}

// HashRouter: GitHub Pages has no SPA fallback for deep links.
export function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
