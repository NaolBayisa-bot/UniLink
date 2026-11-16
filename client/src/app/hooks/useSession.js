import { useContext } from 'react'
import { SessionContext } from '../providers/session-provider.jsx'

/**
 * Consume the session provided by {@link AuthProvider}.
 * @returns {import('../providers/session-provider.jsx').SessionValue}
 */
export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession must be used within an AuthProvider')
  }
  return ctx
}
