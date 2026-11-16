import { useEffect, useMemo, useState } from 'react'

const getSystemTheme = () => (
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
)

export function applyTheme(scheme) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = scheme
  }
}

export function useTheme(scheme) {
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const [localTheme, setLocalTheme] = useState(systemTheme)
  const theme = scheme ?? localTheme

  useEffect(() => {
    if (scheme) {
      applyTheme(scheme)
      return undefined
    }

    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const syncTheme = () => {
      const nextTheme = media?.matches ? 'dark' : 'light'
      setSystemTheme(nextTheme)
      setLocalTheme(nextTheme)
      applyTheme(nextTheme)
    }

    syncTheme()
    media?.addEventListener?.('change', syncTheme)
    return () => media?.removeEventListener?.('change', syncTheme)
  }, [scheme])

  return useMemo(() => ({
    theme,
    setTheme: (nextTheme) => {
      if (!scheme) setLocalTheme(nextTheme)
      applyTheme(nextTheme)
    },
    toggleTheme: () => {
      const nextTheme = theme === 'dark' ? 'light' : 'dark'
      if (!scheme) setLocalTheme(nextTheme)
      applyTheme(nextTheme)
    },
  }), [scheme, theme])
}
