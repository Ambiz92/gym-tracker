import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { CodeForm } from '../auth/CodeForm'
import type { Enrollment } from '../auth/flow'
import { FormActions, FormError } from '../auth/FormParts'
import { useFormAction } from '../auth/useFormAction'
import { PageHeader } from '../components/PageHeader'
import { PrimaryButton } from '../components/PrimaryButton'

/** One-time setup of the authenticator app, shown when the account has no verified TOTP factor. */
export function MfaEnroll() {
  const { startEnrollment, verifyEnrollment, signOut } = useAuth()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const { busy, error, run } = useFormAction()

  // Started on a tap, not on mount: a reload must not leave a new unverified factor behind each time.
  function start() {
    void run(async () => {
      const result = await startEnrollment()
      if (!result.ok) return result.error
      setEnrollment(result.value)
      return null
    })
  }

  return (
    <>
      <PageHeader
        meta="Gym Tracker"
        metaEnd="Passo 2 / 2"
        title="Collega l’app."
        subtitle="Prima volta: serve un’app Authenticator"
      />
      {enrollment ? (
        <>
          <img
            src={enrollment.qrCode}
            alt="Codice QR da inquadrare con l’app Authenticator"
            style={{ display: 'block', width: '14rem', maxWidth: '100%', padding: 'var(--ds-space-3)', background: '#fff' }}
          />
          <p className="field__message">
            Non riesci a inquadrarlo? Inserisci questa chiave a mano: <code style={{ wordBreak: 'break-all' }}>{enrollment.secret}</code>
          </p>
          <CodeForm onSubmit={(code) => verifyEnrollment(enrollment.factorId, code)} />
        </>
      ) : (
        <>
          <FormError message={error} />
          <FormActions>
            <PrimaryButton busy={busy} onClick={start}>
              Mostra il codice QR
            </PrimaryButton>
            <PrimaryButton variant="outline" disabled={busy} onClick={() => void run(signOut)}>
              Indietro
            </PrimaryButton>
          </FormActions>
        </>
      )}
    </>
  )
}
