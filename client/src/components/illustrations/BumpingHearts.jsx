import React from 'react'

// SIMPLIFIED illustration based on the repo-local bumping hearts export.
export default function BumpingHearts({ className = '' }) {
  return <svg viewBox="0 0 180 140" role="img" aria-label="Bumping hearts" className={className}>
    <path d="M88 112 35 61C6 33 46 4 70 31l18 20 18-20c24-27 64 2 35 30l-53 51Z" className="fill-secondary" />
    <path d="M89 100 62 74c-15-15 7-32 20-18l7 8 7-8c13-14 35 3 20 18l-27 26Z" className="fill-primary-container" />
    <circle cx="31" cy="25" r="7" className="fill-tertiary" /><circle cx="151" cy="31" r="6" className="fill-primary" />
  </svg>
}
