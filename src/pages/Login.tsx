import { type FormEvent, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { FormActions, FormError } from '../auth/FormParts'
import { PasswordField } from '../auth/PasswordField'
import { useFormAction } from '../auth/useFormAction'
import { Field } from '../components/Field'
import { PageHeader } from '../components/PageHeader'
import { PrimaryButton } from '../components/PrimaryButton'

/** First step: email and password. There is no sign-up: the single account is created by hand. */
export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useFormAction()

  function submit(event: FormEvent) {
    event.preventDefault()
    void run(() => signIn(email, password))
  }

  return (
    <>
      <PageHeader meta="Gym Tracker" metaEnd="Accesso" title="Entra." subtitle="Solo per te." />
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
        </FormActions>
      </form>
    </>
  )
}
