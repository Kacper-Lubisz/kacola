import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  type AccessibleNode,
  type AppHandle,
  flatten,
  formatTree,
  type HeadlessDisplay,
  markedPids,
  pngInfo,
  startHeadlessDisplay,
} from '../index.ts'
import { makeSession, type StubDaemon, startStubDaemon } from './stub-daemon.ts'

// V-9a, first slice: the real gnomeola window (GTKX, built bundle) in a headless GNOME Shell,
// driven and asserted entirely through the accessibility tree.
//
// These live in testkit rather than packages/ui/test because the boundary rule forbids the UI
// package from importing @gnomeola/testkit (see the report / docs/gtkx.md).

const UI_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'ui')
const BUNDLE = join(UI_DIR, 'dist', 'bundle.mjs')
const ARTIFACTS = join(import.meta.dirname, '__artifacts__')
const APP = 'gnomeola'

beforeAll(() => {
  // Always rebuild: an e2e run against a stale bundle proves nothing about the source.
  // NODE_ENV matters: vitest sets it to "test", and a GTKX build under anything but "production"
  // emits the development JSX runtime (jsxDEV) against React's production build — a crash at startup.
  execFileSync('pnpm', ['run', 'build'], {
    cwd: UI_DIR,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production' },
  })
  expect(existsSync(BUNDLE)).toBe(true)
}, 180_000)

/** The tail of an app's log, with minified-bundle lines cut short so failures stay readable. */
const logTail = (app: AppHandle) =>
  app
    .log()
    .slice(-6000)
    .split('\n')
    .map((l) => (l.length > 300 ? `${l.slice(0, 300)}…` : l))
    .join('\n')

function launch(d: HeadlessDisplay, env: Record<string, string>): AppHandle {
  return d.launchApp({ command: process.execPath, args: [BUNDLE], cwd: UI_DIR, env })
}

async function sessionRows(d: HeadlessDisplay): Promise<AccessibleNode[]> {
  const list = await d.findOne({ app: APP, role: 'list', name: 'Sessions' })
  const tree = await d.describe(list, true)
  return (tree.children ?? []).filter((c) => c.role === 'list item')
}

const rowNames = async (d: HeadlessDisplay) => (await sessionRows(d)).map((r) => r.name)

/** A11y audit: every interactive widget on screen must have a name, or AT-SPI tests cannot reach it. */
async function unnamedInteractive(d: HeadlessDisplay): Promise<string[]> {
  const interactive = new Set([
    'button',
    'toggle button',
    'check box',
    'entry',
    'text',
    'list item',
    'list',
    'combo box',
    'slider',
    'spin button',
    'switch',
    'level bar',
  ])
  const all = flatten(await d.accessibleTree({ app: APP }))
  return all
    .filter((n) => interactive.has(n.role) && n.states.includes('showing') && n.name.trim() === '')
    .map((n) => `${n.role} (ref ${n.ref})`)
}

async function expectAppAlive(app: AppHandle) {
  if (app.hasExited()) throw new Error(`gnomeola exited:\n${logTail(app)}`)
}

