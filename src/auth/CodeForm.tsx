import { type FormEvent, useState } from 'react'
import { Field } from '../components/Field'
import { PrimaryButton } from '../components/PrimaryButton'
import { useAuth } from './AuthProvider'
import type { AuthFailure } from './errors'
import { normalizeCode } from './flow'
import { FormActions, FormError } from './FormParts'
import { useFormAction } from './useFormAction'

interface CodeFormProps {
  onSubmit: (code: string) => Promise<AuthFailure | null>
  /** Leaves the form; by default signs out of the half-open session, back to the login. */
  onBack?: () => void
}

/** Six-digit authenticator code with a way back. */
export function CodeForm({ onSubmit, onBack }: CodeFormProps) {
  const { signOut } = useAuth()
  const [code, setCode] = useState('')
  const { busy, error, run } = useFormAction()

  function submit(event: FormEvent) {
    event.preventDefault()
    void run(() => onSubmit(code))
  }

  return (
    <form onSubmit={submit}>
      <Field
        label="Codice a 6 cifre"
        value={code}
        onChange={(value) => setCode(normalizeCode(value))}
        inputMode="numeric"
        autoComplete="one-time-code"
        enterKeyHint="go"
        placeholder="000000"
        required
      />
      <FormError message={error} />
      <FormActions>
        <PrimaryButton type="submit" busy={busy}>
          Conferma
        </PrimaryButton>
        <PrimaryButton variant="outline" disabled={busy} onClick={onBack ?? (() => void run(signOut))}>
          Indietro
        </PrimaryButton>
      </FormActions>
    </form>
  )
}
