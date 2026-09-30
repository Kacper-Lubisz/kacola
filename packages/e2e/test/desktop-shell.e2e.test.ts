import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { makeSession, type StubDaemon, startStubDaemon } from '@gnomeola/testkit/stub-daemon'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DESKTOP_ARTIFACTS, markOnboarded } from '../src/desktop.ts'
import { SEED, seedMeetings } from '../src/seed.ts'

// The Electron window's shell against the real daemon and the protocol stub — the port of the GTK
// suites' session-list / record assertions (packages/testkit/src/ui/e2e/gnomeola-ui.e2e.test.ts, the
// session-list and record parts of ui-transcript.e2e.test.ts) and ui-i18n.e2e.test.ts. Same
// behaviours, role + name locators.

const shot = (app: DesktopApp, name: string) => app.screenshot(join(DESKTOP_ARTIFACTS, `${name}.png`))

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

const rows = (app: DesktopApp) => app.window.getByRole('listbox', { name: 'Sessions' }).getByRole('option')
const rowNames = async (app: DesktopApp) =>
  (await rows(app).evaluateAll((els) =>
    els.map((e) => e.querySelector('span span')?.textContent ?? ''),
  )) as string[]

describe('the main window against the real daemon (seeded, fake capture)', () => {
  let daemon: DaemonHandle
  let app: DesktopApp
  let dataDir: string

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-shell-'))
    seedMeetings(dataDir)
    daemon = await startDaemon({ dataDir })
    app = await launchDesktop({ display, env: { GNOMEOLA_URL: daemon.baseUrl } })
    await app.window.getByRole('listbox', { name: 'Sessions' }).waitFor({ timeout: 20_000 })
  }, 120_000)

  afterEach(() => {
    expect(app.problems()).toEqual([])
  })

  afterAll(async () => {
    await app?.close()
    await daemon?.stop()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
  })

  it('shows a split view: the labelled session list beside the content, nothing selected', async () => {
    const sidebar = app.window.getByRole('complementary', { name: 'Sessions' })
    const content = app.window.getByRole('main', { name: 'Session' })
    const s = (await sidebar.boundingBox())!
    const c = (await content.boundingBox())!
    expect(s.width).toBeGreaterThan(200)
    expect(c.x).toBeGreaterThanOrEqual(s.x + s.width - 1)
    expect(c.width).toBeGreaterThan(s.width)
    // private sessions are listed in the window (marked), newest first
    expect(await rowNames(app)).toEqual(['HR 1:1', 'Quarterly planning', 'Platform standup', 'Sprint retro'])
    await rows(app).filter({ hasText: 'HR 1:1' }).getByRole('img', { name: 'Private' }).waitFor()
    await app.window.getByRole('searchbox', { name: 'Search sessions' }).waitFor()
    await app.window.getByRole('button', { name: 'Record' }).waitFor()
    await app.window.getByRole('heading', { name: 'No Session Selected' }).waitFor()
    expect(await app.axe()).toEqual([])
  })

  it('filters the list from real keyboard input in the search field', async () => {
    const search = app.window.getByRole('searchbox', { name: 'Search sessions' })
    await search.click()
    await app.window.keyboard.type('standup')
    await expect.poll(() => rowNames(app)).toEqual(['Platform standup'])
    await app.window.keyboard.type('zzz')
    await app.window.getByRole('heading', { name: 'No Matching Sessions' }).waitFor()
    // Escape clears a search field
    await app.window.keyboard.press('Escape')
    await expect.poll(async () => (await rowNames(app)).length).toBe(4)
  })

  it('selecting a row shows that session; the Details tab has its facts; selection follows', async () => {
    await rows(app).filter({ hasText: 'Platform standup' }).click()
    await app.window.getByRole('heading', { level: 1, name: 'Platform standup' }).waitFor()
    await app.window.getByText('Finished · 12:00').first().waitFor()
    expect(await app.window.getByRole('heading', { name: 'No Session Selected' }).count()).toBe(0)
    expect(await rows(app).filter({ hasText: 'Platform standup' }).getAttribute('aria-selected')).toBe('true')
    for (const t of ['Transcript', 'Ask', 'Notes', 'Details'])
      await app.window.getByRole('tab', { name: t }).waitFor()
    await app.window.getByRole('tab', { name: 'Details' }).click()
    const details = app.window.getByRole('region', { name: 'Details' })
    await details.getByText('Finished', { exact: true }).waitFor()
    await details.getByText('12:00', { exact: true }).waitFor()
    await details.getByText('Microphone, System audio').waitFor()
    expect(app.window.url()).toContain(`/sessions/${SEED.standup}?tab=details`)
    await shot(app, 'shell-details')
    expect(await app.axe()).toEqual([])

    await rows(app).filter({ hasText: 'Sprint retro' }).click()
    await app.window.getByRole('heading', { level: 1, name: 'Sprint retro' }).waitFor()
    await app.window
      .getByRole('heading', { level: 1, name: 'Platform standup' })
      .waitFor({ state: 'detached' })
    await app.window.getByText('Finished · 20:00').first().waitFor()

    // the selection survives the list growing above it (sessions created elsewhere land on top)
    const url = app.window.url()
    for (const title of ['Created elsewhere 1', 'Created elsewhere 2'])
      await daemon.client.call('createSession', { body: { title } })
    await rows(app).filter({ hasText: 'Created elsewhere 2' }).waitFor({ timeout: 10_000 })
    expect((await rowNames(app))[0]).toBe('Created elsewhere 2')
    expect(await rows(app).filter({ hasText: 'Sprint retro' }).getAttribute('aria-selected')).toBe('true')
    expect(await rows(app).filter({ hasText: 'Created elsewhere 2' }).getAttribute('aria-selected')).toBe(
      'false',
    )
    await app.window.getByRole('heading', { level: 1, name: 'Sprint retro' }).waitFor()
    expect(app.window.url()).toBe(url)
    for (const s of (await daemon.client.call('listSessions', { query: {} })).sessions)
      if (s.title.startsWith('Created elsewhere'))
        await daemon.client.call('deleteSession', { params: { id: s.id } })
    await rows(app).filter({ hasText: 'Created elsewhere' }).first().waitFor({ state: 'detached' })
  })

  it('renames a session and makes it private from Details: the daemon and the list follow', async () => {
    await app.window.getByRole('tab', { name: 'Details' }).click()
    const title = app.window.getByRole('textbox', { name: 'Title' })
    await title.fill('Sprint retro (Q3)')
    await title.press('Enter')
    await waitFor(
      async () =>
        (await daemon.client.call('getSession', { params: { id: SEED.retro } })).title ===
        'Sprint retro (Q3)',
      5000,
      'the rename',
    )
    await expect.poll(() => rowNames(app)).toContain('Sprint retro (Q3)')
    await app.window.getByRole('heading', { level: 1, name: 'Sprint retro (Q3)' }).waitFor()
    const priv = app.window.getByRole('switch', { name: 'Private' })
    expect(await priv.isChecked()).toBe(false)
    await priv.focus()
    await app.window.keyboard.press('Space')
    await waitFor(
      async () =>
        (
          await daemon.client.call('getSession', {
            params: { id: SEED.retro },
            query: { includePrivate: true },
          })
        ).private,
      5000,
      'private',
    )
    await rows(app).filter({ hasText: 'Sprint retro (Q3)' }).getByRole('img', { name: 'Private' }).waitFor()
  })

  it('records: Record starts and selects a session with live levels; pause, resume and stop drive the daemon', async () => {
    const before = (await rowNames(app)).length
    await app.window.getByRole('button', { name: 'Record' }).click()
    const live = await waitFor(
      async () =>
        (await daemon.client.call('listSessions', { query: {} })).sessions.find(
          (s) => s.status === 'recording',
        ),
      10_000,
      'a recording session',
    )
    await app.window.getByRole('heading', { level: 1, name: live.title }).waitFor()
    await expect.poll(async () => (await rowNames(app)).length).toBe(before + 1)
    expect((await rowNames(app))[0]).toBe(live.title)
    expect(await rows(app).first().getAttribute('aria-selected')).toBe('true')
    await rows(app).first().getByRole('img', { name: 'Recording' }).waitFor() // the live red dot
    await app.window.getByRole('timer', { name: /^Recording, \d+:\d\d$/ }).waitFor()
    // live levels, each meter named; they move (ephemeral audio.level → Zustand → the meter)
    const mic = app.window.getByRole('progressbar', { name: 'Microphone level' })
    await app.window.getByRole('progressbar', { name: 'System audio level' }).waitFor()
    const seen = new Set<string>()
    await waitFor(
      async () => {
        seen.add((await mic.getAttribute('aria-valuenow')) ?? '')
        return seen.size >= 3
      },
      8000,
      'the microphone meter to change',
    )
    await shot(app, 'shell-recording')
    expect(await app.axe()).toEqual([])

    await app.window.getByRole('button', { name: 'Pause' }).click()
    await waitFor(
      async () => (await daemon.client.call('getSession', { params: { id: live.id } })).status === 'paused',
      5000,
      'paused',
    )
    await app.window.getByRole('timer', { name: /^Paused, / }).waitFor()
    await app.window.getByRole('button', { name: 'Resume' }).click()
    await waitFor(
      async () =>
        (await daemon.client.call('getSession', { params: { id: live.id } })).status === 'recording',
      5000,
      'recording again',
    )
    await app.window.getByRole('button', { name: 'Stop' }).click()
    await app.window.getByRole('button', { name: 'Record' }).waitFor({ timeout: 10_000 })
    expect((await daemon.client.call('getSession', { params: { id: live.id } })).status).toBe('stopped')
    await app.window
      .getByText(/^Finished · 0:\d\d$/)
      .first()
      .waitFor({ timeout: 5000 })
  })

  it('is keyboard reachable: Tab lands on each control, shortcuts open the help and switch tabs', async () => {
    const seen: string[] = []
    await app.window.getByRole('searchbox', { name: 'Search sessions' }).focus()
    await app.window.keyboard.press('Shift+Tab')
    await app.window.keyboard.press('Shift+Tab')
    await app.window.keyboard.press('Shift+Tab')
    for (let i = 0; i < 16; i++) {
      await app.window.keyboard.press('Tab')
      seen.push(
        (await app.window.evaluate(
          `(() => { const e = document.activeElement; return (e.getAttribute('role') || e.tagName.toLowerCase()) + ':' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40) })()`,
        )) as string,
      )
    }
    for (const want of [
      /^button:Record$/,
      /^button:Main menu$/,
      /^input:Search sessions$/,
      /^option:/,
      /^tab:/,
    ])
      expect(
        seen.some((s) => want.test(s)),
        `Tab order: ${seen.join(' → ')}`,
      ).toBe(true)
    // Ctrl+? — the shortcuts help
    await app.window.keyboard.press('Control+?')
    const help = app.window.getByRole('dialog', { name: 'Keyboard Shortcuts' })
    await help.getByText('Preferences').waitFor()
    expect(await app.axe()).toEqual([])
    await shot(app, 'shell-shortcuts')
    await app.window.keyboard.press('Escape')
    await help.waitFor({ state: 'detached' })
    // Ctrl+2 — the Ask tab of the open session
    await app.window.keyboard.press('Control+2')
    await expect
      .poll(() => app.window.getByRole('tab', { name: 'Ask' }).getAttribute('aria-selected'))
      .toBe('true')
    // Ctrl+F — search
    await app.window.keyboard.press('Control+f')
    expect(
      await app.window.evaluate(
        `document.activeElement.getAttribute('aria-label') ?? document.activeElement.closest('[aria-label]')?.getAttribute('aria-label')`,
      ),
    ).toBe('Search sessions')
  })

  it('shows a session started over HTTP live, through the EventBridge', async () => {
    const s = await daemon.client.call('createSession', { body: { title: 'Started from the CLI' } })
    await daemon.client.call('startSession', { params: { id: s.id } })
    const row = rows(app).filter({ hasText: 'Started from the CLI' })
    await row.getByRole('img', { name: 'Recording' }).waitFor({ timeout: 10_000 })
    // the sidebar's record control follows the daemon: this session can be stopped from here
    await app.window.getByRole('button', { name: 'Stop' }).click()
    await row.getByText(/Finished/).waitFor({ timeout: 10_000 })
  })
})