describe('gnomeola window, demo mode', () => {
  let d: HeadlessDisplay
  let app: AppHandle
  let id: string

  beforeAll(async () => {
    d = await startHeadlessDisplay({ size: '1280x800' })
    id = d.env.GNOMEOLA_HEADLESS_ID!
    app = launch(d, {
      GNOMEOLA_UI_DEMO: '1',
      GNOMEOLA_UI_DEMO_INTERVAL_MS: '1500',
      GNOMEOLA_UI_DEMO_MAX_SESSIONS: '9',
    })
    await d.findOne({ app: APP, role: 'frame', name: 'gnomeola' }, 30_000).catch((e) => {
      throw new Error(`${e.message}\napp log:\n${logTail(app)}`)
    })
  })

  afterAll(async () => {
    if (!d) return
    await d.close()
    expect(markedPids(id)).toEqual([])
  })

  it('shows an application window with a split view: labelled sidebar list beside a content page', async () => {
    await expectAppAlive(app)
    const sidebar = await d.findOne({ app: APP, role: 'grouping', name: 'Sessions', states: ['showing'] })
    const content = await d.findOne({ app: APP, role: 'grouping', name: 'gnomeola', states: ['showing'] })
    // side by side, not collapsed: the content page starts where the sidebar ends
    const s = await d.extents(sidebar)
    const c = await d.extents(content)
    expect(s.width).toBeGreaterThan(200)
    expect(c.x).toBeGreaterThanOrEqual(s.x + s.width - 1)
    expect(c.width).toBeGreaterThan(s.width)

    // The window frame appears before the session list is loaded (health → listSessions → subscribe), so
    // wait for the rows rather than reading the tree once (a race seen once in a full release-gate run).
    const rows = await d.waitFor(
      async () => {
        const r = await sessionRows(d)
        return r.length >= 3 ? r : null
      },
      15_000,
      'at least three session rows',
    )
    const names = rows.map((r) => r.name)
    expect(names).toEqual(
      expect.arrayContaining(['1:1 with Sam', 'Design review: onboarding flow', 'Weekly product sync']),
    )
    for (const r of rows) expect(r.name).not.toBe('')

    await d.findOne({ app: APP, role: 'entry', name: 'Search sessions' })
    const record = await d.find({ app: APP, role: 'button', states: ['showing'] })
    expect(record.map((b) => b.name)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^(Record|Stop)$/)]),
    )
    await d.findOne({ app: APP, role: 'label', name: 'No Session Selected' })
    expect(await unnamedInteractive(d)).toEqual([])
  })

  it('grows the list live as sessions arrive', async () => {
    const before = await rowNames(d)
    const grown = await d.waitFor(
      async () => {
        const now = await rowNames(d)
        return now.length > before.length ? now : null
      },
      15_000,
      'the session list to grow',
    )
    // the newcomer is on top, and it is one of the demo's live recordings
    expect(grown[0]).toMatch(/ #\d+$/)
    expect(before).not.toContain(grown[0])
  })

  it('selecting a row replaces the detail pane', async () => {
    const row = await d.findOne({ app: APP, role: 'list item', name: 'Design review: onboarding flow' })
    await d.click(row)
    await d.findOne({ app: APP, role: 'heading', name: 'Design review: onboarding flow' })
    await d.findOne({
      app: APP,
      role: 'grouping',
      name: 'Design review: onboarding flow',
      states: ['showing'],
    })
    expect((await d.describe(row)).states).toContain('selected')
    expect(await d.find({ app: APP, role: 'label', name: 'No Session Selected' })).toEqual([])
    await d.findOne({ app: APP, role: 'label', name: 'Finished · 30:00' })

    const other = await d.findOne({ app: APP, role: 'list item', name: '1:1 with Sam' })
    await d.click(other)
    await d.findOne({ app: APP, role: 'heading', name: '1:1 with Sam' })
    await d.waitFor(
      async () =>
        (await d.find({ app: APP, role: 'heading', name: 'Design review: onboarding flow' })).length === 0,
      5000,
      'the previous heading to go away',
    )
    await d.findOne({ app: APP, role: 'label', name: 'Finished · 25:00' })
    // the selection survives the list growing above it
    await d.waitFor(async () => (await d.describe(other)).states.includes('selected'), 5000, 'selection kept')
    expect(await unnamedInteractive(d)).toEqual([])
  })

  it('filters the list from real keyboard input in the search entry', async () => {
    const entry = await d.findOne({ app: APP, role: 'entry', name: 'Search sessions' })
    await d.focus(entry)
    await d.typeText('weekly')
    await d.waitFor(
      async () => JSON.stringify(await rowNames(d)) === JSON.stringify(['Weekly product sync']),
      5000,
      'only the weekly sync to match',
    )
    await d.typeText('zzz')
    await d.findOne({ app: APP, role: 'label', name: 'No Matching Sessions' })
    await d.pressKeys('Control_L', 'a')
    await d.pressKeys('BackSpace')
    await d.waitFor(async () => (await rowNames(d)).length >= 5, 5000, 'the full list to come back')
  })

  it('records and stops from the header button', async () => {
    // the demo goes quiet once it reaches its cap, which leaves the button on Record
    const record = await d.findOne({ app: APP, role: 'button', name: 'Record', states: ['showing'] }, 30_000)
    const countBefore = (await rowNames(d)).length
    await d.click(record)
    await d.findOne({ app: APP, role: 'heading', name: 'New recording' })
    const rows = await sessionRows(d)
    expect(rows.length).toBe(countBefore + 1)
    expect(rows[0]!.name).toBe('New recording')
    expect(rows[0]!.states).toContain('selected')
    // live levels for the recording session, each meter with its own name
    const mic = await d.findOne({ app: APP, role: 'level bar', name: 'Microphone level' })
    await d.findOne({ app: APP, role: 'level bar', name: 'System audio level' })
    // the meters move: ephemeral audio.level events reach the widget
    const seen = new Set<number>()
    await d.waitFor(
      async () => {
        const v = (await d.describe(mic)).value
        if (typeof v === 'number') seen.add(Math.round(v * 1000))
        return seen.size >= 3
      },
      8000,
      'the microphone meter to change',
    )
    for (const v of seen) expect(v).toBeGreaterThanOrEqual(0)

    await d.screenshot(join(ARTIFACTS, 'ui-demo-recording.png'))
    const stop = await d.findOne({ app: APP, role: 'button', name: 'Stop', states: ['showing'] })
    await d.click(stop)
    await d.findOne({ app: APP, role: 'button', name: 'Record', states: ['showing'] })
    // the detail pane now reads Finished with a short duration (a second or two of recording)
    await d.waitFor(
      async () => (await d.find({ app: APP, role: 'label' })).some((l) => /^Finished · 0:0\d$/.test(l.name)),
      5000,
      'the detail pane to show the finished recording',
    )
  })

  it('captures a screenshot of the running window', async () => {
    const screen = await d.screenshot(join(ARTIFACTS, 'ui-demo-screen.png'))
    expect(pngInfo(screen)).toMatchObject({ width: 1280, height: 800 })
    expect(pngInfo(screen).bytes).toBeGreaterThan(50_000)
    const win = await d.screenshot(join(ARTIFACTS, 'ui-demo-window.png'), { kind: 'window' })
    expect(pngInfo(win).width).toBeGreaterThan(800)
  })
})

