import React from 'react'

export default function SelectableCard({ selected = false, disabled = false, className = '', children, ...props }) {
  return <button type="button" aria-pressed={selected} disabled={disabled} className={`flex min-h-[120px] w-full flex-col items-center justify-center rounded-card-lg border bg-surface-low p-space-md text-center shadow-card transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${selected ? 'border-primary bg-primary-container text-on-primary-container' : 'border-transparent text-on-surface'} disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>{children}</button>
}
