import React from 'react'

/* eslint-disable react-refresh/only-export-components */
const gradients = ['bg-gradient-avatar-lavender', 'bg-gradient-avatar-mint']
const sizes = { sm: 'h-10 w-10 text-body-md', md: 'h-12 w-12 text-subhead-lg', lg: 'h-[72px] w-[72px] text-headline-md' }

export function avatarGradient(name = '') {
  const hash = [...name].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7)
  return gradients[hash % gradients.length]
}

export default function Avatar({ name = '', emoji, src, status, size = 'md', className = '' }) {
  const initial = name.trim().charAt(0).toUpperCase() || '♡'
  return <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold text-on-primary ${avatarGradient(name)} ${sizes[size] ?? sizes.md} ${className}`}>
    {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : <span aria-hidden="true">{emoji || initial}</span>}
    {status && <span aria-label={status} className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface ${status === 'online' ? 'bg-tertiary' : status === 'pending' ? 'bg-secondary' : 'bg-outline'}`} />}
  </span>
}
