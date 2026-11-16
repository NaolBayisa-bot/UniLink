import React, { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { applyTheme } from '../lib/theme'
import { __resetWebAppForTests, __setWebAppForTests, bootstrapTelegram } from '../lib/telegram/bridge'
import { useBackButton, useTelegram } from '../lib/telegram/hooks'

function createFakeWebApp(overrides = {}) {
  const events = new Map()
  const backHandlers = new Set()
  return {
    initData: 'test_init_data=1',
    colorScheme: 'light',
    themeParams: { bg_color: 'test' },
    ready: vi.fn(),
    expand: vi.fn(),
    BackButton: { show: vi.fn(), hide: vi.fn(), onClick: (handler) => backHandlers.add(handler), offClick: (handler) => backHandlers.delete(handler) },
    HapticFeedback: { impactOccurred: vi.fn(), notificationOccurred: vi.fn() },
    onEvent: (event, handler) => { const list = events.get(event) ?? new Set(); list.add(handler); events.set(event, list) },
    offEvent: (event, handler) => events.get(event)?.delete(handler),
    emit: (event) => events.get(event)?.forEach((handler) => handler()),
    backHandlers,
    ...overrides,
  }
}

afterEach(() => {
  __resetWebAppForTests()
  document.documentElement.removeAttribute('data-theme')
})

describe('Telegram integration', () => {
  it('reads initData and exposes haptics without logging or rendering initData', () => {
    const app = createFakeWebApp()
    __setWebAppForTests(app)
    function Demo() {
      const telegram = useTelegram()
      return <><span>{telegram.colorScheme}</span><button onClick={() => telegram.haptic('tap')}>Tap</button></>
    }
    render(<Demo />)
    expect(screen.getByText('light')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tap' }))
    expect(app.HapticFeedback.impactOccurred).toHaveBeenCalledWith('light')
    expect(screen.queryByText(app.initData)).not.toBeInTheDocument()
  })

  it('registers and removes BackButton handlers and always hides on cleanup', () => {
    const app = createFakeWebApp()
    __setWebAppForTests(app)
    const handler = vi.fn()
    function Demo() {
      const [active, setActive] = useState(true)
      useBackButton(active ? handler : null)
      return <button onClick={() => setActive(false)}>Disable</button>
    }
    const { unmount } = render(<Demo />)
    expect(app.BackButton.show).toHaveBeenCalled()
    expect(app.backHandlers.has(handler)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    expect(app.backHandlers.has(handler)).toBe(false)
    expect(app.BackButton.hide).toHaveBeenCalled()
    unmount()
    expect(app.BackButton.hide).toHaveBeenCalled()
  })

  it('does not throw when optional features are absent', () => {
    const app = createFakeWebApp({ initData: undefined, BackButton: undefined, HapticFeedback: undefined, onEvent: undefined, offEvent: undefined })
    __setWebAppForTests(app)
    function Demo() {
      const telegram = useTelegram()
      return <button onClick={() => { telegram.haptic('success'); telegram.openLink('https://example.test') }}>Safe</button>
    }
    expect(() => render(<Demo />)).not.toThrow()
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Safe' }))).not.toThrow()
  })

  it('propagates theme changes and bootstraps once', () => {
    const app = createFakeWebApp()
    __setWebAppForTests(app)
    bootstrapTelegram()
    bootstrapTelegram()
    expect(app.ready).toHaveBeenCalledTimes(1)
    expect(app.expand).toHaveBeenCalledTimes(1)
    function Demo() {
      const telegram = useTelegram()
      return <span>{telegram.colorScheme}</span>
    }
    render(<Demo />)
    app.colorScheme = 'dark'
    act(() => app.emit('themeChanged'))
    expect(screen.getByText('dark')).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })
})
