import React from 'react'
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './session-provider.jsx'
import { useSession } from '../hooks/useSession.js'
import { getWebApp } from '../../lib/telegram/bridge.js'
import { clearToken, getToken } from '../../api/session.js'

// The `bridge` module is mocked so the provider can simulate "in Telegram" /
// "not in Telegram" deterministically without depending on the real bridge
// (which auto-creates a mock webapp in the vitest environment).
vi.mock('../../lib/telegram/bridge.js')

/** Module-level flags to drive the in-memory mock fetch. */
let currentInitData = 'valid'
let meErrorNext = false
let meProfileComplete = true
let networkErrorNext = false
let reLoginFails = false

function StatusProbe() {
  const session = useSession()
  return (
    <div>
      <span data-testid="status">{session.status}</span>
      <span data-testid="user-nickname">{session.user ? session.user.nickname : 'none'}</span>
      <button data-testid="btn-refresh" onClick={session.refreshMe}>
        Refresh
      </button>
      <button data-testid="btn-retry" onClick={session.retry}>
        Retry
      </button>
      <button data-testid="btn-signout" onClick={session.signOut}>
        Sign out
      </button>
    </div>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <StatusProbe />
    </AuthProvider>
  )
}

afterEach(() => {
  vi.mocked(getWebApp).mockReset()
  vi.spyOn(globalThis, 'fetch').mockRestore()
  clearToken()
  currentInitData = 'valid'
  meErrorNext = false
  meProfileComplete = true
  networkErrorNext = false
  reLoginFails = false
})
beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch)
})


describe('AuthProvider / useSession', () => {
  it('is not-telegram when not in Telegram', () => {
    renderProvider()
    expect(screen.getByTestId('status')).toHaveTextContent('not-telegram')
    expect(getToken()).toBeNull()
  })

  it('logs in with Telegram and becomes ready', async () => {
    vi.mocked(getWebApp).mockReturnValue({ initData: currentInitData })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    )
    expect(screen.getByTestId('user-nickname')).toHaveTextContent('Avery')
    expect(getToken()).not.toBeNull()
  })

  it('needs-setup when the profile is incomplete', async () => {
    currentInitData = 'needs-setup'
    vi.mocked(getWebApp).mockReturnValue({ initData: currentInitData })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('needs-setup')
    )
  })

  it('expired on invalid init data (401)', async () => {
    currentInitData = 'invalid'
    vi.mocked(getWebApp).mockReturnValue({ initData: currentInitData })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('expired')
    )
  })

  it('disabled on 403', async () => {
    currentInitData = 'disabled'
    vi.mocked(getWebApp).mockReturnValue({ initData: currentInitData })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('disabled')
    )
  })

  it('offline on network failure, then retry recovers', async () => {
    networkErrorNext = true
    vi.mocked(getWebApp).mockReturnValue({ initData: currentInitData })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('offline')
    )

    networkErrorNext = false
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-retry'))
    })
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    )
  })

  it('refreshMe is the source of truth for profile_complete', async () => {
    currentInitData = 'valid'
    vi.mocked(getWebApp).mockReturnValue({ initData: currentInitData })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    )

    meProfileComplete = false
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-refresh'))
    })
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('needs-setup')
    )

    meProfileComplete = true
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-refresh'))
    })
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    )
  })

  it('signOut clears the in-memory token and resets state', async () => {
    currentInitData = 'valid'
    vi.mocked(getWebApp).mockReturnValue({ initData: currentInitData })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    )
    expect(getToken()).not.toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-signout'))
    })
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('loading')
    )
    expect(getToken()).toBeNull()
  })

  it('401 then silent re-login success stays ready', async () => {
    currentInitData = 'valid'
    vi.mocked(getWebApp).mockReturnValue({ initData: currentInitData })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    )

    meErrorNext = true
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-refresh'))
    })
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    )
  })

  it('401 then silent re-login failure becomes expired', async () => {
    currentInitData = 'valid'
    vi.mocked(getWebApp).mockReturnValue({ initData: currentInitData })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    )

    meErrorNext = true
    reLoginFails = true
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-refresh'))
    })
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('expired')
    )
  })
}
)

// ---------------------------------------------------------------------------
// MSW mock fetch: mirrors the `handleFetch` handler in
// `client/src/api/mocks/handlers.js` so the provider can be tested against
// the same API contract the real server exposes.
// ---------------------------------------------------------------------------

function mockFetch(url, options) {
  const path = new URL(url).pathname
  const method = options && options.method ? options.method : 'GET'
  const body = options && options.body ? JSON.parse(String(options.body)) : {}

  if (networkErrorNext) {
    networkErrorNext = false
    throw new TypeError('failed to fetch')
  }

  if (method === 'POST' && path === '/auth/telegram') {
    if (body.init_data === 'invalid') {
      return new Response(JSON.stringify({ error: 'invalid_init_data' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (body.init_data === 'needs-setup') {
      return Response.json({
        token: 'mock-token',
        user: { id: 42, nickname: 'Avery', gender: 'female', profile_complete: false },
      })
    }
    if (body.init_data === 'disabled') {
      return Response.json({ error: 'account_disabled' }, { status: 403 })
    }
    return Response.json({
      token: 'mock-token',
      user: { id: 42, nickname: 'Avery', gender: 'female', profile_complete: true },
    })
  }

  if (method === 'GET' && path === '/me') {
    if (meErrorNext) {
      meErrorNext = false
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return Response.json({
      nickname: 'Avery',
      gender: 'female',
      real_name: null,
      department: null,
      profile_complete: meProfileComplete,
    })
  }

  if (method === 'POST' && path === '/auth/telegram' && reLoginFails) {
    reLoginFails = false
    // Simulated server-side failure while re-authorizing the session.
    throw new Error('re-login-server-error')
  }

  return Response.json({ error: 'not_found' }, { status: 404 })
}
