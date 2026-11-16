import React from 'react'

// SIMPLIFIED illustration based on the repo-local half-finished heart export.
export default function HalfFinishedHeart({ className = '' }) {
  return <svg viewBox="0 0 160 140" role="img" aria-label="Half finished heart" className={className}>
    <path d="M80 116 28 65C0 37 40 8 61 35l19 22 19-22c21-27 61 2 33 30l-52 51Z" className="fill-none stroke-primary stroke-[7]" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m80 116 52-51c28-28-12-57-33-30" className="fill-none stroke-secondary stroke-[7]" strokeLinecap="round" />
    <path d="M22 21h10M27 16v10" className="stroke-tertiary stroke-2" strokeLinecap="round" />
  </svg>
}
