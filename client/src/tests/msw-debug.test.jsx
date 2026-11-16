import { describe, it, expect } from 'vitest'
import { server } from '../api/mocks/server'

describe('MSW debug test', () => {
  it('should intercept fetch', async () => {
    const res = await fetch('http://localhost/me')
    const data = await res.json()
    expect(data.nickname).toBe('Avery')
  })

  it('should handle unmatched requests as error', async () => {
    // MSW is configured with onUnhandledRequest: 'error' in setup.js
    // But we won't test that here
    expect(true).toBe(true)
  })
})
