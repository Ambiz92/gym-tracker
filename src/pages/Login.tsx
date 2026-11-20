import { type FormEvent, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { FormActions, FormError } from '../auth/FormParts'
import { PasswordField } from '../auth/PasswordField'
import { useFormAction } from '../auth/useFormAction'
import { Field } from '../components/Field'
import { PageHeader } from '../components/PageHeader'
import { PrimaryButton } from '../components/PrimaryButton'

/** First step: Google, or email and password for the owner. There is no sign-up: accounts are created by hand. */
export function Login() {
  const { signIn, signInWithGoogle, oauthError, clearOauthError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useFormAction(oauthError?.message)

  // The message is read once (as the initial error above); it must not come back on a later visit.
  useEffect(clearOauthError, [clearOauthError])

  function submit(event: FormEvent) {
    event.preventDefault()
    void run(() => signIn(email, password))
  }

  return (
    <>
      <PageHeader meta="Gym Tracker" metaEnd="Accesso" title="Entra." subtitle="Solo su invito." />
      <form onSubmit={submit}>
        <Field
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="username"
          enterKeyHint="next"
          value={email}
          onChange={setEmail}
          required
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          enterKeyHint="go"
          value={password}
          onChange={setPassword}
          required
        />
        <FormError message={error} />
        <FormActions>
          <PrimaryButton type="submit" busy={busy}>
            Accedi
          </PrimaryButton>
          <PrimaryButton variant="outline" disabled={busy} onClick={() => void run(signInWithGoogle)}>
            Continua con Google
          </PrimaryButton>
        </FormActions>
      </form>
    </>
  )
}
