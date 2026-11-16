import React, { useId } from 'react'

export default function Select({ label, options = [], placeholder, helperText, error, value = '', onChange, className = '', id: providedId, ...props }) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const messageId = `${id}-message`
  return <div className={`space-y-space-xs ${className}`}>
    {label && <label htmlFor={id} className="block text-label-md text-on-surface">{label}</label>}
    <select id={id} value={value} onChange={onChange} aria-invalid={Boolean(error)} aria-describedby={(error || helperText) ? messageId : undefined} className="h-14 w-full rounded-input border border-outline-variant bg-surface-low px-space-md text-body-lg text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50" {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    {(error || helperText) && <p id={messageId} className={`text-label-sm ${error ? 'text-error' : 'text-muted-text'}`}>{error || helperText}</p>}
  </div>
}