async function closedPort(): Promise<number> {
  const srv = createServer()
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r))
  const port = (srv.address() as { port: number }).port
  await new Promise<void>((r) => srv.close(() => r()))
  return port
}

describe('the main window against the protocol stub', () => {
  let stub: StubDaemon | null = null

  afterAll(async () => {
    await stub?.close()
  })

  it('explains an unreachable daemon instead of hanging, then connects on Try Again', async () => {
    const port = await closedPort()
    const url = `http://127.0.0.1:${port}`
    // a remote-looking URL is never replaced by a spawned daemon: point at a loopback one with no entry
    const app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: url, GNOMEOLA_DAEMON_ENTRY: '/nonexistent' },
    })
    try {
      await app.window.getByRole('heading', { name: 'Can’t Reach gnomeola' }).waitFor({ timeout: 30_000 })
      await app.window.getByText(`The gnomeola daemon is not answering at ${url}.`).waitFor()
      expect(await app.axe()).toEqual([])
      await shot(app, 'shell-unreachable')
      stub = await startStubDaemon([makeSession('Board meeting')], port)
      await app.window.getByRole('button', { name: 'Try Again' }).click()
      await expect.poll(() => rowNames(app), { timeout: 15_000 }).toContain('Board meeting')
      expect(await app.window.getByRole('heading', { name: 'Can’t Reach gnomeola' }).count()).toBe(0)
    } finally {
      await app.close()
      await stub?.close()
      stub = null
    }
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
    const app = await launchDesktop({ display, env: { GNOMEOLA_URL: stub.url } })
    try {
      await expect
        .poll(() => rowNames(app), { timeout: 30_000 })
        .toEqual(['Vendor call', 'Quarterly planning'])
      // snapshot at lastSeq 2 (health, then the list — main's supervisor also probes /health), then
      // subscribe from it
      const list = stub.requests.indexOf('GET /sessions?includePrivate=true&limit=500')
      expect(list).toBeGreaterThan(0)
      expect(stub.requests.slice(0, list).every((r) => r === 'GET /health')).toBe(true)
      await waitFor(() => stub!.eventConnections.length >= 1, 5000, 'an /events connection')
      expect(stub.eventConnections[0]).toBe(2)

      // a pushed upsert appears live, and an update renames in place
      stub.upsert(makeSession('Pushed over SSE'))
      await expect.poll(async () => (await rowNames(app))[0]).toBe('Pushed over SSE')
      stub.upsert({ ...newer, title: 'Vendor call (renamed)' })
      await expect.poll(() => rowNames(app)).toContain('Vendor call (renamed)')
      expect(await rowNames(app)).not.toContain('Vendor call')

      // drop the stream and keep it down: the banner says so, and nothing is lost meanwhile
      stub.refuseEvents = true
      expect(stub.dropStreams()).toBe(1)
      const banner = app.window.getByRole('status', { name: /Reconnecting/ })
      await banner.waitFor({ timeout: 10_000 })
      await shot(app, 'shell-reconnecting')
      stub.upsert(makeSession('Missed while offline'))
      stub.refuseEvents = false
      await expect.poll(() => rowNames(app), { timeout: 15_000 }).toContain('Missed while offline')
      expect(stub.eventConnections.at(-1)).toBe(4)
      await banner.waitFor({ state: 'detached', timeout: 5000 })

      // Record goes through the real API: create + start, and the new session is selected
      await app.window.getByRole('button', { name: 'Record' }).click()
      await app.window.getByRole('heading', { level: 1, name: 'New recording' }).waitFor()
      expect(stub.requests.filter((r) => r.startsWith('POST'))).toEqual([
        'POST /sessions',
        expect.stringMatching(/^POST \/sessions\/ses_[^/]+\/start$/),
      ])
      await app.window.getByRole('button', { name: 'Stop' }).click()
      await app.window.getByRole('button', { name: 'Record' }).waitFor()
      expect(stub.requests.filter((r) => r.startsWith('POST')).at(-1)).toMatch(/\/stop$/)
      expect(await app.axe()).toEqual([])
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
    }
  })
})

