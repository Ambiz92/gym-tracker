import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/tokens.css'
import './styles/global.css'
import './styles/components.css'
import './styles/desktop.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

// A <meta> CSP cannot express frame-ancestors, so refuse to run inside someone else's frame.
if (window.top !== window.self) {
  root.textContent = 'Questa pagina non può essere aperta in un frame.'
  throw new Error('Framed: refusing to start')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
