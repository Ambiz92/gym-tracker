import { useState } from 'react'
import { browserStorage, readTheme, saveTheme, THEME_OPTIONS, type ThemePreference } from './theme'

/** Auto / Chiaro / Scuro switch; the choice is applied at once and remembered on this device. */
export function ThemeSetting() {
  const [theme, setTheme] = useState<ThemePreference>(() => readTheme(browserStorage))

  function choose(next: ThemePreference) {
    saveTheme(next, browserStorage, document.documentElement)
    setTheme(next)
  }

  return (
    <div className="setting-row" role="group" aria-labelledby="theme-label">
      <span id="theme-label" className="setting-row__label">
        Tema
      </span>
      <div className="segmented">
        {THEME_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="segmented__option"
            aria-pressed={theme === value}
            onClick={() => choose(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
