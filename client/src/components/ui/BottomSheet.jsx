import React, { useEffect, useRef } from 'react'

const focusable = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export default function BottomSheet({ open, title, onClose, children, className = '' }) {
  const sheetRef = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    previousFocus.current = document.activeElement
    const sheet = sheetRef.current
    const nodes = sheet?.querySelectorAll(focusable)
    nodes?.[0]?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !sheet) return
      const elements = [...sheet.querySelectorAll(focusable)]
      if (!elements.length) return
      const currentIndex = elements.indexOf(document.activeElement)
      if (currentIndex >= 0) {
        event.preventDefault()
        const nextIndex = event.shiftKey
          ? (currentIndex - 1 + elements.length) % elements.length
          : (currentIndex + 1) % elements.length
        elements[nextIndex].focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previousFocus.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-end" role="presentation">
    <button aria-label="Close dialog" className="absolute inset-0 cursor-default bg-inverse-surface/40" onClick={onClose} type="button" />
    <section ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={title ? 'bottom-sheet-title' : undefined} className={`relative z-10 w-full rounded-t-[24px] bg-surface-low px-space-md pb-[calc(var(--safe-bottom)+1rem)] pt-space-sm shadow-sheet focus:outline-none ${className}`}>
      <div className="mx-auto mb-space-md h-1 w-10 rounded-pill bg-outline-variant" />
      {title && <h2 id="bottom-sheet-title" className="mb-space-md text-headline-sm text-on-surface">{title}</h2>}
      {children}
    </section>
  </div>
}
