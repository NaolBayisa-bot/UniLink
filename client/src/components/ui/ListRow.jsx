import React from 'react'

export default function ListRow({ leading, children, trailing, className = '', onClick, ...props }) {
  const Component = onClick ? 'button' : 'div'
  return <Component type={onClick ? 'button' : undefined} onClick={onClick} className={`flex min-h-[72px] w-full items-center gap-space-md rounded-card bg-surface-low p-space-md text-left transition hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`} {...props}>
    {leading && <div className="shrink-0">{leading}</div>}
    <div className="min-w-0 flex-1">{children}</div>
    {trailing && <div className="shrink-0">{trailing}</div>}
  </Component>
}
