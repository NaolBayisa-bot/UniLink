import { applyTheme } from '../theme'

let webApp
let bootstrapped = false
let themeHandler

const prefersDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

function createMockWebApp() {
  const events = new Map()
  let backHandler
  const backButton = {
    show: () => {},
    hide: () => {},
    onClick: (handler) => { backHandler = handler },
    offClick: (handler) => { if (backHandler === handler) backHandler = undefined },
  }
  return {
    initData: 'mock_init_data=1',
    colorScheme: prefersDark() ? 'dark' : 'light',
    themeParams: {},
    ready: () => {},
    expand: () => {},
    BackButton: backButton,
    HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
    openTelegramLink: () => {},
    openLink: () => {},
    onEvent: (event, handler) => {
      const handlers = events.get(event) ?? new Set()
      handlers.add(handler)
      events.set(event, handlers)
    },
    offEvent: (event, handler) => events.get(event)?.delete(handler),
    isVersionAtLeast: () => true,
    safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    contentSafeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    disableVerticalSwipes: () => {},
    __emit: (event, payload) => events.get(event)?.forEach((handler) => handler(payload)),
    __getBackHandler: () => backHandler,
  }
}

function shouldMock() {
  return import.meta.env.VITE_MOCK_TELEGRAM === 'true' || (import.meta.env.DEV && !window.Telegram?.WebApp)
}

export function getWebApp() {
  if (webApp) return webApp
  if (typeof window === 'undefined') return undefined
  if (shouldMock()) {
    webApp = createMockWebApp()
    window.Telegram = { WebApp: webApp }
    return webApp
  }
  webApp = window.Telegram?.WebApp
  return webApp
}

export function isTelegramAvailable() {
  return Boolean(getWebApp())
}

export function bootstrapTelegram() {
  const app = getWebApp()
  if (!app || bootstrapped) return app
  bootstrapped = true
  app.ready?.()
  app.expand?.()
  app.disableVerticalSwipes?.()
  themeHandler = () => applyTheme(app.colorScheme === 'dark' ? 'dark' : 'light')
  app.onEvent?.('themeChanged', themeHandler)
  themeHandler()
  return app
}

export function subscribeToTelegramTheme(handler) {
  const app = getWebApp()
  if (!app) return () => {}
  const onThemeChanged = () => handler(app.colorScheme === 'dark' ? 'dark' : 'light')
  app.onEvent?.('themeChanged', onThemeChanged)
  return () => app.offEvent?.('themeChanged', onThemeChanged)
}

export function getTelegramSafeArea() {
  const app = getWebApp()
  return app?.safeAreaInsets ?? app?.contentSafeAreaInsets ?? {}
}

export function __setWebAppForTests(nextWebApp) {
  webApp = nextWebApp
  bootstrapped = false
  if (themeHandler) webApp?.offEvent?.('themeChanged', themeHandler)
  themeHandler = undefined
}

export function __resetWebAppForTests() {
  webApp = undefined
  bootstrapped = false
  themeHandler = undefined
}
