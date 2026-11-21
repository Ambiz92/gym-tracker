import { useState } from 'react'
import { PrimaryButton } from '../../../components/PrimaryButton'

type CopyState = 'idle' | 'copied' | 'failed'

const COPY_MESSAGES: Record<CopyState, string> = {
  idle: '',
  copied: 'Codice copiato.',
  failed: 'Non riesco a copiarlo: selezionalo e copialo a mano.',
}

/** The user's own code (their account id): what an athlete pastes to ask this user to be their coach. */
export function CoachCode({ code }: { code: string }) {
  const [copy, setCopy] = useState<CopyState>('idle')

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopy('copied')
    } catch {
      setCopy('failed')
    }
  }

  return (
    <div>
      <h3 className="coach-subhead">Il tuo codice</h3>
      <p className="history-note">Se alleni qualcuno, dagli questo codice: lo incolla nella richiesta.</p>
      <p className="coach-code">
        <code>{code}</code>
      </p>
      <PrimaryButton variant="outline" onClick={() => void copyCode()}>
        Copia il codice
      </PrimaryButton>
      {/* Always mounted so a screen reader announces the change; out of the layout until there is something to say. */}
      <p role="status" className={copy === 'idle' ? 'visually-hidden' : 'history-note'}>
        {COPY_MESSAGES[copy]}
      </p>
    </div>
  )
}
