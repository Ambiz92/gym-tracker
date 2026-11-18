import type { ReactNode } from 'react'
import { PrimaryButton } from '../../components/PrimaryButton'
import type { AsyncState } from '../../hooks/useAsync'

interface LoadStateProps<T> {
  state: AsyncState<T> & { reload: () => void }
  /** What failed to load, for the error message (e.g. "lo storico"). */
  what: string
  children: (data: T) => ReactNode
}

/** Renders the loaded data, or a loading line, or a retryable error. */
export function LoadState<T>({ state, what, children }: LoadStateProps<T>) {
  if (state.status === 'loading') {
    return (
      <p role="status" className="history-status">
        Caricamento…
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <div role="alert" className="history-status">
        <p>Non riesco a caricare {what}. I tuoi dati non sono stati toccati.</p>
        <p className="history-status__detail">{state.error.message}</p>
        <PrimaryButton variant="outline" onClick={state.reload}>
          Riprova
        </PrimaryButton>
      </div>
    )
  }
  return <>{children(state.data)}</>
}
