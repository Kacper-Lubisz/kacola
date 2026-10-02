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

// The Electron window's shell against the real daemon and the protocol stub — home (the day, search,
// New recording), the meeting page and Back to Today; originally the port of the GTK suites' session-list /
// record assertions (packages/testkit/src/ui/e2e/gnomeola-ui.e2e.test.ts, the
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

/** Every meeting row on home (today's and earlier days'), in screen order. */
const rows = (app: DesktopApp) => app.window.locator('main ol[aria-label] > li button[aria-label]')
const row = (app: DesktopApp, title: string) => rows(app).filter({ hasText: title })
/** Row titles: the accessible name is "<title>, <time>" (or "<title>, <day> <time>"). */
const rowNames = async (app: DesktopApp) =>
  (await rows(app).evaluateAll((els) =>
    els.map((e) => (e.getAttribute('aria-label') ?? '').replace(/, [^,]*$/, '')),
  )) as string[]
const home = (app: DesktopApp) => app.window.getByRole('searchbox', { name: 'Search or ask' })
const backToToday = async (app: DesktopApp) => {
  await app.window.getByRole('button', { name: 'Back to Today' }).click()
  await home(app).waitFor()
}
const openDetails = async (app: DesktopApp) => {
  await app.window.getByRole('button', { name: 'Meeting actions' }).click()
  await app.window.getByRole('menuitem', { name: 'Details…' }).click()
  return app.window.getByRole('dialog', { name: 'Details' })
}

