import { setupWorker } from 'msw/browser'
import { getMockScenario, handlers, setMockScenario } from './handlers.js'

export const worker = setupWorker(...handlers)

export function startMockWorker() {
  if (typeof window === 'undefined') {
    return
  }

  window.__mock = {
    get: getMockScenario,
    set: setMockScenario,
  }

  worker.start({ onUnhandledRequest: 'bypass' })
}