describe('the main window on a narrow screen', () => {
  it('collapses the split view and navigates sidebar → detail → back', async () => {
    const d = await startHeadlessDisplay({ size: '480x800' })
    markOnboarded(d)
    const daemon = await startDaemon()
    await daemon.client.call('createSession', { body: { title: '1:1 with Sam' } })
    const app = await launchDesktop({ display: d, env: { GNOMEOLA_URL: daemon.baseUrl } })
    try {
      await app.window.setViewportSize({ width: 360, height: 760 })
      const sidebar = app.window.getByRole('complementary', { name: 'Sessions' })
      await sidebar.waitFor({ timeout: 20_000 })
      // collapsed: only one pane is on screen
      expect(await app.window.getByRole('heading', { name: 'No Session Selected' }).count()).toBe(0)
      expect((await sidebar.boundingBox())!.width).toBeLessThanOrEqual(360)
      await rows(app).filter({ hasText: '1:1 with Sam' }).click()
      await app.window.getByRole('heading', { level: 1, name: '1:1 with Sam' }).waitFor()
      await sidebar.waitFor({ state: 'detached' })
      await shot(app, 'shell-narrow-detail')
      expect(await app.axe()).toEqual([])
      await app.window.getByRole('button', { name: 'Back' }).click()
      await sidebar.waitFor()
      await shot(app, 'shell-narrow-list')
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
      await daemon.stop()
      await d.close()
    }
  })
})

