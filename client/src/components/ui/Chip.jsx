import React from 'react'

export default function Chip({ children, tone = 'primary', selected = false, disabled = false, className = '', ...props }) {
  const tones = { primary: 'bg-primary-container text-primary', blush: 'bg-secondary-container text-on-secondary-container', mint: 'bg-tertiary-container text-on-tertiary-container', neutral: 'bg-surface-container text-on-surface-variant' }
  const Component = props.onClick ? 'button' : 'span'
  return <Component type={props.onClick ? 'button' : undefined} aria-pressed={props.onClick ? selected : undefined} disabled={disabled} className={`inline-flex min-h-8 items-center rounded-pill px-3 text-label-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tones[tone] ?? tones.primary} ${selected ? 'ring-2 ring-primary' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`} {...props}>{children}</Component>
}
