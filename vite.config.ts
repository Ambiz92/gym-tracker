import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { buildCsp } from './scripts/csp.ts'

// Build only: the dev server needs inline scripts for HMR and React refresh.
function cspPlugin(supabaseUrl: string | undefined): Plugin {
  return {
    name: 'gym-tracker-csp',
    apply: 'build',
    transformIndexHtml() {
      if (!supabaseUrl) throw new Error('Missing VITE_SUPABASE_URL: the CSP needs it (see .env.example)')
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: buildCsp(supabaseUrl) },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

export default defineConfig(({ mode }) => ({
  base: '/gym-tracker/',
  plugins: [react(), cspPlugin(loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL)],
  test: {
    exclude: ['**/node_modules/**', '.claude/**'],
    // Placeholders so modules that create the Supabase client load without a .env (CI); no test hits the network.
    env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'sb_publishable_test' },
  },
}))
