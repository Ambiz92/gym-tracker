import { type FormEvent, useState } from 'react'
import { FormError } from '../../../auth/FormParts'
import { Field } from '../../../components/Field'
import { PrimaryButton } from '../../../components/PrimaryButton'
import { linkToCoach } from '../../../data/coachLinks'
import { useAction } from '../../../hooks/useAction'
import { parseAthleteLabel, parseCoachCode } from '../../../lib/coachLink'
import { describeCoachLinkError } from '../../dataErrors'
import { ConsentText } from './ConsentText'

interface LinkCoachFormProps {
  /** The user's own id, to refuse their own code. */
  userId: string
  onLinked: () => void
}

/** Links the athlete to a coach by code, with the name the coach will see; confirming is the consent, so the text comes first. */
export function LinkCoachForm({ userId, onLinked }: LinkCoachFormProps) {
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
    if (await run(() => linkToCoach(parsedCode.value, parsedLabel.value), 'Non riesco a creare il collegamento: riprova.')) onLinked()
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <h3 className="coach-subhead">Collegati al tuo allenatore</h3>
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
        Collegami al mio allenatore
      </PrimaryButton>
    </form>
  )
}
