import React from 'react'

export default function InfoNote({ children, tone = 'primary', className = '' }) {
  const tones = { primary: 'bg-primary-container text-on-primary-container', mint: 'bg-tertiary-container text-on-tertiary-container', blush: 'bg-secondary-container text-on-secondary-container' }
  return <aside role="note" className={`rounded-card p-space-md text-body-md ${tones[tone] ?? tones.primary} ${className}`}>{children}</aside>
}
