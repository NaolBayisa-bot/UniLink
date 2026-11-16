import { useEffect, useState } from 'react'
import { applyTheme } from '../theme'
import { getTelegramSafeArea, getWebApp, isTelegramAvailable, subscribeToTelegramTheme } from './bridge'

export function useTelegram() {
  const app = getWebApp()
  const [colorScheme, setColorScheme] = useState(app?.colorScheme ?? 'light')

  useEffect(() => subscribeToTelegramTheme((nextScheme) => {
    setColorScheme(nextScheme)
    applyTheme(nextScheme)
  }), [])

  return {
    isTelegram: isTelegramAvailable(),
    initData: app?.initData,
    colorScheme,
    themeParams: app?.themeParams ?? {},
    haptic: (type) => {
      if (type === 'tap') app?.HapticFeedback?.impactOccurred?.('light')
      if (type === 'success') app?.HapticFeedback?.notificationOccurred?.('success')
    },
    openTelegramLink: (url) => app?.openTelegramLink?.(url),
    openLink: (url) => app?.openLink?.(url),
  }
}

export function useBackButton(handler) {
  useEffect(() => {
    const button = getWebApp()?.BackButton
    if (!button) return undefined
    if (handler) {
      button.onClick?.(handler)
      button.show?.()
    }
    return () => {
      if (handler) button.offClick?.(handler)
      button.hide?.()
    }
  }, [handler])
}

export function useSafeArea() {
  const [insets, setInsets] = useState(getTelegramSafeArea)
  useEffect(() => {
    const app = getWebApp()
    const update = () => {
      const nextInsets = getTelegramSafeArea()
      setInsets(nextInsets)
      const root = document.documentElement
      root.style.setProperty('--safe-top', `${nextInsets.top ?? 0}px`)
      root.style.setProperty('--safe-right', `${nextInsets.right ?? 0}px`)
      root.style.setProperty('--safe-bottom', `${nextInsets.bottom ?? 0}px`)
      root.style.setProperty('--safe-left', `${nextInsets.left ?? 0}px`)
    }
    update()
    app?.onEvent?.('viewportChanged', update)
    return () => app?.offEvent?.('viewportChanged', update)
  }, [])
  return insets
}
