interface UndoToastProps {
  message: string
  onUndo: () => void
}

/** Confirmation of a saved set with a way back. */
export function UndoToast({ message, onUndo }: UndoToastProps) {
  return (
    <div className="undo-toast">
      <span>{message}</span>
      <button type="button" className="undo-toast__action" onClick={onUndo}>
        Annulla
      </button>
    </div>
  )
}