async function closedPort(): Promise<number> {
  const srv = createServer()
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r))
  const port = (srv.address() as { port: number }).port
  await new Promise<void>((r) => srv.close(() => r()))
  return port
}

describe('gnomeola window, real client against a daemon', () => {
  let d: HeadlessDisplay
  let stub: StubDaemon | null = null

  beforeAll(async () => {
    d = await startHeadlessDisplay({ size: '1280x800' })
  })

  afterAll(async () => {
    await stub?.close()
    await d?.close()
  })

  it('explains an unreachable daemon instead of hanging, then connects on Try Again', async () => {
    const port = await closedPort()
    const app = launch(d, { GNOMEOLA_URL: `http://127.0.0.1:${port}` })
    await d.findOne({ app: APP, role: 'label', name: 'Can’t Reach gnomeola' }, 30_000).catch((e) => {
      throw new Error(`${e.message}\napp log:\n${logTail(app)}`)
    })
    const detail = await d.find({
      app: APP,
      role: 'label',
      nameContains: `not reachable at http://127.0.0.1:${port}`,
    })
    expect(detail).toHaveLength(1)
    await d.screenshot(join(ARTIFACTS, 'ui-unreachable.png'))

    // bring a daemon up on that very port and ask the window to try again
    stub = await startStubDaemon([makeSession('Board meeting')], port)
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Try Again' }))
    await d.waitFor(async () => (await rowNames(d)).includes('Board meeting'), 10_000, 'the stub session')
    expect(await d.find({ app: APP, role: 'label', name: 'Can’t Reach gnomeola' })).toEqual([])
    await app.stop()
    await stub.close()
    stub = null
  })

  it('follows the event stream, resumes from its cursor after a drop, and drives recording', async () => {
    const older = makeSession('Quarterly planning', {
      createdAt: '2026-09-01T09:00:00.000Z',
      startedAt: '2026-09-01T09:00:00.000Z',
    })
    const newer = makeSession('Vendor call', {
      createdAt: '2026-09-20T09:00:00.000Z',
      startedAt: '2026-09-20T09:00:00.000Z',
    })
    stub = await startStubDaemon([older, newer])
    const app = launch(d, { GNOMEOLA_URL: stub.url })
    await d
      .waitFor(
        async () =>
          JSON.stringify(await rowNames(d)) === JSON.stringify(['Vendor call', 'Quarterly planning']),
        30_000,
        'the snapshot rows',
      )
      .catch((e) => {
        throw new Error(`${e.message}\napp log:\n${logTail(app)}`)
      })
    // snapshot at lastSeq 2, then subscribe from it
    expect(stub.requests.slice(0, 2)).toEqual(['GET /health', 'GET /sessions?includePrivate=true&limit=500'])
    await d.waitFor(() => stub!.eventConnections.length >= 1, 5000, 'an /events connection')
    expect(stub.eventConnections[0]).toBe(2)

    // a pushed upsert appears live, and an update renames in place
    stub.upsert(makeSession('Pushed over SSE'))
    await d.waitFor(async () => (await rowNames(d))[0] === 'Pushed over SSE', 5000, 'the pushed row')
    stub.upsert({ ...newer, title: 'Vendor call (renamed)' })
    await d.waitFor(async () => (await rowNames(d)).includes('Vendor call (renamed)'), 5000, 'the rename')
    expect(await rowNames(d)).not.toContain('Vendor call')

    // drop the stream and keep it down: the banner says so, and nothing is lost meanwhile
    stub.refuseEvents = true
    expect(stub.dropStreams()).toBe(1)
    await d.findOne({ app: APP, role: 'grouping', nameContains: 'Reconnecting', states: ['showing'] }, 10_000)
    const cursorBeforeMiss = 4
    stub.upsert(makeSession('Missed while offline'))
    stub.refuseEvents = false
    await d.waitFor(
      async () => (await rowNames(d)).includes('Missed while offline'),
      10_000,
      'the missed row',
    )
    expect(stub.eventConnections.at(-1)).toBe(cursorBeforeMiss)
    await d.waitFor(
      async () =>
        (await d.find({ app: APP, role: 'grouping', nameContains: 'Reconnecting', states: ['showing'] }))
          .length === 0,
      5000,
      'the banner to hide',
    )

    // Record goes through the real API: create + start, and the new session is selected
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Record', states: ['showing'] }))
    await d.findOne({ app: APP, role: 'heading', name: 'New recording' })
    expect(stub.requests.filter((r) => r.startsWith('POST'))).toEqual([
      'POST /sessions',
      expect.stringMatching(/^POST \/sessions\/ses_[^/]+\/start$/),
    ])
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Stop', states: ['showing'] }))
    await d.findOne({ app: APP, role: 'button', name: 'Record', states: ['showing'] })
    expect(stub.requests.filter((r) => r.startsWith('POST')).at(-1)).toMatch(/\/stop$/)
    await d.screenshot(join(ARTIFACTS, 'ui-daemon.png'))
    if (app.hasExited()) throw new Error(logTail(app))
    const unnamed = await unnamedInteractive(d)
    if (unnamed.length) console.log(formatTree(await d.accessibleTree({ app: APP })))
    expect(unnamed).toEqual([])
  })
})

