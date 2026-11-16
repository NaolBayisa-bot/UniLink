import React from 'react'

// SIMPLIFIED illustration based on the repo-local sleepy lavender cloud export.
export default function SleepyCloud({ className = '' }) {
  return <svg viewBox="0 0 180 120" role="img" aria-label="Sleepy cloud" className={className}>
    <path d="M42 86c-18 0-28-11-28-25 0-15 12-27 28-27 5-17 20-25 37-25 19 0 34 11 39 29 18 0 30 11 30 25 0 14-11 23-29 23H42Z" className="fill-primary-container" />
    <path d="M65 57c4 5 8 5 12 0M97 57c4 5 8 5 12 0" className="fill-none stroke-primary stroke-2" strokeLinecap="round" />
    <path d="M82 68c5 5 10 5 15 0" className="fill-none stroke-on-primary-container stroke-2" strokeLinecap="round" />
    <path d="M137 28h10M142 23v10" className="stroke-secondary stroke-2" strokeLinecap="round" />
  </svg>
}
