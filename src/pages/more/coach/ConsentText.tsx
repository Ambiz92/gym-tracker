import { CONSENT_TEXT as text } from './consent'

/** What the coach will see, before the athlete sends the request (see consent.ts). */
export function ConsentText() {
  return (
    <div className="coach-consent">
      <p>
        <strong>{text.title}</strong>
      </p>
      <p>{text.intro}</p>
      <ul>
        {text.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>{text.health}</p>
      <p>{text.revoke}</p>
      <p>{text.outro}</p>
    </div>
  )
}
