import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/global.css'
import './styles/components.css'
import { App } from './App'
import { takeOAuthReturn } from './auth/oauthReturn'
// After App, whose screens import their own sheets: the desktop rules must override them all.
import './styles/desktop.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

// A <meta> CSP cannot express frame-ancestors, so refuse to run inside someone else's frame.
if (window.top !== window.self) {
  root.textContent = 'Questa pagina non può essere aperta in un frame.'
  throw new Error('Framed: refusing to start')
}

// Read before the router starts: a refusal puts its error in the hash, which HashRouter would take for a route.
const oauthReturn = takeOAuthReturn(window)

createRoot(root).render(
  <StrictMode>
    <App oauthReturn={oauthReturn} />
  </StrictMode>,
)
