import React from 'react'

export default function EmptyState({ title, description, actionLabel, onAction, illustration, className = '' }) {
  return <section className={`flex flex-col items-center justify-center gap-space-md text-center ${className}`}>
    {illustration && <div aria-hidden="true">{illustration}</div>}
    <div className="space-y-space-xs"><h2 className="text-headline-sm text-on-surface">{title}</h2>{description && <p className="max-w-sm text-body-md text-muted-text">{description}</p>}</div>
    {actionLabel && <button type="button" onClick={onAction} className="rounded-pill bg-primary px-space-xl py-space-sm text-subhead-sm text-on-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">{actionLabel}</button>}
  </section>
}