describe('gtkx dev inside the pnpm workspace', () => {
  let d: HeadlessDisplay

  afterAll(async () => {
    await d?.close()
  })

  it('starts the dev server (with the generated-store resolve hook) and opens the window', async () => {
    d = await startHeadlessDisplay({ size: '1280x800' })
    const dev = d.launchApp({
      command: 'pnpm',
      args: ['run', 'dev'],
      cwd: UI_DIR,
      env: { GNOMEOLA_UI_DEMO: '1' },
    })
    await d.findOne({ app: APP, role: 'list', name: 'Sessions' }, 90_000).catch((e) => {
      throw new Error(`${e.message}\ndev log:\n${logTail(dev)}`)
    })
    expect((await rowNames(d)).length).toBeGreaterThanOrEqual(3)
    expect(dev.log()).toContain('HMR enabled')
  })
})

describe('gnomeola window on a narrow screen', () => {
  let d: HeadlessDisplay

  afterAll(async () => {
    await d?.close()
  })

  it('collapses the split view and navigates sidebar → detail → back', async () => {
    // a monitor narrower than the 560sp breakpoint: the window is clamped to it and collapses
    d = await startHeadlessDisplay({ size: '480x800' })
    const app = launch(d, { GNOMEOLA_UI_DEMO: '1', GNOMEOLA_UI_DEMO_INTERVAL_MS: '60000' })
    const sidebar = await d
      .findOne({ app: APP, role: 'grouping', name: 'Sessions', states: ['showing'] }, 30_000)
      .catch((e) => {
        throw new Error(`${e.message}\napp log:\n${logTail(app)}`)
      })
    // collapsed: only one page is on screen
    expect(
      await d.find({ app: APP, role: 'label', name: 'No Session Selected', states: ['showing'] }),
    ).toEqual([])
    const s = await d.extents(sidebar)
    expect(s.width).toBeLessThanOrEqual(480)

    await d.click(await d.findOne({ app: APP, role: 'list item', name: '1:1 with Sam' }))
    await d.findOne({ app: APP, role: 'heading', name: '1:1 with Sam', states: ['showing'] })
    await d.waitFor(
      async () =>
        (await d.find({ app: APP, role: 'grouping', name: 'Sessions', states: ['showing'] })).length === 0,
      5000,
      'the sidebar to slide away',
    )
    await d.screenshot(join(ARTIFACTS, 'ui-narrow-detail.png'))
    // the header bar grew a back button; it returns to the list
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Back', states: ['showing'] }))
    await d.findOne({ app: APP, role: 'grouping', name: 'Sessions', states: ['showing'] })
    await d.screenshot(join(ARTIFACTS, 'ui-narrow-list.png'))
  })
})

