import type { ModelInfo, Session, Settings, ShareStatus } from '@gnomeola/protocol'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { createEphemeralStore } from '../src/renderer/data/ephemeral.ts'
import { EventBridge } from '../src/renderer/data/event-bridge.ts'
import { createQueries } from '../src/renderer/data/queries.ts'
import { type Services, ServicesProvider } from '../src/renderer/data/services.tsx'
import { ToastProvider } from '../src/renderer/design/primitives/index.ts'
import { createAppRouter } from '../src/renderer/routes/router.tsx'
import type {
  AppInfo,
  AutostartState,
  CliInstallState,
  GnomeolaBridge,
  UiState,
} from '../src/shared/bridge.ts'
import { fakeDaemon, type Handler } from './helpers.ts'

// The whole window under jsdom: the real router, React Query, EventBridge and screens, over a fake
// daemon (test/helpers.ts) and a fake preload bridge. Role + name queries, like the e2e suite.

export const appInfo: AppInfo = {
  version: '0.1.0',
  electron: '44.5.1',
  platform: 'linux',
  daemonUrl: 'http://127.0.0.1:8787',
  buttonLayout: 'appmenu:minimize,close',
}

export const settings = (over: Partial<Settings> = {}): Settings => ({
  llm: { provider: 'anthropic', model: '', ollamaUrl: 'http://127.0.0.1:11434', apiKeyConfigured: false },
  stt: { liveModel: 'live', finalModel: 'whisper-small.en', finalPass: 'during' },
  capture: { micDevice: 'default', systemDevice: 'default' },
  retention: { audio: 'keep', days: 30, archive: false },
  autoRecord: { calendar: false, micActivity: false },
  speakers: { diarize: true, voiceprints: false },
  ...over,
})

export const model = (id: string, over: Partial<ModelInfo> = {}): ModelInfo =>
  ({
    id,
    title: id,
    role: 'live',
    sizeBytes: 1_000_000,
    state: 'ready',
    progress: null,
    ...over,
  }) as ModelInfo

export function fakeBridge(over: Partial<GnomeolaBridge> = {}) {
  let ui: UiState = { version: 1, onboardingDone: true, skippedMissing: [] }
  let cli: CliInstallState = {
    state: 'not-installed',
    path: '/home/u/.local/bin/gnomeola',
    skillPath: null,
    onPath: true,
    shadowedBy: null,
    needsAdmin: null,
  }
  let autostart: AutostartState = { enabled: false }
  const b = {
    fetchStream: vi.fn(),
    appInfo: vi.fn(async () => appInfo),
    theme: vi.fn(async () => ({ scheme: 'light', contrast: 'normal', accent: null })),
    onTheme: vi.fn(() => () => {}),
    daemonStatus: vi.fn(async () => ({ kind: 'attached' })),
    onDaemonStatus: vi.fn(() => () => {}),
    getUiState: vi.fn(async () => ui),
    setUiState: vi.fn(async (s: UiState) => {
      ui = s
    }),
    notices: vi.fn(
      async () => '| package | version | licence |\n| --- | --- | --- |\n| react | 19.3.0 | MIT |\n',
    ),
    catalogue: vi.fn(async () => ({ locale: 'en', messages: {} })),
    windowControl: vi.fn(),
    openExternal: vi.fn(async () => true),
    copyText: vi.fn(async (text: string) => {
      void text
    }),
    saveTextFile: vi.fn(async () => ({ saved: false as const })),
    cliStatus: vi.fn(async () => cli),
    installCli: vi.fn(async (force: boolean) => {
      void force
      cli = {
        state: 'installed',
        path: '/home/u/.local/bin/gnomeola',
        skillPath: '/home/u/.claude/skills/meeting-context/SKILL.md',
        onPath: true,
        shadowedBy: null,
        needsAdmin: null,
      }
      return cli
    }),
    uninstallCli: vi.fn(async () => cli),
    extensionStatus: vi.fn(async () => ({ state: 'not-installed' as const })),
    installExtension: vi.fn(async () => ({ state: 'unavailable' as const, detail: 'not yet' })),
    getAutostart: vi.fn(async () => autostart),
    setAutostart: vi.fn(async (enabled: boolean) => {
      autostart = { enabled }
      return autostart
    }),
    onDeepLink: vi.fn(() => () => {}),
    takeDeepLink: vi.fn(async (): Promise<string | null> => null),
  }
  Object.assign(b, over)
  return {
    bridge: b as unknown as GnomeolaBridge & typeof b,
    setUi: (s: UiState) => {
      ui = s
    },
    setCli: (s: CliInstallState) => {
      cli = s
    },
  }
}

