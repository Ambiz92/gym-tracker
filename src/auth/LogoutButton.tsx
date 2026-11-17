import { PrimaryButton } from '../components/PrimaryButton'
import { useAuth } from './AuthProvider'
import { FormError } from './FormParts'
import { useFormAction } from './useFormAction'

/** Ends this device's session; the route guard then sends the user to the login. */
export function LogoutButton() {
  const { signOut } = useAuth()
  const { busy, error, run } = useFormAction()

  return (
    <>
      <PrimaryButton variant="outline" busy={busy} onClick={() => void run(signOut)}>
        Esci
      </PrimaryButton>
      <FormError message={error} />
    </>
  )
}
