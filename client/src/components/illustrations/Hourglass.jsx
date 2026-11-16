import React from 'react'

// SIMPLIFIED illustration based on the repo-local session/hourglass-style exports.
export default function Hourglass({ className = '' }) {
  return <svg viewBox="0 0 140 160" role="img" aria-label="Hourglass" className={className}>
    <path d="M32 18h76M32 142h76M42 20c0 31 18 38 28 48-10 10-28 17-28 52M98 20c0 31-18 38-28 48 10 10 28 17 28 52" className="fill-none stroke-primary stroke-4" strokeLinecap="round" />
    <path d="M64 68h12L70 88 64 80Z" className="fill-secondary" />
    <path d="M59 112h22l-11-20Z" className="fill-tertiary" />
  </svg>
}
