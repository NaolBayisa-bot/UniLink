import React from 'react'
import Spinner from './Spinner'

const variants = {
  primary: 'bg-primary text-on-primary shadow-button hover:bg-primary/90',
  secondary: 'bg-primary-container text-primary hover:bg-primary-container/80',
  destructive: 'border border-error bg-surface text-error hover:bg-error-container/40',
  ghost: 'bg-transparent text-on-surface-variant hover:bg-surface-container',
}

export default function Button({ variant = 'primary', loading = false, disabled = false, fullWidth = false, className = '', children, ...props }) {
  return <button
    type="button"
    disabled={disabled || loading}
    className={`inline-flex h-[52px] items-center justify-center gap-space-sm rounded-pill px-space-xl text-subhead-lg transition-all duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${variants[variant] ?? variants.primary} ${fullWidth ? 'w-full' : ''} ${className}`}
    {...props}
  >
    {loading ? <Spinner size="sm" label="Loading" /> : children}
  </button>
}
