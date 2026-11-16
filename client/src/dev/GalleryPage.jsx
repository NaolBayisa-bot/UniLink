import React, { useState } from 'react'
import { useTheme } from '../lib/theme'
import { BumpingHearts, HalfFinishedHeart, Hourglass, SleepyCloud } from '../components/illustrations'
import {
  Avatar, Banner, BottomSheet, Button, Card, Chip, EmptyState, IconButton, InfoNote,
  ListRow, Pill, ProgressSteps, RevealLadder, Select, SelectableCard, Skeleton, Spinner,
  TextInput, ToastProvider, useToast,
} from '../components/ui'

function Section({ title, children }) {
  return <section className="space-y-space-md"><h2 className="text-headline-sm text-on-surface">{title}</h2>{children}</section>
}

function ToastDemo() {
  const { showToast } = useToast()
  return <Button variant="secondary" onClick={() => showToast({ kind: 'success', title: 'Nice!', message: 'This toast will auto-dismiss.' })}>Show toast</Button>
}

function GalleryContent() {
  const { theme, toggleTheme } = useTheme()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [bannerOpen, setBannerOpen] = useState(true)
  return <main className="min-h-screen bg-background px-margin py-telegram-header text-on-background">
    <div className="mx-auto max-w-3xl space-y-space-xl pb-16">
      <header className="flex items-center justify-between gap-space-md">
        <div><p className="text-label-md text-muted-text">Unilink UI primitives</p><h1 className="text-display">Gallery</h1></div>
        <Button variant="secondary" onClick={toggleTheme}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</Button>
      </header>

      <Section title="Buttons"><div className="flex flex-wrap gap-space-sm">{['primary', 'secondary', 'destructive', 'ghost'].map((variant) => <Button key={variant} variant={variant}>{variant}</Button>)}<Button loading>Loading</Button><Button disabled>Disabled</Button></div><Button fullWidth className="mt-space-sm">Full width</Button></Section>
      <Section title="Icon buttons"><div className="flex gap-space-sm"><IconButton label="Like">♡</IconButton><IconButton label="Liked" variant="liked">♥</IconButton><IconButton label="Disabled" variant="disabled">♡</IconButton></div></Section>
      <Section title="Inputs"><div className="grid gap-space-md sm:grid-cols-2"><TextInput label="Nickname" placeholder="Luna" helperText="This is shown before a match." maxLength={24} value="" onChange={() => {}} /><TextInput label="Invalid nickname" error="Please choose a nickname." value="No" onChange={() => {}} /><Select label="Department" placeholder="Choose one" options={[{ value: 'cs', label: 'Computer Science' }, { value: 'art', label: 'Fine Art' }]} value="" onChange={() => {}} /></div></Section>
      <Section title="Cards and labels"><div className="grid gap-space-md sm:grid-cols-2"><SelectableCard selected={selected === 'woman'} onClick={() => setSelected('woman')}>♀<span className="text-subhead-lg">Woman</span></SelectableCard><SelectableCard selected={selected === 'man'} onClick={() => setSelected('man')}>♂<span className="text-subhead-lg">Man</span></SelectableCard></div><div className="flex flex-wrap gap-space-sm"><Chip>Primary chip</Chip><Chip tone="blush">Blush chip</Chip><Chip tone="mint">Mint chip</Chip><Chip tone="neutral">Neutral chip</Chip><Pill status="new" /><Pill status="waiting" /><Pill status="turn" /><Pill status="shared" /></div><Card><ListRow leading={<Avatar name="Luna" status="online" />} trailing={<Pill status="new" />}><p className="text-subhead-lg text-on-surface">Luna</p><p className="text-body-md text-muted-text">Campus active</p></ListRow></Card><InfoNote>Keep it cute &amp; friendly. Your safety comes first.</InfoNote></Section>
      <Section title="Avatars"><div className="flex items-end gap-space-md"><Avatar name="Luna" size="sm" /><Avatar name="Luna" size="md" emoji="✨" status="online" /><Avatar name="Luna" size="lg" status="pending" /></div></Section>
      <Section title="Progress and reveal"><ProgressSteps current={2} total={3} /><RevealLadder state="share" /><RevealLadder state="username" compact /></Section>
      <Section title="Feedback"><div className="space-y-space-md"><Banner open={bannerOpen} onClose={() => setBannerOpen(false)}>You are all caught up.</Banner><div className="flex flex-wrap gap-space-sm"><Spinner /><Skeleton variant="list" className="max-w-sm" /><ToastDemo /></div><EmptyState title="No sparks yet" description="There is no one new right now." actionLabel="Go discover" illustration={<SleepyCloud className="h-24 w-36" />} /></div></Section>
      <Section title="Sheet"><Button onClick={() => setSheetOpen(true)}>Open bottom sheet</Button><BottomSheet open={sheetOpen} title="Safety actions" onClose={() => setSheetOpen(false)}><div className="space-y-space-sm"><Button variant="ghost" fullWidth onClick={() => setSheetOpen(false)}>Report</Button><Button variant="destructive" fullWidth onClick={() => setSheetOpen(false)}>Block</Button></div></BottomSheet></Section>
      <Section title="Illustrations"><div className="grid grid-cols-4 items-center gap-space-sm"><BumpingHearts className="h-24 w-full" /><HalfFinishedHeart className="h-24 w-full" /><Hourglass className="h-24 w-full" /><SleepyCloud className="h-24 w-full" /></div></Section>
    </div>
  </main>
}

export default function GalleryPage() {
  return <ToastProvider><GalleryContent /></ToastProvider>
}
