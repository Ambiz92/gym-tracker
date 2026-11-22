import { type FormEvent, useState } from 'react'
import { FormError } from '../../../auth/FormParts'
import { Field } from '../../../components/Field'
import { PrimaryButton } from '../../../components/PrimaryButton'
import { requestCoach } from '../../../data/coachLinks'
import { useAction } from '../../../hooks/useAction'
import { parseAthleteLabel, parseCoachCode } from '../../../lib/coachLink'
import { describeCoachLinkError } from '../../dataErrors'
import { ConsentText } from './ConsentText'

interface RequestCoachFormProps {
  /** The user's own id, to refuse their own code. */
  userId: string
  onRequested: () => void
}

/** Asks a coach by code, with the name the coach will see; sending it is the consent, so the text comes first. */
export function RequestCoachForm({ userId, onRequested }: RequestCoachFormProps) {
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [problems, setProblems] = useState<{ code?: string; label?: string }>({})
  const { busy, error, run } = useAction(describeCoachLinkError)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsedCode = parseCoachCode(code, userId)
    const parsedLabel = parseAthleteLabel(label)
    setProblems({
      code: parsedCode.ok ? undefined : parsedCode.message,
      label: parsedLabel.ok ? undefined : parsedLabel.message,
    })
    if (!parsedCode.ok || !parsedLabel.ok) return
    if (await run(() => requestCoach(parsedCode.value, parsedLabel.value), 'Non riesco a inviare la richiesta: riprova.')) onRequested()
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <h3 className="coach-subhead">Chiedi a un allenatore</h3>
      <p className="history-note">Incolla il codice che ti ha dato il tuo allenatore.</p>
      <Field label="Codice dell’allenatore" value={code} onChange={setCode} autoComplete="off" required error={problems.code} />
      <Field
        label="Il tuo nome"
        value={label}
        onChange={setLabel}
        autoComplete="off"
        required
        hint="È il nome che vedrà il tuo allenatore."
        error={problems.label}
      />
      <ConsentText />
      <label className="coach-agree">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        <span>Ho letto e acconsento</span>
      </label>
      <FormError message={error} />
      <PrimaryButton type="submit" busy={busy} disabled={!agreed}>
        Invia la richiesta
      </PrimaryButton>
    </form>
  )
}
