import React from 'react'

export default function IconButton({ variant = 'default', label, disabled = false, className = '', children, ...props }) {
  const styles = {
    default: 'bg-surface-container-low text-primary hover:bg-primary-container',
    liked: 'bg-secondary text-on-secondary hover:bg-secondary/90',
    disabled: 'bg-surface-container text-on-surface-variant',
  }
  return <button
    type="button"
    aria-label={label}
    disabled={disabled || variant === 'disabled'}
    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant] ?? styles.default} ${className}`}
    {...props}
  >{children}</button>
}