describe('the main window against the real daemon (seeded, fake capture)', () => {
  let daemon: DaemonHandle
  let app: DesktopApp
  let dataDir: string

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-shell-'))
    seedMeetings(dataDir)
    daemon = await startDaemon({ dataDir })
    app = await launchDesktop({ display, env: { GNOMEOLA_URL: daemon.baseUrl } })
    await app.window.getByRole('list', { name: 'Today’s meetings' }).waitFor({ timeout: 20_000 })
  }, 120_000)

  afterEach(() => {
    expect(app.problems()).toEqual([])
  })

  afterAll(async () => {
    await app?.close()
    await daemon?.stop()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
  })

  it('opens on home: search-and-ask, the day’s meetings (private ones marked), New recording; no sidebar', async () => {
    expect(await app.window.getByRole('complementary', { name: 'Sessions' }).count()).toBe(0)
    // the seeded meetings were all recorded today, in strict time order
    expect([...(await rowNames(app))].sort()).toEqual([
      'HR 1:1',
      'Platform standup',
      'Quarterly planning',
      'Sprint retro',
    ])
    await row(app, 'HR 1:1').getByText('Private').waitFor()
    await row(app, 'Platform standup').getByText('12 min').waitFor()
    await home(app).waitFor()
    await app.window.getByRole('button', { name: 'New recording', exact: true }).waitFor()
    expect(await app.axe()).toEqual([])
  })

  it('searches from real keyboard input: titles and transcripts as moments; Escape brings the day back', async () => {
    await home(app).click()
    await app.window.keyboard.type('standup')
    const moments = app.window.getByRole('list', { name: 'Moments' })
    await moments
      .getByRole('button', { name: /^Platform standup/ })
      .first()
      .waitFor({ timeout: 10_000 })
    expect(await app.window.getByRole('list', { name: 'Today’s meetings' }).count()).toBe(0)
    expect(await app.axe()).toEqual([]) // the results screen
    await app.window.keyboard.type('zzz')
    await app.window.getByText(/Nothing anyone said matches “standupzzz”/).waitFor({ timeout: 10_000 })
    // Escape clears the search field: the day again
    await app.window.keyboard.press('Escape')
    await app.window.getByRole('list', { name: 'Today’s meetings' }).waitFor()
    await expect.poll(async () => (await rowNames(app)).length).toBe(4)
  })

  it('opening a row shows that meeting’s outcome; Details has its facts; Back returns to Today', async () => {
    await row(app, 'Platform standup').click()
    await app.window.getByRole('heading', { level: 1, name: 'Platform standup' }).waitFor()
    await app.window.getByRole('region', { name: 'Outcome' }).waitFor()
    await app.window.getByText('· 12 min').first().waitFor()
    expect(app.window.url()).toContain(`/sessions/${SEED.standup}`)
    expect(await app.axe()).toEqual([]) // the outcome page
    const details = await openDetails(app)
    const facts = details.getByRole('region', { name: 'Details' })
    await facts.getByText('Finished', { exact: true }).waitFor()
    await facts.getByText('12:00', { exact: true }).waitFor()
    await facts.getByText('Microphone, System audio').waitFor()
    await shot(app, 'shell-details')
    expect(await app.axe()).toEqual([])
    await app.window.keyboard.press('Escape')
    await details.waitFor({ state: 'detached' })

    await backToToday(app)
    await row(app, 'Sprint retro').click()
    await app.window.getByRole('heading', { level: 1, name: 'Sprint retro' }).waitFor()
    await app.window.getByText('· 20 min').first().waitFor()

    // the page stays put while meetings are created elsewhere; home lists them
    const url = app.window.url()
    for (const title of ['Created elsewhere 1', 'Created elsewhere 2'])
      await daemon.client.call('createSession', { body: { title } })
    await new Promise((r) => setTimeout(r, 500))
    await app.window.getByRole('heading', { level: 1, name: 'Sprint retro' }).waitFor()
    expect(app.window.url()).toBe(url)
    await backToToday(app)
    await row(app, 'Created elsewhere 2').waitFor({ timeout: 10_000 })
    for (const s of (await daemon.client.call('listSessions', { query: {} })).sessions)
      if (s.title.startsWith('Created elsewhere'))
        await daemon.client.call('deleteSession', { params: { id: s.id } })
    await row(app, 'Created elsewhere').first().waitFor({ state: 'detached' })
  })

  it('renames a meeting and makes it private from Details: the daemon and home follow', async () => {
    await row(app, 'Sprint retro').click()
    await app.window.getByRole('heading', { level: 1, name: 'Sprint retro' }).waitFor()
    const details = await openDetails(app)
    const title = details.getByRole('textbox', { name: 'Title' })
    await title.fill('Sprint retro (Q3)')
    await title.press('Enter')
    await waitFor(
      async () =>
        (await daemon.client.call('getSession', { params: { id: SEED.retro } })).title ===
        'Sprint retro (Q3)',
      5000,
      'the rename',
    )
    await app.window.getByRole('heading', { level: 1, name: 'Sprint retro (Q3)' }).waitFor()
    const priv = details.getByRole('switch', { name: 'Private' })
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
    await app.window.keyboard.press('Escape')
    await details.waitFor({ state: 'detached' })
    await backToToday(app)
    await expect.poll(() => rowNames(app)).toContain('Sprint retro (Q3)')
    await row(app, 'Sprint retro (Q3)').getByText('Private').waitFor()
  })

  it('records: New recording opens the live page; pause, resume and stop drive the daemon; then the outcome', async () => {
    await app.window.getByRole('button', { name: 'New recording', exact: true }).click()
    const live = await waitFor(
      async () =>
        (await daemon.client.call('listSessions', { query: {} })).sessions.find(
          (s) => s.status === 'recording',
        ),
      10_000,
      'a recording session',
    )
    // the store's stand-in title ("Meeting <UTC time>") reads as untitled
    expect(live.title).toMatch(/^Meeting \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    await app.window.getByRole('heading', { level: 1, name: 'Untitled meeting' }).waitFor()
    await app.window.getByRole('timer', { name: /^Recording, \d+:\d\d$/ }).waitFor()
    // the notepad is the screen; no level meters any more
    await app.window.getByRole('textbox', { name: 'Notes' }).waitFor()
    expect(await app.window.getByRole('progressbar', { name: /level$/ }).count()).toBe(0)
    await shot(app, 'shell-recording')
    expect(await app.axe()).toEqual([]) // the live page

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
    await app.window.getByRole('region', { name: 'Outcome' }).waitFor({ timeout: 10_000 })
    expect((await daemon.client.call('getSession', { params: { id: live.id } })).status).toBe('stopped')
    await backToToday(app)
    await app.window.getByRole('button', { name: 'New recording', exact: true }).waitFor({ timeout: 10_000 })
    // on home it reads as untitled, at its time
    expect(await row(app, 'Untitled meeting').count()).toBe(1)
  })

  it('is keyboard reachable: Tab lands on each control; shortcuts open the help, search, Ask and the transcript', async () => {
    const seen: string[] = []
    await home(app).focus()
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
      /^button:New recording$/,
      /^button:Main menu$/,
      /^input:Search or ask$/,
      /^button:Platform standup, /,
    ])
      expect(
        seen.some((s) => want.test(s)),
        `Tab order: ${seen.join(' → ')}`,
      ).toBe(true)
    // Ctrl+? — the shortcuts help
    await app.window.keyboard.press('Control+?')
    const help = app.window.getByRole('dialog', { name: 'Keyboard shortcuts' })
    await help.getByText('Preferences').waitFor()
    expect(await app.axe()).toEqual([])
    await shot(app, 'shell-shortcuts')
    await app.window.keyboard.press('Escape')
    await help.waitFor({ state: 'detached' })
    // Ctrl+F — home's search box
    await app.window.keyboard.press('Control+f')
    expect(
      await app.window.evaluate(
        `document.activeElement.getAttribute('aria-label') ?? document.activeElement.closest('[aria-label]')?.getAttribute('aria-label')`,
      ),
    ).toBe('Search or ask')
    // in a meeting: Ctrl+K opens the Ask bar (Escape closes it), Ctrl+T the transcript beside the page
    await row(app, 'Platform standup').click()
    await app.window.getByRole('heading', { level: 1, name: 'Platform standup' }).waitFor()
    await app.window.keyboard.press('Control+k')
    const ask = app.window.getByRole('region', { name: 'Ask about this meeting' })
    await ask.getByRole('textbox').waitFor()
    await app.window.keyboard.press('Escape')
    await ask.waitFor({ state: 'detached' })
    await app.window.keyboard.press('Control+t')
    await app.window.getByRole('listbox', { name: 'Transcript' }).waitFor({ timeout: 10_000 })
    expect(app.window.url()).toContain('panel=transcript')
    await app.window.keyboard.press('Control+t')
    await app.window.getByRole('listbox', { name: 'Transcript' }).waitFor({ state: 'detached' })
    await backToToday(app)
  })

  it('shows a session started over HTTP live, through the EventBridge', async () => {
    const s = await daemon.client.call('createSession', { body: { title: 'Started from the CLI' } })
    await daemon.client.call('startSession', { params: { id: s.id } })
    // under way: in its place on the day, highlighted, with its clock and Stop (stopped from home)
    const pinned = app.window.getByRole('region', { name: 'Recording now: Started from the CLI' })
    await pinned.getByRole('timer', { name: /^Recording/ }).waitFor({ timeout: 10_000 })
    await pinned.getByRole('button', { name: 'Stop' }).click()
    await pinned.waitFor({ state: 'detached', timeout: 10_000 })
    await waitFor(
      async () => (await daemon.client.call('getSession', { params: { id: s.id } })).status === 'stopped',
      10_000,
      'stopped',
    )
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

  it('explains an unreachable daemon instead of hanging, then connects on Try again', async () => {
    const port = await closedPort()
    const url = `http://127.0.0.1:${port}`
    // a remote-looking URL is never replaced by a spawned daemon: point at a loopback one with no entry
    const app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: url, GNOMEOLA_DAEMON_ENTRY: '/nonexistent' },
    })
    try {
      await app.window.getByRole('heading', { name: 'Can’t reach kacola' }).waitFor({ timeout: 30_000 })
      await app.window.getByText(`it is not answering at ${url}.`, { exact: false }).waitFor()
      expect(await app.axe()).toEqual([])
      await shot(app, 'shell-unreachable')
      stub = await startStubDaemon([makeSession('Board meeting')], port)
      await app.window.getByRole('button', { name: 'Try again' }).click()
      await expect.poll(() => rowNames(app), { timeout: 15_000 }).toContain('Board meeting')
      expect(await app.window.getByRole('heading', { name: 'Can’t reach kacola' }).count()).toBe(0)
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

      // New recording goes through the real API: create + start, and the live page opens
      await app.window.getByRole('button', { name: 'New recording', exact: true }).click()
      await app.window.getByRole('heading', { level: 1, name: 'New recording' }).waitFor()
      expect(stub.requests.filter((r) => r.startsWith('POST'))).toEqual([
        'POST /sessions',
        expect.stringMatching(/^POST \/sessions\/ses_[^/]+\/start$/),
      ])
      await app.window.getByRole('button', { name: 'Stop' }).click()
      await app.window.getByRole('region', { name: 'Outcome' }).waitFor()
      await app.window.getByRole('button', { name: 'Back to Today' }).click()
      await app.window.getByRole('button', { name: 'New recording', exact: true }).waitFor()
      expect(stub.requests.filter((r) => r.startsWith('POST')).at(-1)).toMatch(/\/stop$/)
      expect(await app.axe()).toEqual([])
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
    }
  })
})

