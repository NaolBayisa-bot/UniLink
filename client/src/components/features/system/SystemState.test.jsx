import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SystemState } from './SystemState.jsx'
import { useSession } from '../../../app/hooks/useSession.js'

vi.mock('../../../app/hooks/useSession.js')

function mockSession(status) {
  vi.mocked(useSession).mockReturnValue({
    status,
    retry: vi.fn(),
    signOut: vi.fn(),
  })
}

afterEach(() => {
  vi.mocked(useSession).mockReset()
})

describe('SystemState', () => {
  it.each([
    ['loading', 'Signing you in with Telegram...'],
    ['not-telegram', 'Please open Unilink in Telegram.'],
    ['ready', "You're all set."],
    ['needs-setup', 'Complete your profile to continue.'],
    ['offline', 'No connection'],
    ['expired', 'Session expired'],
    ['disabled', 'Account unavailable.'],
  ])('renders the %s state', (status, text) => {
    mockSession(status)
    render(<SystemState />)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('offline retry button calls onRetry prop', () => {
    const onRetry = vi.fn()
    mockSession('offline')
    render(<SystemState onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('expired sign-in-again button calls session retry', () => {
    const retry = vi.fn()
    mockSession('expired')
    vi.mocked(useSession).mockReturnValue({ status: 'expired', retry, signOut: vi.fn() })
    render(<SystemState />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(retry).toHaveBeenCalled()
  })

  it('disabled sign-out button calls session signOut', () => {
    const signOut = vi.fn()
    mockSession('disabled')
    vi.mocked(useSession).mockReturnValue({ status: 'disabled', retry: vi.fn(), signOut })
    render(<SystemState />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalled()
  })

  it('accepts an explicit status prop', () => {
    mockSession('ready')
    render(<SystemState status="offline" />)
    expect(screen.getByText('No connection')).toBeInTheDocument()
  })
})
