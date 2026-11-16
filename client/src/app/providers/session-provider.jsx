import React, { useCallback, useEffect, useRef, useState } from 'react'
import { authTelegram, getMe } from '../../api/endpoints.js'
import { setOnUnauthorized, clearOnUnauthorized } from '../../api/client.js'
import { clearToken, setToken } from '../../api/session.js'
import { getWebApp } from '../../lib/telegram/bridge.js'


/**
 * Global session status.
 * @typedef {'loading' | 'not-telegram' | 'ready' | 'needs-setup' | 'offline' | 'expired' | 'disabled'} SessionStatus
 */

/**
 * Value exposed by {@link AuthProvider} and {@link useSession}.
 * @typedef {Object} SessionValue
 * @property {SessionStatus} status
 * @property {Object|null} user
 * @property {boolean} isReady
 * @property {boolean} isNeedsSetup
 * @property {boolean} isOffline
 * @property {boolean} isExpired
 * @property {boolean} isDisabled
 * @property {() => Promise<Object>} refreshMe - Re-fetch GET /me (source of truth for profile_complete)
 * @property {() => Promise<void>} retry - Re-run the login flow (used from offline)
 * @property {() => void} signOut - Clear the in-memory token and reset state
 */

/**
 * AuthProvider owns the authentication/session state for the whole app.
 *
 * Startup: if not in Telegram -> 'not-telegram'. Otherwise 'loading' then
 * POST /auth/telegram with initData, store the token in memory (session.ts)
 * and keep the returned user. profile_complete decides 'ready' vs
 * 'needs-setup'.
 *
 * Errors map to states: 401 -> 'expired', 403 -> 'disabled', network failure
 * -> 'offline'.
 *
 * Registers the client's onUnauthorized handler: exactly ONE silent re-login
 * with initData. If it fails, switch to 'expired'.
 *
 * The token is never persisted (memory only) and initData/token are never
 * logged.
 *
 * @param {{ children: React.ReactNode }} props
 */
export const SessionContext = React.createContext(null)
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)
  const initDataRef = useRef(null)
  const loggingInRef = useRef(false)
  const reLoginInFlightRef = useRef(false)

  const isReady = status === 'ready'
  const isNeedsSetup = status === 'needs-setup'
  const isOffline = status === 'offline'
  const isExpired = status === 'expired'
  const isDisabled = status === 'disabled'

  /**
   * POST /auth/telegram and persist the returned token + user in memory.
   * @param {string} initData
   * @returns {Promise<Object|null>}
   */
  async function performLogin(initData) {
    const res = await authTelegram(initData)
    setToken(res.token)
    initDataRef.current = initData
    const nextUser = res.user ?? null
    setUser(nextUser)
    return nextUser
  }

  function setStatusFromUser(nextUser) {
    setStatus(nextUser && nextUser.profile_complete ? 'ready' : 'needs-setup')
  }

  function handleLoginError(error) {
    if (error && error.name === 'ApiError') {
      if (error.status === 403) {
        setStatus('disabled')
      } else {
        // 401 (invalid init data / expired) and other HTTP errors
        setStatus('expired')
      }
    } else if (error && error.name === 'NetworkError') {
      setStatus('offline')
    } else {
      setStatus('expired')
    }
  }

  async function attemptLogin() {
    if (loggingInRef.current) return
    loggingInRef.current = true
    try {
      setStatus('loading')
      const app = getWebApp()
      const initData = app && app.initData ? String(app.initData) : null
      if (!initData) {
        setStatus('expired')
        return
      }
      const nextUser = await performLogin(initData)
      setStatusFromUser(nextUser)
    } catch (error) {
      handleLoginError(error)
    } finally {
      loggingInRef.current = false
    }
  }

  /**
   * Refresh the current user from GET /me (the source of truth for
   * profile_complete). 401s are handled by the registered onUnauthorized
   * handler (silent re-login); after that the session state already reflects
   * the outcome, so a 401 is surfaced as "no data" rather than a crash.
   * @returns {Promise<Object|null>}
   */
  async function refreshMe() {
    try {
      const res = await getMe()
      const nextUser = res ?? null
      setUser(nextUser)
      setStatusFromUser(nextUser)
      return res
    } catch (error) {
      if (error && error.name === 'ApiError' && error.status === 401) {
        return null
      }
      throw error
    }
  }

  async function retry() {
    await attemptLogin()
  }

  function signOut() {
    clearToken()
    setUser(null)
    initDataRef.current = null
    setStatus('loading')
  }

  /**
   * Silent re-login handler registered with the api client.
   * Runs at most once per 401 wave (client single-flights it).
   */
  const handleUnauthorized = useCallback(async () => {
    const app = getWebApp()
    const initData =
      (app && app.initData ? String(app.initData) : null) || initDataRef.current
    if (!initData) {
      setStatus('expired')
      return
    }
    if (reLoginInFlightRef.current) return
    reLoginInFlightRef.current = true
    try {
      const nextUser = await performLogin(initData)
      setStatusFromUser(nextUser)
    } catch {
      setStatus('expired')
    } finally {
      reLoginInFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    setOnUnauthorized(handleUnauthorized)
    return () => clearOnUnauthorized()
  }, [handleUnauthorized])

  useEffect(() => {
    if (!getWebApp()) {
      setTimeout(() => setStatus('not-telegram'), 0)
      return
    }
    attemptLogin()
  }, [attemptLogin])

  /** @type {SessionValue} */
  const value = {
    status,
    user,
    isReady,
    isNeedsSetup,
    isOffline,
    isExpired,
    isDisabled,
    refreshMe,
    retry,
    signOut,
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}
