import { DataError } from '../data/client'

/** Italian message for failures every data call can hit, or null when the error is specific to the action. */
export function describeCommonDataError(cause: unknown): string | null {
  if (cause instanceof DataError && cause.code === 'not_signed_in') return 'Sessione scaduta. Accedi di nuovo.'
  return null
}
