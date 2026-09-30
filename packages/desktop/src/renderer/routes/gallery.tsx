import { type ReactNode, useState } from 'react'
import {
  AlertDialog,
  Banner,
  Button,
  type ButtonSize,
  type ButtonVariant,
  buttonClass,
  Card,
  Dialog,
  EmptyState,
  HeaderBar,
  ICONS,
  Icon,
  IconButton,
  type IconName,
  Kbd,
  ListRow,
  Menu,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  Meter,
  NavigationList,
  NumberField,
  Popover,
  ProgressBar,
  RecordButton,
  Row,
  RowGroup,
  SearchField,
  SegmentedControl,
  Select,
  Spinner,
  SplitView,
  Switch,
  TabList,
  TabPanel,
  Tabs,
  TextArea,
  TextField,
  useToast,
} from '../design/primitives/index.ts'

// #/gallery — every primitive in every state, on the real tokens. Design in code: run
// `pnpm --filter @gnomeola/desktop dev`, open the gallery, edit brand/tokens or a primitive, HMR shows
// it. A new primitive is not done until it is here: the e2e screenshots this page (light / dark, three
// widths) and runs axe over it in light, dark and high contrast.
//
// Interaction states that need a pointer (hover, pressed) or the keyboard (focus ring) are shown by
// static, aria-hidden copies carrying the same data-* attributes React Aria sets — the real control
// next to them is live.

function Section({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="m-0 type-title2">{title}</h2>
      <Card className={`flex flex-wrap items-center gap-3 p-4 ${wide ? 'flex-col items-stretch' : ''}`}>
        {children}
      </Card>
    </section>
  )
}

const Caption = ({ children }: { children: ReactNode }) => (
  <span className="type-caption text-text-secondary">{children}</span>
)

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'destructive', 'link']
const SIZES: ButtonSize[] = ['sm', 'md', 'lg']

function StaticButton({
  variant,
  state,
}: {
  variant: ButtonVariant
  state: 'hovered' | 'pressed' | 'focus-visible'
}) {
  return (
    <span
      aria-hidden="true"
      {...{ [`data-${state}`]: 'true' }}
      className={buttonClass({ variant, size: 'md' })}
    >
      {state === 'focus-visible' ? 'Focus' : state === 'hovered' ? 'Hover' : 'Pressed'}
    </span>
  )
}

