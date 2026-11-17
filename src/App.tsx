import { HashRouter, Outlet, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Exercises } from './pages/Exercises'
import { History } from './pages/History'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { More } from './pages/More'
import { PlanEdit } from './pages/PlanEdit'
import { Plans } from './pages/Plans'
import { Session } from './pages/Session'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
      </Route>
    </Routes>
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
