import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from '@gnomeola/store'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { makeSession, type StubDaemon, startStubDaemon } from '@gnomeola/testkit/stub-daemon'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { baseline, markOnboarded, setTheme, uiStatePath } from '../src/desktop.ts'
import { SEED, seedMeetings } from '../src/seed.ts'

// Screenshot baselines (light / dark at 360 / 800 / 1280 px) and the axe gate in light, dark and high
// contrast, for home (your day), a meeting's three phases (prep, live, outcome), the primitives gallery,
// Preferences and onboarding. Baselines live in test/__screenshots__/desktop/
// (GNOMEOLA_UPDATE_SCREENSHOTS=1 re-records them after a deliberate design change; a missing one is
// recorded). Data and the renderer's clock are fixed so the pictures are: the protocol stub for home,
// a seeded real daemon for the meeting page, a daemon with no sessions for the dialogs.

const WIDTHS = [360, 800, 1280] as const
const SCHEMES = ['light', 'dark'] as const
const HEIGHT = 760
/** The renderer's fixed "now" (the window in UTC), so day headings and countdowns never move. */
const NOW = '2026-03-12T15:30:00.000Z'
const ENV = { GNOMEOLA_COLOR_SCHEME: 'light', TZ: 'UTC' }

/** Freeze the renderer's clock at NOW and reload, so every view renders against it. */
async function freeze(app: DesktopApp): Promise<void> {
  await app.window.clock.setFixedTime(new Date(NOW))
  await app.window.reload()
  await app.window.waitForLoadState('domcontentloaded')
  await app.window.emulateMedia({ reducedMotion: 'reduce' })
}

let display: HeadlessDisplay
let markerId = ''

beforeAll(async () => {
  buildDesktop()
  display = await startHeadlessDisplay({ size: '1280x800' })
  markerId = display.env.GNOMEOLA_HEADLESS_ID!
  markOnboarded(display)
}, 240_000)

afterAll(async () => {
  if (!display) return
  await display.close()
  expect(markedPids(markerId)).toEqual([])
})

/** axe in light, dark and high contrast (both schemes) on whatever is on screen. */
async function axeAllModes(app: DesktopApp): Promise<string[]> {
  const out: string[] = []
  for (const [scheme, contrast] of [
    ['light', 'normal'],
    ['dark', 'normal'],
    ['light', 'high'],
    ['dark', 'high'],
  ] as const) {
    await setTheme(app, scheme, contrast)
    out.push(...(await app.axe()).map((v) => `[${scheme}/${contrast}] ${v}`))
  }
  await setTheme(app, 'light')
  return out
}

async function matrix(app: DesktopApp, name: string, widths: readonly number[] = WIDTHS): Promise<string[]> {
  const failures: string[] = []
  for (const w of widths) {
    await app.window.setViewportSize({ width: w, height: HEIGHT })
    for (const s of SCHEMES) {
      await setTheme(app, s)
      const f = await baseline(app, `${name}-${s}-${w}`)
      if (f) failures.push(f)
    }
  }
  await setTheme(app, 'light')
  await app.window.setViewportSize({ width: 1280, height: HEIGHT })
  return failures
}

