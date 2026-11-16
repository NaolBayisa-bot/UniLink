import React from 'react'
import { useState } from 'react'
import { useTelegram, useSafeArea } from '../lib/telegram'
import { Button, Card, InfoNote, Pill } from '../components/ui'

export default function TelegramPage() {
  const { isTelegram, initData, colorScheme, themeParams, haptic, openTelegramLink, openLink } = useTelegram()
  const safeArea = useSafeArea()
  const [message, setMessage] = useState('')
  return <main className="min-h-screen bg-background px-margin py-telegram-header text-on-background">
    <div className="mx-auto max-w-2xl space-y-space-lg">
      <header><p className="text-label-md text-muted-text">Integration diagnostics</p><h1 className="text-display">Telegram</h1></header>
      <Card><div className="flex items-center justify-between"><span className="text-subhead-lg">Detected environment</span><Pill status={isTelegram ? 'shared' : 'waiting'}>{isTelegram ? 'Available' : 'Browser only'}</Pill></div></Card>
      <Card><dl className="grid gap-space-sm text-body-md"><div className="flex justify-between gap-space-md"><dt className="text-muted-text">initData</dt><dd className="text-on-surface">{initData ? 'available (hidden)' : 'not available'}</dd></div><div className="flex justify-between gap-space-md"><dt className="text-muted-text">color scheme</dt><dd className="text-on-surface">{colorScheme}</dd></div><div className="flex justify-between gap-space-md"><dt className="text-muted-text">safe area</dt><dd className="text-on-surface">{safeArea.top ?? 0}px / {safeArea.right ?? 0}px / {safeArea.bottom ?? 0}px / {safeArea.left ?? 0}px</dd></div></dl></Card>
      <Card><h2 className="mb-space-sm text-subhead-lg text-on-surface">Theme parameters</h2><pre className="overflow-auto rounded-card bg-surface-container p-space-sm text-label-sm text-on-surface-variant">{JSON.stringify(themeParams, null, 2)}</pre></Card>
      <InfoNote>Theme changes from Telegram are applied live. Sensitive initData is never rendered.</InfoNote>
      <div className="flex flex-wrap gap-space-sm"><Button variant="secondary" onClick={() => { haptic('tap'); setMessage('Tap haptic requested') }}>Tap haptic</Button><Button onClick={() => { haptic('success'); setMessage('Success haptic requested') }}>Success haptic</Button><Button variant="ghost" onClick={() => openTelegramLink('https://t.me/')}>Open Telegram link</Button><Button variant="ghost" onClick={() => openLink('https://telegram.org/')}>Open link</Button></div>
      {message && <p role="status" className="text-body-md text-muted-text">{message}</p>}
    </div>
  </main>
}