describe('the main window on a narrow screen', () => {
  it('fits home and the meeting page in 360 px and navigates home → meeting → Back to Today', async () => {
    const d = await startHeadlessDisplay({ size: '480x800' })
    markOnboarded(d)
    const daemon = await startDaemon()
    await daemon.client.call('createSession', { body: { title: '1:1 with Sam' } })
    const app = await launchDesktop({ display: d, env: { GNOMEOLA_URL: daemon.baseUrl } })
    try {
      await app.window.setViewportSize({ width: 360, height: 760 })
      await home(app).waitFor({ timeout: 20_000 })
      expect((await home(app).boundingBox())!.width).toBeLessThanOrEqual(360)
      // no horizontal scroll
      expect(await app.window.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(360)
      await shot(app, 'shell-narrow-list')
      await row(app, '1:1 with Sam').click()
      await app.window.getByRole('heading', { level: 1, name: '1:1 with Sam' }).waitFor()
      await home(app).waitFor({ state: 'detached' })
      await shot(app, 'shell-narrow-detail')
      expect(await app.axe()).toEqual([])
      await backToToday(app)
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
        'New recording': 'Neue Aufnahme',
        'Search or ask': 'Suchen oder fragen',
        Today: 'Heute',
        Transcript: 'Mitschrift',
        'Ask about this meeting': 'Zu diesem Meeting fragen',
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
      await app.window.getByRole('button', { name: 'Neue Aufnahme' }).waitFor({ timeout: 20_000 })
      await app.window.getByRole('searchbox', { name: 'Suchen oder fragen' }).waitFor()
      await app.window.getByRole('heading', { name: /^Heute/ }).waitFor()
      expect(await app.window.evaluate('document.documentElement.lang')).toBe('de')
      expect(await app.window.getByRole('button', { name: 'New recording', exact: true }).count()).toBe(0)
      await row(app, '1:1 with Sam').click()
      await app.window.getByRole('button', { name: 'Mitschrift' }).waitFor()
      await app.window.getByRole('button', { name: 'Zu diesem Meeting fragen' }).waitFor()
      // untranslated strings fall back to English
      await app.window.getByRole('button', { name: 'Meeting actions' }).waitFor()
      await shot(app, 'shell-i18n-de')
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
      await daemon.stop()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
