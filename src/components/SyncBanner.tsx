interface SyncBannerProps {
  /** Sets (and undos) the server has not confirmed yet. */
  count: number
  syncing: boolean
  failed: boolean
  onRetry: () => void
}

/** Visible while confirmed sets still wait to reach the server; they are safe on the phone meanwhile. */
export function SyncBanner({ count, syncing, failed, onRetry }: SyncBannerProps) {
  if (count === 0) return null

  const what = count === 1 ? '1 serie da inviare' : `${count} serie da inviare`
  return (
    <div className="sync-banner" role="status">
      <span>{failed && !syncing ? `${what} · invio non riuscito` : what}</span>
      <button type="button" className="sync-banner__retry" onClick={onRetry} disabled={syncing}>
        {syncing ? 'Invio…' : 'Riprova ↻'}
      </button>
    </div>
  )
}
