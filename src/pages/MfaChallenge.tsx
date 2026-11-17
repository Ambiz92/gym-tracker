import { useAuth } from '../auth/AuthProvider'
import { CodeForm } from '../auth/CodeForm'
import { PageHeader } from '../components/PageHeader'

/** Second step for an account that already has an authenticator: the current 6-digit code. */
export function MfaChallenge() {
  const { verifyCode } = useAuth()

  return (
    <>
      <PageHeader meta="Gym Tracker" metaEnd="Passo 2 / 2" title="Il codice." subtitle="Dall’app Authenticator" />
      <CodeForm onSubmit={verifyCode} />
    </>
  )
}
