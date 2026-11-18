import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { AuthContext } from '../../auth/AuthProvider'
import { More } from '../More'

function renderMore() {
  const unused = () => Promise.reject(new Error('not used when rendering'))
  return renderToStaticMarkup(
    <AuthContext.Provider
      value={{ status: 'signed_in', email: null, signIn: unused, verifyCode: unused, startEnrollment: unused, verifyEnrollment: unused, signOut: unused }}
    >
      <More />
    </AuthContext.Provider>,
  )
}

test('Altro offers both exports, the theme switch with Auto selected, and keeps the logout button', () => {
  const html = renderMore()
  expect(html).toContain('Esporta CSV')
  expect(html).toContain('Esporta JSON')
  expect(html).toContain('<button type="button" class="segmented__option" aria-pressed="true">Auto</button>')
  expect(html).toContain('aria-pressed="false">Chiaro</button>')
  expect(html).toContain('aria-pressed="false">Scuro</button>')
  expect(html).toContain('Esci')
})

test('Altro starts without a download list or an error', () => {
  const html = renderMore()
  expect(html).not.toContain('Pronto')
  expect(html).not.toContain('role="alert"')
})
