import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyTheme } from '../lib/theme'

describe('theme tokens', () => {
  it('applyTheme sets the document theme attribute', () => {
    applyTheme('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    applyTheme('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('defines every color token in both theme sets', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')
    const tokenNames = [...css.matchAll(/--color-([\w-]+):/g)].map((match) => match[1])
    const uniqueNames = [...new Set(tokenNames)]
    const light = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    const dark = css.match(/\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

    expect(uniqueNames.length).toBeGreaterThan(0)
    for (const name of uniqueNames) {
      expect(light).toMatch(new RegExp(`--color-${name}:`))
      expect(dark).toMatch(new RegExp(`--color-${name}:`))
    }
  })
})