/** Default daemon answers for the routes the shell touches. */
export function shellHandlers(
  s: { settings?: Settings; models?: ModelInfo[] } = {},
): Record<string, Handler> {
  let current = s.settings ?? settings()
  return {
    getSettings: () => current,
    updateSettings: ({ body }) => {
      const p = body as Partial<Settings>
      current = {
        ...current,
        ...Object.fromEntries(
          Object.entries(p).map(([k, v]) => [
            k,
            { ...(current as Record<string, object>)[k], ...(v as object) },
          ]),
        ),
      } as Settings
      return current
    },
    listModels: () => ({ models: s.models ?? [model('live')] }),
    listDevices: () => ({
      devices: [
        { name: 'fake.mic', description: 'Fake Microphone', kind: 'source', isDefault: true },
        { name: 'fake.sink', description: 'Fake Speakers', kind: 'sink', isDefault: true },
      ],
    }),
    calendarStatus: () => ({ state: 'off', provider: 'eds', detail: null, calendars: [], updatedAt: null }),
    // team sharing: every agenda is unshared unless a test says otherwise
    getAgendaShare: ({ params }) => shareStatus({ agendaId: params!.id! }),
  }
}

/** An agenda's ShareStatus (default: not shared, a host configured). */
export const shareStatus = (over: Partial<ShareStatus> = {}): ShareStatus => ({
  agendaId: 'agd_1',
  shared: false,
  role: null,
  shareId: null,
  link: null,
  host: 'https://share.example',
  ownerName: null,
  shareGoals: false,
  allowInvitees: true,
  members: [],
  recapShared: false,
  state: 'off',
  error: null,
  lastSyncAt: null,
  pending: 0,
  refused: 0,
  comments: [],
  participants: [],
  ...over,
})

export function renderApp(
  o: {
    sessions?: Session[]
    lastSeq?: number
    handlers?: Record<string, Handler>
    bridge?: ReturnType<typeof fakeBridge>
    path?: string
    info?: Partial<AppInfo>
    wrap?: (n: ReactNode) => ReactNode
  } = {},
) {
  const daemon = fakeDaemon({
    sessions: o.sessions ?? [],
    lastSeq: o.lastSeq ?? 1,
    handlers: { ...shellHandlers(), ...o.handlers },
  })
  const fb = o.bridge ?? fakeBridge()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const store = createEphemeralStore()
  const services: Services = {
    bridge: fb.bridge,
    api: daemon.client as never,
    queries: createQueries(daemon.client as never),
    queryClient: qc,
    store,
    events: new EventBridge(daemon.client, qc, store, { driveOnline: false, retryMs: 20 }),
    appInfo: { ...appInfo, ...o.info },
  }
  const router = createAppRouter(services, createMemoryHistory({ initialEntries: [o.path ?? '/'] }))
  services.events.start()
  const tree = (
    <ServicesProvider services={services}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </ServicesProvider>
  )
  const r = render(<>{o.wrap ? o.wrap(tree) : tree}</>)
  return { ...r, daemon, services, router, fb, stop: () => services.events.stop() }
}

/** Services for rendering a single primitive that needs them (HeaderBar, WindowControls). */
export function servicesFor(over: Partial<Services> = {}): Services {
  const daemon = fakeDaemon()
  const qc = new QueryClient()
  const store = createEphemeralStore()
  return {
    bridge: fakeBridge().bridge,
    api: daemon.client as never,
    queries: createQueries(daemon.client as never),
    queryClient: qc,
    store,
    events: new EventBridge(daemon.client, qc, store, { driveOnline: false }),
    appInfo,
    ...over,
  }
}
