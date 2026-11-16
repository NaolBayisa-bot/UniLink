import React from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession.js'

/**
 * Renders children only when the session is ready.
 * Loading -> null; any other state -> redirect to "/".
 * @param {{ children: React.ReactNode }} props
 */
export function RequireSession({ children }) {
  const { status } = useSession()
  if (status === 'loading') return null
  if (status !== 'ready') return <Navigate to="/" replace />
  return children
}

/**
 * Renders children only when the session is ready and the profile is complete.
 * needs-setup -> redirect to "/setup"; not ready -> redirect to "/".
 * @param {{ children: React.ReactNode }} props
 */
export function RequireCompleteProfile({ children }) {
  const { status } = useSession()
  if (status === 'loading') return null
  if (status === 'needs-setup') return <Navigate to="/setup" replace />
  if (status !== 'ready') return <Navigate to="/" replace />
  return children
}

/**
 * Redirects already-completed sessions away from /setup to /discover.
 * @param {{ children: React.ReactNode }} props
 */
export function RedirectIfComplete({ children }) {
  const { status } = useSession()
  if (status === 'ready') return <Navigate to="/discover" replace />
  return children
}
