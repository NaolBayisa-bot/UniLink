import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, NetworkError, clearOnUnauthorized, setOnUnauthorized } from './client.js'
import { clearToken, setToken } from './session.js'

describe('api client', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://localhost')
    clearToken()
    clearOnUnauthorized()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    clearToken()
    clearOnUnauthorized()
  })

  it('adds the auth header', async () => {
    setToken('abc123')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ nickname: 'Avery' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await apiFetch('/me')

    const [, requestInit] = fetchSpy.mock.calls[0]
    expect(fetchSpy).toHaveBeenCalledWith('http://localhost/me', expect.any(Object))
    expect(requestInit.headers.get('Authorization')).toBe('Bearer abc123')
  })

  it('maps HTTP errors to ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'complete_profile_first' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(apiFetch('/browse')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'complete_profile_first',
    })
  })

  it('handles 204 responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await expect(apiFetch('/unmatch', { method: 'POST', body: { match_id: 'm_1' } })).resolves.toBeUndefined()
  })

  it('single-flights unauthorized handlers', async () => {
    const onUnauthorized = vi.fn()
    setOnUnauthorized(onUnauthorized)

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    await Promise.allSettled([apiFetch('/me'), apiFetch('/me')])

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('times out requests and throws NetworkError', async () => {
    vi.useFakeTimers()

    vi.spyOn(globalThis, 'fetch').mockImplementation((_, init) => {
      const signal = init?.signal

      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
      })
    })

    const promise = expect(apiFetch('/slow')).rejects.toBeInstanceOf(NetworkError)
    await vi.advanceTimersByTimeAsync(15_000)

    await promise
    vi.useRealTimers()
  })
})