export function Gallery() {
  const toast = useToast()
  const [selected, setSelected] = useState<string | null>('b')
  const [on, setOn] = useState(true)
  const [seg, setSeg] = useState<'all' | 'mine'>('all')
  const [choice, setChoice] = useState<'anthropic' | 'openai' | 'ollama'>('anthropic')
  const [days, setDays] = useState(30)
  const [dialog, setDialog] = useState(false)
  const [alert, setAlert] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const [last, setLast] = useState('none')
  return (
    <div className="flex h-full flex-col">
      <HeaderBar title="Gallery" />
      <main className="min-h-0 flex-1 overflow-auto bg-window">
        <div className="mx-auto flex max-w-[960px] flex-col gap-8 p-4 sm:p-6">
          <h1 className="m-0 type-title1">Primitives</h1>
          <p className="m-0 type-callout text-text-secondary" aria-live="polite">
            Last action: {last}
          </p>

          <Section title="Buttons" wide>
            {SIZES.map((size) => (
              <div key={size} className="flex flex-wrap items-center gap-3">
                <Caption>{size}</Caption>
                {VARIANTS.map((v) => (
                  <Button key={v} variant={v} size={size} onPress={() => setLast(`${v} ${size}`)}>
                    {v[0]!.toUpperCase() + v.slice(1)}
                  </Button>
                ))}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Caption>states</Caption>
              <StaticButton variant="primary" state="hovered" />
              <StaticButton variant="primary" state="pressed" />
              <StaticButton variant="secondary" state="focus-visible" />
              <Button variant="primary" isDisabled>
                Disabled
              </Button>
              <Button variant="secondary" isDisabled>
                Disabled
              </Button>
              <Button variant="destructive" confirm>
                Delete
              </Button>
              <Button variant="secondary" icon="download">
                With icon
              </Button>
              <Button variant="ghost" iconEnd="chevronDown">
                Menu
              </Button>
            </div>
          </Section>

          <Section title="Record button" wide>
            <div className="flex flex-wrap items-center gap-4">
              <RecordButton state="idle" onRecord={() => setLast('record')} />
              <RecordButton state="starting" />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <RecordButton
                state="recording"
                elapsedMs={192_000}
                onStop={() => setLast('stop')}
                onPause={() => setLast('pause')}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <RecordButton
                state="paused"
                elapsedMs={1_512_000}
                onStop={() => {}}
                onResume={() => setLast('resume')}
              />
              <RecordButton state="stopping" elapsedMs={3_725_000} />
            </div>
          </Section>

          <Section title="Icon buttons and tooltips">
            <IconButton icon="search" label="Search" />
            <IconButton icon="menu" label="Main menu" tooltip="Main menu (F10)" />
            <IconButton icon="speakers" label="Speakers" variant="secondary" />
            <IconButton icon="send" label="Send" variant="primary" />
            <IconButton icon="settings" label="Settings" size="sm" />
            <IconButton icon="delete" label="Delete" size="lg" isDisabled />
          </Section>

          <Section title="Inputs" wide>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Session title" placeholder="Untitled meeting" />
              <TextField
                label="Ollama URL"
                type="url"
                defaultValue="http://127.0.0.1:11434"
                description="Where Ollama listens."
              />
              <TextField
                label="API key"
                type="password"
                placeholder="sk-…"
                errorMessage="That key was refused"
                isInvalid
              />
              <TextField label="Disabled" defaultValue="read only" isDisabled />
              <SearchField label="Search sessions" />
              <NumberField
                label="Days to keep audio"
                value={days}
                onChange={setDays}
                minValue={1}
                maxValue={3650}
              />
              <Select
                label="Provider"
                value={choice}
                onChange={(v) => {
                  setChoice(v)
                  setLast(`provider ${v}`)
                }}
                options={[
                  { value: 'anthropic', label: 'Anthropic (Claude)' },
                  { value: 'openai', label: 'OpenAI' },
                  { value: 'ollama', label: 'Ollama (local)' },
                ]}
              />
              <TextArea label="Question" placeholder="Ask about this meeting…" />
            </div>
          </Section>

          <Section title="Switches">
            <Switch isSelected={on} onChange={setOn}>
              Auto-record meetings
            </Switch>
            <Switch defaultSelected={false}>Archive audio</Switch>
            <Switch isSelected isDisabled>
              Disabled on
            </Switch>
          </Section>

          <Section title="Segmented control and tabs" wide>
            <SegmentedControl
              label="Filter"
              value={seg}
              onChange={setSeg}
              segments={[
                { id: 'all', label: 'All' },
                { id: 'mine', label: 'Mine' },
              ]}
            />
            <Tabs defaultSelectedKey="transcript">
              <TabList
                label="Session views"
                tabs={[
                  { id: 'transcript', label: 'Transcript', icon: 'transcript' },
                  { id: 'ask', label: 'Ask', icon: 'ask' },
                  { id: 'notes', label: 'Notes', icon: 'notes' },
                  { id: 'details', label: 'Details', icon: 'details' },
                ]}
              />
              <TabPanel id="transcript" className="pt-3 type-callout text-text-secondary">
                Transcript panel
              </TabPanel>
              <TabPanel id="ask" className="pt-3">
                Ask panel
              </TabPanel>
              <TabPanel id="notes" className="pt-3">
                Notes panel
              </TabPanel>
              <TabPanel id="details" className="pt-3">
                Details panel
              </TabPanel>
            </Tabs>
          </Section>

          <Section title="List rows" wide>
            <div className="max-w-[320px] rounded-lg bg-sidebar py-1">
              <NavigationList
                label="Example sessions"
                selected={selected}
                onSelect={setSelected}
                items={[
                  { id: 'a', title: 'Platform standup', meta: 'Recording · 12:04', live: true },
                  { id: 'b', title: 'Design review: onboarding flow', meta: '5 min ago · Finished · 30:00' },
                  { id: 'c', title: '1:1 with Sam', meta: 'Yesterday · Finished · 25:00' },
                ].map((r) => ({
                  id: r.id,
                  textValue: r.title,
                  content: <ListRow title={r.title} meta={r.meta} live={r.live} liveLabel="Recording" />,
                }))}
              />
            </div>
          </Section>

          <Section title="Settings rows" wide>
            <RowGroup title="Auto-record" description="Start recording on its own.">
              <Row title="When a calendar meeting starts" subtitle="Declined meetings are skipped">
                <Switch aria-label="When a calendar meeting starts" defaultSelected />
              </Row>
              <Row title="Anthropic API key" subtitle="Configured (kept in the keyring, never shown)">
                <Button variant="destructive" size="sm">
                  Remove
                </Button>
              </Row>
            </RowGroup>
          </Section>

          <Section title="Dialogs, popovers, menus">
            <Button onPress={() => setDialog(true)}>Open dialog</Button>
            <Button variant="destructive" onPress={() => setAlert(true)}>
              Delete…
            </Button>
            <Menu label="Example menu" trigger={<Button iconEnd="chevronDown">Open menu</Button>}>
              <MenuGroup title="Session">
                <MenuItem icon="edit" onAction={() => setLast('rename')}>
                  Rename
                </MenuItem>
                <MenuItem icon="copy" shortcut="Ctrl+C" onAction={() => setLast('copy')}>
                  Copy transcript
                </MenuItem>
              </MenuGroup>
              <MenuSeparator />
              <MenuItem icon="delete" destructive onAction={() => setLast('delete')}>
                Delete
              </MenuItem>
            </Menu>
            <Popover label="Filters" trigger={<Button>Popover</Button>}>
              <div className="flex w-56 flex-col gap-3">
                <span className="type-headline">Filters</span>
                <Switch defaultSelected>Include private</Switch>
              </div>
            </Popover>
            <Dialog
              title="Speakers"
              isOpen={dialog}
              onOpenChange={setDialog}
              footer={
                <Button variant="primary" onPress={() => setDialog(false)}>
                  Done
                </Button>
              }
            >
              <p className="m-0 type-body text-text-secondary">A dialog: bg.raised, radius xl, e3, title2.</p>
            </Dialog>
            <AlertDialog
              title="Delete Session?"
              isOpen={alert}
              onOpenChange={setAlert}
              confirmLabel="Delete"
              destructive
              onConfirm={() => setLast('deleted')}
            >
              Its transcript, notes and audio are removed from this computer.
            </AlertDialog>
          </Section>

          <Section title="Toasts and banners" wide>
            <div className="flex flex-wrap gap-3">
              <Button onPress={() => toast('Saved “Weekly sync & retro”')}>Show Toast</Button>
              <Button
                onPress={() =>
                  toast('Could not start recording: no microphone', {
                    tone: 'error',
                    action: { label: 'Retry', onPress: () => setLast('retry') },
                  })
                }
              >
                Show Error Toast
              </Button>
            </div>
            <Banner title="Lost the connection to the daemon. Reconnecting…" />
            <Banner
              tone="warning"
              title="A speech model is not downloaded yet"
              action={<Button size="sm">Set Up</Button>}
            />
            <Banner tone="danger" title="Recording failed: the microphone disappeared" />
            <Banner tone="success" title="All models are ready" />
          </Section>

          <Section title="Progress and levels" wide>
            <div className="flex flex-wrap items-center gap-6">
              <Spinner label="Loading" />
              <ProgressBar label="Whisper small download progress" value={0.42} showValue className="w-60" />
              <div className="flex w-60 flex-col gap-2">
                <Meter label="Microphone level" value={0.35} />
                <Meter label="System audio level" value={0.9} />
              </div>
              <span className="flex items-center gap-2 type-callout text-text-secondary">
                Preferences <Kbd>Ctrl+,</Kbd>
              </span>
            </div>
          </Section>

          <Section title="Empty state" wide>
            <div className="h-[320px]">
              <EmptyState
                headingLevel={2}
                icon="mic"
                title="No sessions yet"
                description="Press Record to capture your first meeting."
              >
                <Button variant="primary">Record</Button>
              </EmptyState>
            </div>
          </Section>

          <Section title="Sidebar layout (collapsed)" wide>
            <div className="h-[220px] max-w-[360px] overflow-hidden rounded-lg border border-border-subtle">
              <SplitView
                landmarks={false}
                collapsed
                sidebarLabel="Demo sidebar"
                showContent={showContent}
                onShowContentChange={setShowContent}
                sidebar={
                  <div className="p-3">
                    <Button onPress={() => setShowContent(true)}>Open content</Button>
                  </div>
                }
                content={
                  <div className="p-3">
                    <Button icon="back" variant="ghost" onPress={() => setShowContent(false)}>
                      Back
                    </Button>
                  </div>
                }
              />
            </div>
          </Section>

          <Section title="Icons">
            {(Object.keys(ICONS) as IconName[]).map((n) => (
              <span key={n} className="flex w-36 items-center gap-2 text-text-secondary">
                <Icon name={n} /> <code className="font-mono text-[12px]">{n}</code>
              </span>
            ))}
          </Section>

          <Section title="Type">
            <div className="flex flex-col gap-2">
              <span className="type-display">Display 32</span>
              <span className="type-title1">Title 1 24</span>
              <span className="type-title2">Title 2 20</span>
              <span className="type-headline">Headline 16</span>
              <span className="type-body">Body 15 — the quick brown fox</span>
              <span className="type-callout">Callout 14</span>
              <span className="type-caption text-text-secondary">Caption 13</span>
              <span className="type-overline text-text-secondary">Overline 12</span>
              <span className="type-mono text-text-secondary">12:04 · mono 13</span>
              <span className="type-empty-state">Editorial italic</span>
            </div>
          </Section>
        </div>
      </main>
    </div>
  )
}
