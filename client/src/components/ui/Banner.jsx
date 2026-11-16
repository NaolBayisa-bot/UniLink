import React from 'react'

export default function Banner({ children, tone = 'primary', open = true, onClose, className = '' }) {
  const tones = { primary: 'bg-primary-container text-on-primary-container', mint: 'bg-tertiary-container text-on-tertiary-container', blush: 'bg-secondary-container text-on-secondary-container', error: 'bg-error-container text-on-error-container' }
  return <div role="status" aria-live="polite" className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-24 translate-y-0 opacity-100' : 'max-h-0 -translate-y-2 opacity-0'} ${className}`}>
    <div className={`flex items-center justify-between gap-space-sm rounded-card p-space-md text-body-md ${tones[tone] ?? tones.primary}`}>
      <span>{children}</span>
      {onClose && <button type="button" aria-label="Dismiss banner" onClick={onClose} className="rounded-full p-1 text-label-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">×</button>}
    </div>
  </div>
}
