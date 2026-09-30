import { useState } from 'react'
import { ICON_PATHS, type IconName } from '../design/icon-paths.ts'
import {
  Banner,
  Button,
  HeaderBar,
  Icon,
  NavigationList,
  Spinner,
  StatusPage,
} from '../design/primitives/index.ts'

// #/gallery — every primitive in every state, on the real tokens. Design in code: run
// `pnpm --filter @gnomeola/desktop dev`, open the gallery, edit tokens.css or a primitive, HMR shows it.
// A new primitive is not done until it is here (the e2e screenshots this page in light and dark).

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="m-0 text-[13pt] font-bold">{title}</h2>
      <div className="flex flex-wrap items-center gap-3 rounded-card bg-card p-4 shadow-[0_0_0_1px_var(--card-shade-color)]">
        {children}
      </div>
    </section>
  )
}

export function Gallery() {
  const [selected, setSelected] = useState<string | null>('b')
  return (
    <div className="flex h-full flex-col">
      <HeaderBar title="Gallery" />
      <main className="min-h-0 flex-1 overflow-auto bg-window">
        <div className="mx-auto flex max-w-[900px] flex-col gap-8 p-6">
          <Section title="Buttons">
            <Button>Default</Button>
            <Button variant="flat">Flat</Button>
            <Button variant="suggested">Suggested</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="suggested" pill>
              Pill
            </Button>
            <Button icon="search" aria-label="Search" />
            <Button circular icon="record" aria-label="Record" variant="destructive" />
            <Button isDisabled>Disabled</Button>
          </Section>
          <Section title="Icons">
            {(Object.keys(ICON_PATHS) as IconName[]).map((n) => (
              <span key={n} className="flex items-center gap-2 text-dim">
                <Icon name={n} /> <code className="text-[9pt]">{n}</code>
              </span>
            ))}
          </Section>
          <Section title="Banner">
            <div className="w-full">
              <Banner title="Lost the connection to the daemon. Reconnecting…" />
            </div>
            <div className="w-full">
              <Banner
                tone="warning"
                title="A speech model is not downloaded yet"
                action={<Button>Set Up</Button>}
              />
            </div>
          </Section>
          <Section title="Navigation list">
            <div className="w-[280px] rounded-card bg-sidebar">
              <NavigationList
                label="Example list"
                selected={selected}
                onSelect={setSelected}
                items={['a', 'b', 'c'].map((id) => ({
                  id,
                  textValue: `Row ${id}`,
                  content: (
                    <div className="flex flex-col">
                      <span>Row {id.toUpperCase()}</span>
                      <span className="text-[9pt] text-dim">5 min ago · Finished · 30:00</span>
                    </div>
                  ),
                }))}
              />
            </div>
          </Section>
          <Section title="Spinner">
            <Spinner label="Loading" />
          </Section>
          <Section title="Status page">
            <div className="h-[360px] w-full">
              <StatusPage
                icon="record"
                title="No Session Selected"
                description="Pick a session in the sidebar."
              />
            </div>
          </Section>
        </div>
      </main>
    </div>
  )
}