describe('home and gallery (protocol stub, fixed data)', () => {
  let stub: StubDaemon
  let app: DesktopApp

  beforeAll(async () => {
    const at = (d: string, min: number) => ({
      createdAt: d,
      startedAt: d,
      endedAt: d,
      durationMs: min * 60_000,
    })
    stub = await startStubDaemon([
      makeSession('Sprint retro', at('2026-03-04T15:00:00.000Z', 20)),
      makeSession('Platform standup', at('2026-03-12T09:30:00.000Z', 12)),
      makeSession('Design review: onboarding flow', at('2026-03-11T13:00:00.000Z', 30)),
      makeSession('HR 1:1', { ...at('2026-03-10T10:00:00.000Z', 25), private: true }),
    ])
    app = await launchDesktop({ display, env: { GNOMEOLA_URL: stub.url, ...ENV } })
    await freeze(app)
    await app.window.getByRole('button', { name: /^Platform standup, / }).waitFor({ timeout: 20_000 })
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await stub?.close()
  })

  it('home: today and earlier days', async () => {
    await app.window.getByRole('heading', { name: /^Yesterday/ }).waitFor()
    expect(await axeAllModes(app)).toEqual([])
    expect(await matrix(app, 'home')).toEqual([])
    expect(app.problems()).toEqual([])
  })

  it('the primitives gallery', async () => {
    await app.window.evaluate(`location.hash = '#/gallery'`)
    await app.window.getByRole('region', { name: 'Buttons', exact: true }).waitFor()
    expect(await axeAllModes(app)).toEqual([])
    expect(await matrix(app, 'gallery')).toEqual([])
    // the whole page, not just the first screen: one tall capture per scheme
    await app.window.setViewportSize({ width: 1280, height: 4200 })
    for (const s of SCHEMES) {
      await setTheme(app, s)
      expect(await baseline(app, `gallery-full-${s}`)).toBeNull()
    }
    await setTheme(app, 'light')
    await app.window.setViewportSize({ width: 1280, height: HEIGHT })
    // open states: a dialog and a menu are part of the gallery too
    await app.window.getByRole('button', { name: 'Open dialog' }).click()
    await app.window.getByRole('dialog', { name: 'Speakers' }).waitFor()
    expect(await axeAllModes(app)).toEqual([])
    await app.window.keyboard.press('Escape')
    await app.window.getByRole('dialog', { name: 'Speakers' }).waitFor({ state: 'detached' })
    await app.window.getByRole('button', { name: 'Open menu' }).click()
    await app.window.getByRole('menuitem', { name: 'Rename' }).waitFor()
    expect(await axeAllModes(app)).toEqual([])
    await app.window.keyboard.press('Escape')
    expect(app.problems()).toEqual([])
  })
})

describe('a meeting page in each phase (seeded real daemon, fixed clock)', () => {
  let daemon: DaemonHandle
  let app: DesktopApp
  let dir = ''

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'gnomeola-visual-'))
    const dataDir = join(dir, 'data')
    mkdirSync(dataDir, { recursive: true })
    seedMeetings(dataDir)
    const store = Store.open(join(dataDir, 'gnomeola.db'))
    const at = (id: string, iso: string, ms: number) =>
      store.updateSession(id, (s) => ({
        ...s,
        createdAt: iso,
        startedAt: iso,
        endedAt: new Date(Date.parse(iso) + ms).toISOString(),
        durationMs: ms,
      }))
    at(SEED.standup, '2026-03-12T09:30:00.000Z', 12 * 60_000)
    at(SEED.retro, '2026-03-04T15:00:00.000Z', 20 * 60_000)
    at(SEED.long, '2026-03-11T11:00:00.000Z', 90 * 60_000)
    at(SEED.private, '2026-03-10T10:00:00.000Z', 30 * 60_000)
    store.close()
    daemon = await startDaemon({ dataDir })
    markOnboarded(
      display,
      (await daemon.client.call('listModels')).models.map((m) => m.id),
    )
    app = await launchDesktop({ display, env: { GNOMEOLA_URL: daemon.baseUrl, ...ENV } })
    await freeze(app)
    await app.window.getByRole('button', { name: /^Platform standup, / }).waitFor({ timeout: 20_000 })
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await daemon?.stop()
    if (dir) rmSync(dir, { recursive: true, force: true })
    markOnboarded(display)
  })

  it('outcome: the standup, its outcome block and tidied notes', async () => {
    await app.window.getByRole('button', { name: /^Platform standup, / }).click()
    await app.window.getByRole('region', { name: 'Outcome' }).waitFor({ timeout: 10_000 })
    await app.window.getByRole('button', { name: 'Back to my draft' }).waitFor({ timeout: 10_000 })
    await app.window.evaluate('document.activeElement?.blur()')
    expect(await axeAllModes(app)).toEqual([])
    expect(await matrix(app, 'outcome', [800, 1280])).toEqual([])
    expect(app.problems()).toEqual([])
  })

  it('prep: an agenda before its meeting', async () => {
    const v = await daemon.client.call('createAgenda', {
      body: {
        title: 'Roadmap review',
        goals: ['Agree what ships in Q2'],
        items: [
          { text: 'Q1 retro highlights' },
          { text: 'Migration timeline', kind: 'must-cover' },
          { text: 'Hiring plan', kind: 'decision' },
        ],
      },
    })
    await app.window.evaluate(`location.hash = '#/agendas/${v.agenda.id}'`)
    await app.window.getByRole('grid', { name: 'Agenda items' }).waitFor({ timeout: 10_000 })
    await app.window.evaluate('document.activeElement?.blur()')
    expect(await axeAllModes(app)).toEqual([])
    expect(await matrix(app, 'prep', [800, 1280])).toEqual([])
    expect(app.problems()).toEqual([])
  })

  it('live: a recording under way', async () => {
    // titled, so nothing on screen depends on when the suite runs
    const rec = await daemon.client.call('createSession', { body: { title: 'Weekly product sync' } })
    await daemon.client.call('startSession', { params: { id: rec.id } })
    await app.window.evaluate(`location.hash = '#/sessions/${rec.id}'`)
    // the clock is fixed before the recording began: the timer reads the same every run
    await app.window.getByRole('timer', { name: /^Recording, / }).waitFor({ timeout: 15_000 })
    // no calendar meeting behind it: the rail says there is no agenda (adding one needs a meeting)
    await app.window.getByText('No agenda for this meeting.').waitFor()
    await app.window.evaluate('document.activeElement?.blur()')
    expect(await axeAllModes(app)).toEqual([])
    expect(await matrix(app, 'live', [800, 1280])).toEqual([])
    await app.window.getByRole('button', { name: 'Stop', exact: true }).click()
    await app.window.getByRole('region', { name: 'Outcome' }).waitFor({ timeout: 15_000 })
    expect(app.problems()).toEqual([])
  })
})