describe('widget gallery (the patterns docs/gtkx.md recommends)', () => {
  let d: HeadlessDisplay
  let app: AppHandle
  const state = async () =>
    (await d.describe(await d.findOne({ app: APP, role: 'label', name: 'Gallery state' }))).text ?? ''
  const stateHas = (s: string) =>
    d.waitFor(async () => (await state()).includes(s), 5000, `gallery state "${s}"`)

  beforeAll(async () => {
    d = await startHeadlessDisplay({ size: '1280x800' })
    app = launch(d, { GNOMEOLA_UI_GALLERY: '1' })
    await d.findOne({ app: APP, role: 'frame', name: 'Widget gallery' }, 30_000).catch((e) => {
      throw new Error(`${e.message}\napp log:\n${logTail(app)}`)
    })
  })

  afterAll(async () => {
    await d?.close()
  })

  it('renders text widgets with their content', async () => {
    const tv = await d.findOne({ app: APP, role: 'text', name: 'Transcript' })
    expect(tv.text).toBe('me: shall we start?\nthem: yes, recording now.')
    const level = await d.findOne({ app: APP, role: 'level bar', name: 'Input level' })
    expect(level.value).toBeCloseTo(0.6)
    expect(await state()).toContain('auto-record: off')
  })

  it('switch row, plain switch, entry and entry row feed React state', async () => {
    await d.click(await d.findOne({ app: APP, role: 'switch', name: 'Auto-record meetings' }))
    await stateHas('auto-record: on')
    await d.click(await d.findOne({ app: APP, role: 'switch', name: 'Private' }))
    await stateHas('private: on')

    const speaker = await d.findOne({ app: APP, role: 'text', name: 'Speaker name' })
    await d.focus(speaker)
    await d.typeText('Sam')
    await stateHas('speaker: Sam')

    // combo row, by keyboard: open the popover, move down one, choose
    const combo = await d.findOne({ app: APP, role: 'combo box', name: 'Live model' })
    await d.focus(combo)
    await d.pressKeys('Return')
    await d.findOne({ app: APP, role: 'label', name: 'base.en', states: ['showing'] })
    await d.pressKeys('Down')
    await d.pressKeys('Return')
    await stateHas('model: base.en')

    const url = await d.findOne({ app: APP, role: 'text', name: 'Daemon URL' })
    await d.focus(url)
    await d.pressKeys('Control_L', 'a')
    await d.typeText('http://10.0.0.5:8787\n')
    await stateHas('url: http://10.0.0.5:8787')
  })

  it('toasts show plain text (no markup parsing)', async () => {
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Show Toast' }))
    await d.findOne({ app: APP, role: 'label', name: 'Saved “Weekly sync & retro”' })
  })

  it('alert dialog: responses arrive in onResponse and unmounting closes it', async () => {
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Delete…' }))
    await d.findOne({ app: APP, role: 'label', name: 'Delete Session?' })
    await d.screenshot(join(ARTIFACTS, 'gallery-alert.png'))
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Delete', states: ['showing'] }))
    await stateHas('last action: deleted')
    await d.waitFor(
      async () => (await d.find({ app: APP, role: 'label', name: 'Delete Session?' })).length === 0,
      5000,
      'the alert to close',
    )
  })

  it('preferences and about dialogs open, work, and close with Escape', async () => {
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Preferences' }))
    const toggle = await d.findOne({ app: APP, role: 'switch', name: 'Record system audio' })
    await d.click(toggle)
    await stateHas('last action: system audio off')
    await d.screenshot(join(ARTIFACTS, 'gallery-preferences.png'))
    await d.pressKeys('Escape')
    await d.waitFor(
      async () => (await d.find({ app: APP, role: 'switch', name: 'Record system audio' })).length === 0,
      5000,
      'preferences to close',
    )
    // onClosed reset React's state: the same button opens it again
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Preferences' }))
    await d.findOne({ app: APP, role: 'switch', name: 'Record system audio' })
    await d.pressKeys('Escape')
    await d.waitFor(
      async () => (await d.find({ app: APP, role: 'switch', name: 'Record system audio' })).length === 0,
      5000,
      'preferences to close again',
    )

    await d.click(await d.findOne({ app: APP, role: 'button', name: 'About gnomeola' }))
    await d.findOne({ app: APP, role: 'dialog', name: 'About' })
    await d.findOne({ app: APP, role: 'label', name: 'The gnomeola contributors' })
    await d.screenshot(join(ARTIFACTS, 'gallery-about.png'))
    await d.pressKeys('Escape')
    await d.waitFor(
      async () => (await d.find({ app: APP, role: 'dialog', name: 'About' })).length === 0,
      5000,
      'about to close',
    )
    await d.screenshot(join(ARTIFACTS, 'gallery.png'))
    if (app.hasExited()) throw new Error(logTail(app))
  })
})
