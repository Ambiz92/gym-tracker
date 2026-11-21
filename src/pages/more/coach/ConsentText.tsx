import { CONSENT_TEXT_PLACEHOLDER as text } from './consent'

/** What the coach will see, in the placeholder wording (see consent.ts). */
export function ConsentText() {
  return (
    <div className="coach-consent">
      <p className="coach-consent__notice">{text.notice}</p>
      <p>{text.intro}</p>
      <ul>
        {text.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>{text.outro}</p>
    </div>
  )
}