describe('Preferences and onboarding (real daemon, no sessions)', () => {
  let daemon: DaemonHandle

  beforeAll(async () => {
    daemon = await startDaemon({ entry: join(import.meta.dirname, '..', 'src', 'slow-models-daemon.ts') })
  })

  afterAll(async () => {
    await daemon?.stop()
  })

  it('Preferences, each page', async () => {
    markOnboarded(display)
    const app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: daemon.baseUrl, ...ENV },
    })
    try {
      await freeze(app)
      await app.window.getByRole('searchbox', { name: 'Search or ask' }).waitFor({ timeout: 20_000 })
      await app.window.keyboard.press('Control+,')
      const prefs = app.window.getByRole('dialog', { name: 'Preferences' })
      await prefs.getByRole('region', { name: 'Questions and Answers' }).waitFor()
      await app.window.evaluate('document.activeElement?.blur()')
      expect(await axeAllModes(app)).toEqual([])
      expect(await matrix(app, 'preferences')).toEqual([])
      await prefs.getByRole('tab', { name: 'Storage' }).click()
      await prefs.getByRole('region', { name: 'Recorded Audio' }).waitFor()
      expect(await axeAllModes(app)).toEqual([])
      await prefs.getByRole('tab', { name: 'Integration' }).click()
      await prefs.getByText(/Lets agents like Claude Code|Installed at/).waitFor({ timeout: 20_000 })
      expect(await axeAllModes(app)).toEqual([])
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
    }
  })

  it('onboarding', async () => {
    rmSync(uiStatePath(display), { force: true })
    const app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: daemon.baseUrl, ...ENV },
    })
    try {
      await freeze(app)
      const welcome = app.window.getByRole('dialog', { name: 'Welcome to kacola' })
      await welcome.getByText('Working', { exact: true }).waitFor({ timeout: 20_000 })
      await welcome.getByText(/Lets agents like Claude Code/).waitFor({ timeout: 20_000 })
      await app.window.evaluate('document.activeElement?.blur()')
      expect(await axeAllModes(app)).toEqual([])
      expect(await matrix(app, 'onboarding')).toEqual([])
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
      markOnboarded(display)
    }
  })
})