describe('translations', () => {
  it('shows strings from a catalogue when LANGUAGE asks for it; untranslated ones fall back to English', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-locale-'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'de.json'),
      JSON.stringify({
        Record: 'Aufnehmen',
        'Search sessions': 'Sitzungen durchsuchen',
        'No Session Selected': 'Keine Sitzung ausgewählt',
        Transcript: 'Mitschrift',
        Ask: 'Fragen',
      }),
    )
    const daemon = await startDaemon()
    await daemon.client.call('createSession', { body: { title: '1:1 with Sam' } })
    const app = await launchDesktop({
      display,
      env: {
        GNOMEOLA_URL: daemon.baseUrl,
        GNOMEOLA_LOCALE_DIR: dir,
        LANGUAGE: 'de',
        LC_ALL: 'de_DE.UTF-8',
        LANG: 'de_DE.UTF-8',
      },
    })
    try {
      await app.window.getByRole('button', { name: 'Aufnehmen' }).waitFor({ timeout: 20_000 })
      await app.window.getByRole('searchbox', { name: 'Sitzungen durchsuchen' }).waitFor()
      await app.window.getByRole('heading', { name: 'Keine Sitzung ausgewählt' }).waitFor()
      expect(await app.window.evaluate('document.documentElement.lang')).toBe('de')
      await rows(app).filter({ hasText: '1:1 with Sam' }).click()
      await app.window.getByRole('tab', { name: 'Mitschrift' }).waitFor()
      await app.window.getByRole('tab', { name: 'Fragen' }).waitFor()
      await app.window.getByRole('tab', { name: 'Details' }).waitFor()
      expect(await app.window.getByRole('button', { name: 'Record' }).count()).toBe(0)
      await shot(app, 'shell-i18n-de')
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
      await daemon.stop()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
