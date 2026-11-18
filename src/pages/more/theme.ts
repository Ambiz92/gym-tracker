export type ThemePreference = 'auto' | 'light' | 'dark'

export const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
]

const STORAGE_KEY = 'gym-tracker.theme'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface RootLike {
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

/** Anything but a known value means "follow the system". */
export function parseTheme(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'auto'
}

// Takes a getter because merely touching window.localStorage can throw when storage is blocked.
type StorageGetter = () => StorageLike

/** Falls back to the system theme when storage is unavailable. */
export function readTheme(getStorage: StorageGetter): ThemePreference {
  try {
    return parseTheme(getStorage().getItem(STORAGE_KEY))
  } catch {
    return 'auto'
  }
}

/** "Auto" removes the attribute so the tokens follow prefers-color-scheme. */
export function applyTheme(theme: ThemePreference, root: RootLike): void {
  if (theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

/** Applies and remembers the choice; a storage failure only loses the memory, not the theme. */
export function saveTheme(theme: ThemePreference, getStorage: StorageGetter, root: RootLike): void {
  applyTheme(theme, root)
  try {
    getStorage().setItem(STORAGE_KEY, theme)
  } catch {
    // Storage is unavailable: the theme still applies until the page is closed.
  }
}

export const browserStorage: StorageGetter = () => window.localStorage

/** Restores the remembered theme at startup; a no-op outside the browser. */
export function applyStoredTheme(): void {
  if (typeof document === 'undefined') return
  applyTheme(readTheme(browserStorage), document.documentElement)
}
