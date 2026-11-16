import React from 'react'

const steps = [
  ['like', 'You both like'],
  ['share', 'Share contact'],
  ['username', 'No public username'],
]

export default function RevealLadder({ state = 'like', compact = false, className = '' }) {
  const active = Math.max(0, steps.findIndex(([key]) => key === state))
  return <div className={`${compact ? 'flex items-center gap-space-xs' : 'space-y-space-sm'} ${className}`} aria-label="Contact reveal status">
    {steps.map(([key, label], index) => <div key={key} className={compact ? 'flex min-w-0 flex-1 items-center gap-space-xs' : 'flex items-center gap-space-sm'}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label-sm ${index <= active ? 'bg-primary text-on-primary' : 'bg-primary-container text-primary'}`}>{index + 1}</span>
      <span className={`text-label-md ${index <= active ? 'text-on-surface' : 'text-muted-text'} ${compact ? 'truncate' : ''}`}>{label}</span>
      {compact && index < steps.length - 1 && <span className="h-px flex-1 bg-outline-variant" />}
    </div>)}
  </div>
}
