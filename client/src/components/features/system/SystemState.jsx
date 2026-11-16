import React from 'react'
import { useSession } from '../../../app/hooks/useSession.js'

/**
 * Minimal placeholder for the global session states. The real designs arrive
 * in Task 16; props are kept ready for that (status, onRetry, onSignOut).
 * @param {{ status?: import('../../../app/providers/session-provider.jsx').SessionStatus, onRetry?: () => void, onSignOut?: () => void }} props
 */
export function SystemState({ status: statusProp, onRetry, onSignOut }) {
  const session = useSession()
  const status = statusProp ?? session.status
  const retry = onRetry ?? session.retry
  const signOut = onSignOut ?? session.signOut

  return (
    <div role="status" className="p-4 text-center">
      {status === 'loading' && <div>Signing you in with Telegram...</div>}

      {status === 'not-telegram' && (
        <div>Please open Unilink in Telegram.</div>
      )}

      {status === 'ready' && <div>You're all set.</div>}

      {status === 'needs-setup' && (
        <div>Complete your profile to continue.</div>
      )}

      {status === 'offline' && (
        <div>
          No connection
          {retry && (
            <button type="button" onClick={retry} className="mt-2">
              Retry
            </button>
          )}
        </div>
      )}

      {status === 'expired' && (
        <div>
          Session expired
          {retry && (
            <button type="button" onClick={retry} className="mt-2">
              Sign in again
            </button>
          )}
        </div>
      )}

      {status === 'disabled' && (
        <div>
          Account unavailable.
          {signOut && (
            <button type="button" onClick={signOut} className="mt-2">
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  )
}
