import { getToken } from './session.js'

export class ApiError extends Error {
  constructor(status, code, details, retryAfter) {
    super(code)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.retryAfter = retryAfter
  }
}

export class NetworkError extends Error {
  constructor(message = 'No connection') {
    super(message)
    this.name = 'NetworkError'
  }
}

let onUnauthorizedHandler = null
let unauthorizedPromise = null
const DEFAULT_TIMEOUT_MS = 15_000

export function setOnUnauthorized(handler) {
  onUnauthorizedHandler = handler
}

export function clearOnUnauthorized() {
  onUnauthorizedHandler = null
  unauthorizedPromise = null
}

async function handleUnauthorized() {
  if (!onUnauthorizedHandler) {
    return
  }

  if (!unauthorizedPromise) {
    unauthorizedPromise = Promise.resolve(onUnauthorizedHandler())
  }

  try {
    await unauthorizedPromise
  } finally {
    unauthorizedPromise = null
  }
}

async function parseJsonBody(response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function apiFetch(path, options = {}) {
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}
  const baseUrl = (env.VITE_API_URL ?? (typeof process !== 'undefined' ? process.env.VITE_API_URL : undefined) ?? 'http://localhost').replace(/\/$/, '')
  const headers = new Headers(options.headers ?? {})

  if (!headers.has('Authorization')) {
    const token = getToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  const abortListener = () => controller.abort()
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort()
    } else {
      options.signal.addEventListener('abort', abortListener, { once: true })
    }
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers,
      signal: controller.signal,
    })

    const payload = await parseJsonBody(response)

    if (response.status === 204) {
      return undefined
    }

    if (!response.ok) {
      const retryAfterHeader = response.headers.get('Retry-After')
      const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined
      const code =
        typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : 'unknown_error'
      const details = typeof payload === 'object' && payload && 'details' in payload ? payload.details : undefined

      if (response.status === 401 && onUnauthorizedHandler) {
        await handleUnauthorized()
      }

      throw new ApiError(response.status, code, details, retryAfter)
    }

    return payload
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    if (error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new NetworkError('No connection')
    }

    if (error instanceof TypeError) {
      throw new NetworkError('No connection')
    }

    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
    if (options.signal) {
      options.signal.removeEventListener('abort', abortListener)
    }
  }
}
