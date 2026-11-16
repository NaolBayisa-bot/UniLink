import React from 'react'
import Chip from './Chip'

const labels = { new: 'New', waiting: 'Waiting for them', turn: 'Your turn', shared: 'Contact shared' }

export default function Pill({ status = 'new', children, ...props }) {
  const tones = { new: 'blush', waiting: 'neutral', turn: 'primary', shared: 'mint' }
  return <Chip tone={tones[status] ?? 'primary'} {...props}>{children ?? labels[status] ?? status}</Chip>
}
