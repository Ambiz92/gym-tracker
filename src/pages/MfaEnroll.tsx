import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { CodeForm } from '../auth/CodeForm'
import type { Enrollment } from '../auth/flow'
import { FormActions, FormError } from '../auth/FormParts'
import { useFormAction } from '../auth/useFormAction'
import { PageHeader } from '../components/PageHeader'
import { PrimaryButton } from '../components/PrimaryButton'

/**
 * Optional setup of an authenticator app; once verified, every later login asks for its code.
 * A user who already has a verified factor may open it too: only unverified factors are dropped,
 * and Supabase asks for aal2 before adding another.
 */
export function MfaEnroll() {
  const { startEnrollment, verifyEnrollment } = useAuth()
  const navigate = useNavigate()
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

  // The status stays signed_in after the first code, so nothing redirects away on its own.
  async function confirm(factorId: string, code: string) {
    const failure = await verifyEnrollment(factorId, code)
    if (!failure) goHome()
    return failure
  }

  function goHome() {
    navigate('/', { replace: true })
  }

  return (
    <>
      <PageHeader
        meta="Gym Tracker"
        metaEnd="Sicurezza"
        title="Collega l’app."
        subtitle="Facoltativo: un codice in più a ogni accesso"
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
          <CodeForm onSubmit={(code) => confirm(enrollment.factorId, code)} onBack={goHome} />
        </>
      ) : (
        <>
          <FormError message={error} />
          <FormActions>
            <PrimaryButton busy={busy} onClick={start}>
              Mostra il codice QR
            </PrimaryButton>
            <PrimaryButton variant="outline" disabled={busy} onClick={goHome}>
              Indietro
            </PrimaryButton>
          </FormActions>
        </>
      )}
    </>
  )
}
