import { useTheme } from '../lib/theme'
import { colorTokens, radiusTokens, shadowTokens, typeTokens } from '../lib/tokens'

function TokenSection({ title, children }) {
  return <section className="space-y-space-sm">
    <h2 className="text-headline-sm">{title}</h2>
    {children}
  </section>
}

export default function TokensPage() {
  const { theme, toggleTheme } = useTheme()

  return <main className="min-h-screen bg-background px-margin py-telegram-header text-on-background">
    <div className="mx-auto max-w-3xl space-y-space-xl pb-16">
      <header className="flex items-center justify-between gap-space-md">
        <div>
          <p className="text-label-md text-on-surface-variant">Unilink design system</p>
          <h1 className="text-display">Tokens</h1>
        </div>
        <button className="rounded-full bg-primary px-space-md py-space-sm text-subhead-sm text-on-primary" onClick={toggleTheme}>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </header>

      <TokenSection title="Colors">
        <div className="grid grid-cols-2 gap-space-sm sm:grid-cols-3">
          {colorTokens.map(([name, hex]) => <div className="rounded-md bg-surface-container-lowest p-space-sm shadow-card" key={name}>
            <div className="mb-space-xs h-12 rounded-sm" style={{ backgroundColor: `rgb(var(--color-${name}))` }} />
            <div className="text-label-md">{name}</div>
            <div className="text-label-sm text-on-surface-variant">{hex}</div>
          </div>)}
        </div>
      </TokenSection>

      <TokenSection title="Type scale">
        <div className="space-y-space-sm rounded-md bg-surface-container-lowest p-space-md shadow-card">
          {typeTokens.map(([name, details]) => <div className="flex items-baseline justify-between gap-space-md border-b border-outline-variant py-space-sm last:border-0" key={name}>
            <span className={`text-${name}`}>{name}</span><span className="text-label-sm text-on-surface-variant">{details}</span>
          </div>)}
        </div>
      </TokenSection>

      <TokenSection title="Radii">
        <div className="grid grid-cols-2 gap-space-sm sm:grid-cols-3">
          {radiusTokens.map(([name, value]) => <div className="flex items-center gap-space-sm rounded-md bg-surface-container-lowest p-space-sm shadow-card" key={name}>
            <span className="h-10 w-10 bg-primary" style={{ borderRadius: value }} /> <span className="text-body-md">{name}: {value}</span>
          </div>)}
        </div>
      </TokenSection>

      <TokenSection title="Shadows">
        <div className="grid gap-space-md sm:grid-cols-2">
          {shadowTokens.map(([name, value]) => <div className="rounded-md bg-surface-container-lowest p-space-lg" style={{ boxShadow: value }} key={name}>
            <span className="text-subhead-sm">{name}</span>
          </div>)}
        </div>
      </TokenSection>
    </div>
  </main>
}
