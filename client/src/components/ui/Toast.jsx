import React from 'react'
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])
  const showToast = useCallback(({ kind = 'info', title, message, duration = 3000 }) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((current) => [...current, { id, kind, title, message }])
    if (duration > 0) window.setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])
  const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss])
  return <ToastContext.Provider value={value}>
    {children}
    <div className="pointer-events-none fixed inset-x-space-md top-[calc(var(--safe-top)+1rem)] z-50 space-y-space-sm" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => <div key={toast.id} className={`pointer-events-auto rounded-card bg-surface-low p-space-md shadow-sheet ${toast.kind === 'error' ? 'border border-error' : toast.kind === 'success' ? 'border border-tertiary' : 'border border-primary-container'}`}>
        {toast.title && <p className="text-subhead-sm text-on-surface">{toast.title}</p>}
        <p className="text-body-md text-on-surface-variant">{toast.message}</p>
        <button type="button" className="sr-only" onClick={() => dismiss(toast.id)}>Dismiss</button>
      </div>)}
    </div>
  </ToastContext.Provider>
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

export default ToastProvider
