import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { useRef, useState } from 'react'
import { Button, BottomSheet, IconButton, ToastProvider, useToast, Avatar, avatarGradient } from '../components/ui'

describe('reusable UI primitives', () => {
  it('renders button variants and blocks disabled/loading interaction', () => {
    const onClick = vi.fn()
    render(<div><Button variant="primary">Primary</Button><Button variant="secondary">Secondary</Button><Button variant="destructive">Destructive</Button><Button variant="ghost">Ghost</Button><Button disabled onClick={onClick}>Disabled</Button><Button loading onClick={onClick}>Loading</Button></div>)
    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Destructive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ghost' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Disabled' }))
    fireEvent.click(screen.getByRole('button', { name: 'Loading' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders icon button states', () => {
    render(<div><IconButton label="Like">♡</IconButton><IconButton label="Liked" variant="liked">♥</IconButton><IconButton label="Unavailable" variant="disabled">♡</IconButton></div>)
    expect(screen.getByRole('button', { name: 'Like' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Liked' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled()
  })

  it('traps sheet focus, closes on Escape, and restores focus', () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      const triggerRef = useRef(null)
      return <><button ref={triggerRef} onClick={() => setOpen(true)}>Open</button><BottomSheet open={open} onClose={() => setOpen(false)}><button>First</button><button>Last</button></BottomSheet></>
    }
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('announces and auto-dismisses a toast', () => {
    vi.useFakeTimers()
    function Demo() {
      const { showToast } = useToast()
      return <button onClick={() => showToast({ message: 'Saved', duration: 1000 })}>Notify</button>
    }
    render(<ToastProvider><Demo /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    expect(screen.getByText('Saved')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('chooses the same avatar gradient for the same nickname', () => {
    expect(avatarGradient('Luna')).toBe(avatarGradient('Luna'))
    render(<Avatar name="Luna" />)
    expect(screen.getByText('L').parentElement).toHaveClass(avatarGradient('Luna'))
  })
})
