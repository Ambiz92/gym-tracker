import type { ReactNode } from 'react'
import { PrimaryButton } from '../../components/PrimaryButton'
import { Skeleton } from '../../components/Skeleton'
import type { AsyncState } from '../../hooks/useAsync'

interface LoadStateProps<T> {
  state: AsyncState<T> & { reload: () => void }
  /** What failed to load, for the error message (e.g. "lo storico"). */
  what: string
  children: (data: T) => ReactNode
}

/** Renders the loaded data, or a skeleton, or a retryable error. */
export function LoadState<T>({ state, what, children }: LoadStateProps<T>) {
  if (state.status === 'loading') return <Skeleton label="Caricamento…" />

  if (state.status === 'error') {
    return (
      <div role="alert" className="error-state">
        <p>Non riesco a caricare {what}. I tuoi dati non sono stati toccati.</p>
        <p className="error-state__detail">{state.error.message}</p>
        <PrimaryButton variant="outline" onClick={state.reload}>
          Riprova
        </PrimaryButton>
      </div>
    )
  }
  return <>{children(state.data)}</>
}
