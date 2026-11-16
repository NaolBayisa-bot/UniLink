import React from 'react'

export default function ProgressSteps({ current = 1, total = 3, className = '' }) {
  return <div className={`space-y-space-sm ${className}`} aria-label={`Step ${current} of ${total}`}>
    <div className="flex gap-space-xs">{Array.from({ length: total }, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-pill ${index < current ? 'bg-primary' : 'bg-primary-container'}`} />)}</div>
    <span className="text-label-md text-on-surface-variant">Step {current} of {total}</span>
  </div>
}
