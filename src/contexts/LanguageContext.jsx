import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { translations, DEFAULT_LANGUAGE, LANGUAGES } from '../i18n/translations'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'colaad-lang'

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return translations[saved] ? saved : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

/**
 * Sits above AuthProvider so the login screen is already in Somali before
 * anyone signs in. Once an employee is known, their saved preference is
 * applied by useSyncProfileLanguage() below.
 */
export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* private browsing: fall back to memory only */
    }
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key, fallback) => {
      const dict = translations[lang] ?? translations[DEFAULT_LANGUAGE]
      // English is the safety net: an untranslated key shows real words,
      // never a raw key or a blank space.
      return dict[key] ?? translations.en[key] ?? fallback ?? key
    },
    [lang],
  )

  const value = useMemo(
    () => ({
      lang,
      setLang: (next) => translations[next] && setLang(next),
      t,
      isSomali: lang === 'so',
      languages: LANGUAGES,
    }),
    [lang, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return ctx
}

/** Shorthand for components that only need the translate function. */
export function useT() {
  return useLanguage().t
}
