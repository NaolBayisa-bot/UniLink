import React from 'react'
import TokensPage from './dev/TokensPage'
import GalleryPage from './dev/GalleryPage'
import TelegramPage from './dev/TelegramPage'
import ApiPage from './dev/ApiPage'

export default function App() {
  if (import.meta.env.DEV && window.location.pathname === '/dev/tokens') {
    return <TokensPage />
  }
  if (import.meta.env.DEV && window.location.pathname === '/dev/gallery') {
    return <GalleryPage />
  }
  if (import.meta.env.DEV && window.location.pathname === '/dev/telegram') {
    return <TelegramPage />
  }
  if (import.meta.env.DEV && window.location.pathname === '/dev/api') {
    return <ApiPage />
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-on-background">
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest px-8 py-6 shadow-card">
        <h1 className="text-3xl font-bold tracking-tight">Unilink</h1>
      </div>
    </main>
  )
}
