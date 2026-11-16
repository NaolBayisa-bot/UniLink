import React from 'react'

export default function Card({ children, elevated = true, rounded = 'lg', padding = 'md', className = '', ...props }) {
  const radii = { md: 'rounded-card', lg: 'rounded-card-lg', xl: 'rounded-[24px]' }
  const paddings = { sm: 'p-space-sm', md: 'p-space-md', lg: 'p-space-lg' }
  return <div className={`bg-surface-low ${radii[rounded] ?? radii.lg} ${paddings[padding] ?? paddings.md} ${elevated ? 'shadow-card' : ''} ${className}`} {...props}>{children}</div>
}
