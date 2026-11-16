import React from 'react'

export default function Spinner({ size = 'md', label = 'Loading' }) {
  const sizes = { sm: 'h-4 w-4 border-2', md: 'h-5 w-5 border-2', lg: 'h-8 w-8 border-[3px]' }
  return <span aria-label={label} role="status" className={`inline-block animate-spin rounded-full border-primary/30 border-t-primary ${sizes[size] ?? sizes.md}`} />
}
