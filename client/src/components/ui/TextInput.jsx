import React, { useId } from 'react'

export default function TextInput({ label, helperText, error, maxLength, value = '', onChange, className = '', id: providedId, ...props }) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const messageId = `${id}-message`
  return <div className={`space-y-space-xs ${className}`}>
    {label && <label htmlFor={id} className="block text-label-md text-on-surface">{label}</label>}
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={(error || helperText) ? messageId : undefined}
        className="h-14 w-full rounded-input border border-outline-variant bg-surface-low px-space-md text-body-lg text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-text disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      {maxLength && <span className="pointer-events-none absolute bottom-space-sm right-space-sm text-label-sm text-muted-text">{String(value).length}/{maxLength}</span>}
    </div>
    {(error || helperText) && <p id={messageId} className={`text-label-sm ${error ? 'text-error' : 'text-muted-text'}`}>{error || helperText}</p>}
  </div>
}
