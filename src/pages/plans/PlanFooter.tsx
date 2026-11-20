import type { ReactNode } from 'react'
import { SessionDock } from '../../components/SessionDock'
import { footerState } from '../../lib/planBuilder'
import { planDetail } from '../../lib/planList'
import '../../styles/session.css'
import '../../styles/builder.css'

interface PlanFooterProps {
  plan: { is_active: boolean; archived: boolean }
  sessionCount: number
  exerciseCount: number
  /** Name of the plan that Oggi shows now, while the user is asked to replace it. */
  replacing: string | null
  busy: boolean
  /** Failure of the last activation, announced to screen readers. */
  error: string | null
  /** The Undo toast of a removed exercise, shown above the bar. */
  toast: ReactNode
  onToggle: () => void
  onConfirmReplace: () => void
  onCancelReplace: () => void
}

/** The bar pinned at the bottom of the plan: what the plan holds, where it stands, and the one button that puts it in Oggi. */
export function PlanFooter({ plan, sessionCount, exerciseCount, replacing, busy, error, toast, onToggle, onConfirmReplace, onCancelReplace }: PlanFooterProps) {
  const { status, button } = footerState(plan, exerciseCount)

  return (
    <SessionDock toast={toast}>
      {error && (
        <p role="alert" className="field__message field__message--error">
          {error}
        </p>
      )}
      {replacing !== null ? (
        <div role="group" aria-label="Conferma attivazione" className="plan-footer">
          <p className="plan-footer__text">
            <strong>Sostituisce la scheda attuale</strong>
            <span>«{replacing}» esce da Oggi.</span>
          </p>
          <div className="plan-footer__choices">
            <button type="button" className="plan-footer__button" disabled={busy} aria-busy={busy || undefined} onClick={onConfirmReplace}>
              Sostituisci
            </button>
            <button type="button" className="plan-footer__button plan-footer__button--quiet" disabled={busy} onClick={onCancelReplace}>
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <div className="plan-footer">
          <p className="plan-footer__text">
            <strong>{planDetail({ sessionCount, exerciseCount })}</strong>
            <span>{status}</span>
            {button?.disabled && <span id="plan-footer-hint">Aggiungi un esercizio per attivarla.</span>}
          </p>
          {button && (
            <button
              type="button"
              className="plan-footer__button"
              aria-label="Attiva scheda"
              aria-describedby={button.disabled ? 'plan-footer-hint' : undefined}
              aria-pressed={button.pressed}
              aria-busy={busy || undefined}
              disabled={button.disabled || busy}
              onClick={onToggle}
            >
              {button.label}
            </button>
          )}
        </div>
      )}
    </SessionDock>
  )
}
