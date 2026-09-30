// @vitest-environment jsdom
import { setTranslator } from '@gnomeola/ui-core/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEphemeralStore } from '../src/renderer/data/ephemeral.ts'
import { EventBridge } from '../src/renderer/data/event-bridge.ts'
import { catalogueTranslator } from '../src/renderer/data/i18n.ts'
import { createQueries } from '../src/renderer/data/queries.ts'
import { type Services, ServicesProvider } from '../src/renderer/data/services.tsx'
import { applyTheme } from '../src/renderer/data/theme.ts'
import { NavigationList, parseButtonLayout, WindowControls } from '../src/renderer/design/primitives/index.ts'
import { createAppRouter } from '../src/renderer/routes/router.tsx'
import type { AppInfo, GnomeolaBridge } from '../src/shared/bridge.ts'
import { fakeDaemon, session, until, upserted } from './helpers.ts'

// Component tests (Testing Library, jsdom): role + name queries, the same way the e2e suite and a
// screen reader find things.

afterEach(() => {
  cleanup()
  setTranslator(null)
})

const appInfo: AppInfo = {
  version: '0.1.0',
  electron: '44.5.1',
  platform: 'linux',
  daemonUrl: 'http://127.0.0.1:8787',
  buttonLayout: 'appmenu:minimize,close',
}

function services(over: Partial<Services> = {}): Services {
  const daemon = fakeDaemon()
  const qc = new QueryClient()
  const store = createEphemeralStore()
  const bridge = { windowControl: vi.fn() } as unknown as GnomeolaBridge
  return {
    bridge,
    api: daemon.client as never,
    queries: createQueries(daemon.client as never),
    queryClient: qc,
    store,
    events: new EventBridge(daemon.client, qc, store, { driveOnline: false }),
    appInfo,
    ...over,
  }
}

describe('NavigationList', () => {
  function Harness() {
    const [sel, setSel] = useState<string | null>(null)
    return (
      <NavigationList
        label="Sessions"
        selected={sel}
        onSelect={setSel}
        items={[
          { id: 'a', textValue: 'Standup', content: 'Standup' },
          { id: 'b', textValue: 'Design review', content: 'Design review' },
        ]}
      />
    )
  }
  it('is a named listbox of named options with single, route-driven selection', () => {
    render(<Harness />)
    const list = screen.getByRole('listbox', { name: 'Sessions' })
    const options = within(list).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Standup', 'Design review'])
    fireEvent.click(screen.getByRole('option', { name: 'Design review' }))
    expect(screen.getByRole('option', { name: 'Design review' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('option', { name: 'Standup' }).getAttribute('aria-selected')).toBe('false')
  })
})

describe('window controls', () => {
  it('parses the GNOME button layout', () => {
    expect(parseButtonLayout('appmenu:minimize,maximize,close')).toEqual({
      start: [],
      end: ['minimize', 'maximize', 'close'],
    })
    expect(parseButtonLayout('close,minimize:appmenu')).toEqual({ start: ['close', 'minimize'], end: [] })
    expect(parseButtonLayout('icon:spacer,close')).toEqual({ start: [], end: ['close'] })
    expect(parseButtonLayout('')).toEqual({ start: [], end: [] })
  })
  it('renders named buttons on the configured side and sends the control to main', () => {
    const s = services()
    render(
      <ServicesProvider services={s}>
        <WindowControls side="end" />
      </ServicesProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(s.bridge.windowControl).toHaveBeenCalledWith('close')
    expect(screen.getByRole('button', { name: 'Minimize' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Maximize' })).toBeNull()
  })
  it('draws nothing on macOS (native traffic lights)', () => {
    const { container } = render(
      <ServicesProvider services={services({ appInfo: { ...appInfo, platform: 'darwin' } })}>
        <WindowControls side="end" />
      </ServicesProvider>,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('i18n and theme', () => {
  it('translates through a JSON catalogue, falling back to the source string', () => {
    const t = catalogueTranslator({
      locale: 'de',
      messages: { Sessions: 'Sitzungen', '{n} session': ['{n} Sitzung', '{n} Sitzungen'] },
    })
    expect(t.gettext('Sessions')).toBe('Sitzungen')
    expect(t.gettext('Untranslated')).toBe('Untranslated')
    expect(t.ngettext('{n} session', '{n} sessions', 1)).toBe('{n} Sitzung')
    expect(t.ngettext('{n} session', '{n} sessions', 3)).toBe('{n} Sitzungen')
    expect(t.ngettext('a', 'b', 2)).toBe('b')
  })
  it('applies scheme and contrast from main; the portal accent is ignored (the brand accent is fixed)', () => {
    applyTheme({ scheme: 'dark', contrast: 'high', accent: '#e01b24' })
    const root = document.documentElement
    expect(root.dataset).toMatchObject({ theme: 'dark', scheme: 'dark', contrast: 'high' })
    expect(root.style.getPropertyValue('--accent-bg-color')).toBe('')
    applyTheme({ scheme: 'light', contrast: 'normal', accent: null })
    expect(root.dataset).toMatchObject({ theme: 'light', contrast: 'normal' })
  })
})

describe('the first screen', () => {
  it('shows connecting, then the session list; a new session appears live; selecting routes to it', async () => {
    const daemon = fakeDaemon({ sessions: [session('ses_a', { title: 'Standup' })], lastSeq: 1 })
    const qc = new QueryClient()
    const store = createEphemeralStore()
    daemon.state.fail = new Error('not yet')
    const s = services({
      api: daemon.client as never,
      queries: createQueries(daemon.client as never),
      queryClient: qc,
      store,
      events: new EventBridge(daemon.client, qc, store, { driveOnline: false, retryMs: 20 }),
    })
    const router = createAppRouter(s, createMemoryHistory({ initialEntries: ['/'] }))
    s.events.start()
    render(
      <ServicesProvider services={s}>
        <QueryClientProvider client={qc}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ServicesProvider>,
    )
    await screen.findByRole('heading', { name: 'Can’t Reach gnomeola' })
    daemon.state.fail = null
    const list = await screen.findByRole('listbox', { name: 'Sessions' })
    expect(
      within(list)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([expect.stringContaining('Standup')])
    screen.getByRole('heading', { name: 'No Session Selected' })

    act(() =>
      daemon.emit(
        upserted(2, session('ses_b', { title: 'Design review', createdAt: '2026-09-29T00:00:00.000Z' })),
      ),
    )
    await until(() => within(list).queryAllByRole('option').length === 2)
    expect(within(list).getAllByRole('option')[0]!.textContent).toContain('Design review')

    fireEvent.click(within(list).getByRole('option', { name: /Design review/ }))
    await until(() => router.state.location.pathname === '/sessions/ses_b')
    await screen.findByRole('heading', { level: 1, name: 'Design review' })
    s.events.stop()
  })
})
