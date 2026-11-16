import React from 'react'

export default function Skeleton({ variant = 'card', className = '' }) {
  const sizes = { card: 'h-32 w-full', list: 'h-[72px] w-full', profile: 'h-40 w-full' }
  return <div aria-hidden="true" className={`animate-pulse rounded-card bg-surface-container ${sizes[variant] ?? sizes.card} ${className}`} />
}
