import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'colaad-theme'

export const THEMES = [
  { code: 'light', label: 'Light' },
  { code: 'dark', label: 'Dark' },
  { code: 'system', label: 'System' },
]

/** Dark is the office default; a saved choice always wins over it. */
export const DEFAULT_THEME = 'dark'

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return ['light', 'dark', 'system'].includes(saved) ? saved : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: dark)').matches

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStored)

  const resolved = theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* private browsing: memory only */
    }
  }, [theme, resolved])

  // Follow the operating system live while "System" is selected
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setTheme('system')
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      resolved,
      isDark: resolved === 'dark',
      setTheme: useCallback((t) => setTheme(t), []),
      themes: THEMES,
    }),
    [theme, resolved],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
