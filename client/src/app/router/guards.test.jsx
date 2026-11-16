import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import {
  RequireSession,
  RequireCompleteProfile,
  RedirectIfComplete,
} from './guards.jsx'
import { useSession } from '../hooks/useSession.js'

vi.mock('../hooks/useSession.js')

function LocationProbe() {
  const { pathname } = useLocation()
  return <div data-testid="location">{pathname}</div>
}

function Children() {
  return <div data-testid="children">Children</div>
}

function renderGuard({ status, element, initialEntry = '/' }) {
  vi.mocked(useSession).mockReturnValue({ status })
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      {element}
      <LocationProbe />
    </MemoryRouter>
  )
}

afterEach(() => {
  vi.mocked(useSession).mockReset()
})

describe('RequireSession', () => {
  it('renders nothing while loading', () => {
    renderGuard({ status: 'loading', element: <RequireSession><Children /></RequireSession> })
    expect(screen.queryByTestId('children')).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/')
  })

  it('redirects to / when not ready', () => {
    renderGuard({
      status: 'not-telegram',
      element: <RequireSession><Children /></RequireSession>,
      initialEntry: '/setup',
    })
    expect(screen.getByTestId('location')).toHaveTextContent('/')
    expect(screen.queryByTestId('children')).not.toBeInTheDocument()
  })

  it('renders children when ready', () => {
    renderGuard({ status: 'ready', element: <RequireSession><Children /></RequireSession> })
    expect(screen.getByTestId('children')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/')
  })
})

describe('RequireCompleteProfile', () => {
  it('redirects to /setup when needs-setup', () => {
    renderGuard({
      status: 'needs-setup',
      element: <RequireCompleteProfile><Children /></RequireCompleteProfile>,
      initialEntry: '/discover',
    })
    expect(screen.getByTestId('location')).toHaveTextContent('/setup')
  })

  it('redirects to / when not ready', () => {
    renderGuard({
      status: 'not-telegram',
      element: <RequireCompleteProfile><Children /></RequireCompleteProfile>,
      initialEntry: '/discover',
    })
    expect(screen.getByTestId('location')).toHaveTextContent('/')
  })

  it('renders children when ready', () => {
    renderGuard({
      status: 'ready',
      element: <RequireCompleteProfile><Children /></RequireCompleteProfile>,
    })
    expect(screen.getByTestId('children')).toBeInTheDocument()
  })
})

describe('RedirectIfComplete', () => {
  it('redirects to /discover when ready', () => {
    renderGuard({
      status: 'ready',
      element: <RedirectIfComplete><Children /></RedirectIfComplete>,
      initialEntry: '/setup',
    })
    expect(screen.getByTestId('location')).toHaveTextContent('/discover')
  })

  it('renders children when not ready', () => {
    renderGuard({
      status: 'not-telegram',
      element: <RedirectIfComplete><Children /></RedirectIfComplete>,
      initialEntry: '/setup',
    })
    expect(screen.getByTestId('children')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/setup')
  })
})
