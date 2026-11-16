import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import './styles/index.css'
import App from './App'
import { bootstrapTelegram } from './lib/telegram'
import { startMockWorker } from './api/mocks/browser.js'

bootstrapTelegram()

if (String(import.meta.env.VITE_USE_MOCKS) === 'true') {
  startMockWorker()
}

const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
