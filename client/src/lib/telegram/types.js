/**
 * @typedef {'light'|'dark'} TelegramColorScheme
 * @typedef {{ top?: number, right?: number, bottom?: number, left?: number }} TelegramInsets
 * @typedef {{ [key: string]: string }} TelegramThemeParams
 * @typedef {{ show?: () => void, hide?: () => void, onClick?: (handler: () => void) => void, offClick?: (handler: () => void) => void }} TelegramBackButton
 * @typedef {{ impactOccurred?: (style: 'light'|'medium'|'heavy'|'rigid'|'soft') => void, notificationOccurred?: (type: 'error'|'success'|'warning') => void }} TelegramHapticFeedback
 * @typedef {{
 *   initData?: string,
 *   colorScheme?: TelegramColorScheme,
 *   themeParams?: TelegramThemeParams,
 *   ready?: () => void,
 *   expand?: () => void,
 *   BackButton?: TelegramBackButton,
 *   HapticFeedback?: TelegramHapticFeedback,
 *   openTelegramLink?: (url: string) => void,
 *   openLink?: (url: string, options?: { try_instant_view?: boolean }) => void,
 *   onEvent?: (event: 'themeChanged'|'viewportChanged', handler: (payload?: unknown) => void) => void,
 *   offEvent?: (event: 'themeChanged'|'viewportChanged', handler: (payload?: unknown) => void) => void,
 *   isVersionAtLeast?: (version: string) => boolean,
 *   safeAreaInsets?: TelegramInsets,
 *   contentSafeAreaInsets?: TelegramInsets,
 *   disableVerticalSwipes?: () => void,
 * }} TelegramWebApp
 */

export {}
