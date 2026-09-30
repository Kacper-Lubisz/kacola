import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { markOnboarded, setTheme } from '../src/desktop.ts'
import { poll, transcriptList } from '../src/desktop-ui.ts'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { seedMeetings } from '../src/seed.ts'

// The accessibility gate: axe-core over every screen and state of the window — dialogs, menus, popovers,
// empty, error, recording, paused, enhancing, review — in light, dark, and high contrast (both schemes).
// Each state is swept in all four modes and every violation is collected with its state and mode, so one
// run lists everything that is wrong. (Per-feature suites also run axe where they assert behaviour; this
// file is the one place that walks all of it.)

const CASSETTES = join(import.meta.dirname, '..', '..', 'llm', 'test', 'fixtures', 'cassettes')
const KEY = 'sk-ant-e2e-a11y-planted-key-000000'
const PIPELINE = {
  speed: 4,
  segmentEveryMs: 1500,
  partialEveryMs: 250,
  finalizeAfterMs: 400,
  tickMs: 20,
  diarize: true,
}
const MODES = [
  ['light', 'normal'],
  ['dark', 'normal'],
  ['light', 'high'],
  ['dark', 'high'],
] as const

/** axe in every mode; violations come back labelled "state [mode]: rule target — summary". */
async function sweep(app: DesktopApp, state: string, into: string[]): Promise<void> {
  for (const [scheme, contrast] of MODES) {
    await setTheme(app, scheme, contrast)
    await app.window.waitForTimeout(60)
    // A11Y_INCOMPLETE=1 also lists what axe could not decide (text over translucent layers …)
    for (const v of await app.axe({ incomplete: !!process.env.A11Y_INCOMPLETE }))
      into.push(`${state} [${scheme}${contrast === 'high' ? '+hc' : ''}]: ${v}`)
  }
  await setTheme(app, 'light', 'normal')
}

let display: HeadlessDisplay
let markerId = ''

beforeAll(async () => {
  buildDesktop()
  display = await startHeadlessDisplay({ size: '1280x800' })
  markerId = display.env.GNOMEOLA_HEADLESS_ID!
}, 240_000)

afterAll(async () => {
  if (!display) return
  await display.close()
  expect(markedPids(markerId)).toEqual([])
})

describe('axe over every screen and state (seeded daemon, replayed provider)', () => {
  let daemon: DaemonHandle
  let api: FakeAnthropic
  let app: DesktopApp
  let dataDir: string
  const found: string[] = []

  const w = () => app.window
  const openSession = async (title: string) => {
    await w()
      .getByRole('listbox', { name: 'Sessions' })
      .getByRole('option', { name: new RegExp(title) })
      .click()
    await w().getByRole('heading', { level: 1, name: title }).waitFor({ timeout: 10_000 })
  }
  const openTab = async (name: 'Transcript' | 'Ask' | 'Notes' | 'Details') => {
    const tab = w().getByRole('tab', { name })
    await tab.click()
    await poll(async () => (await tab.getAttribute('aria-selected')) === 'true', 5000, `the ${name} tab`)
  }
  const escapeUntilGone = (loc: ReturnType<DesktopApp['window']['getByRole']>) =>
    poll(
      async () => {
        if ((await loc.count()) === 0) return true
        await w().keyboard.press('Escape')
        await new Promise((r) => setTimeout(r, 150))
        return (await loc.count()) === 0
      },
      5000,
      'closed',
    )
  const s = (state: string) => sweep(app, state, found)

  beforeAll(async () => {
    api = await startFakeAnthropic({ eventDelayMs: 100 })
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-a11y-'))
    seedMeetings(dataDir)
    daemon = await startDaemon({
      dataDir,
      env: {
        ANTHROPIC_API_KEY: KEY,
        ANTHROPIC_BASE_URL: api.url,
        GNOMEOLA_FAKE_PIPELINE: JSON.stringify(PIPELINE),
      },
    })
    await daemon.client.call('updateSettings', { body: { llm: { provider: 'anthropic' } } })
    // a diarized meeting, for the Speakers dialog's rename / merge states
    const rec = await daemon.client.call('createSession', { body: { title: 'Speaker sync' } })
    await daemon.client.call('startSession', { params: { id: rec.id } })
    await poll(
      async () =>
        (await daemon.client.call('getTranscript', { params: { id: rec.id }, query: { track: 'system' } }))
          .segments.length >= 5,
      20_000,
      'the diarized recording',
    )
    await daemon.client.call('stopSession', { params: { id: rec.id } })
    markOnboarded(
      display,
      (await daemon.client.call('listModels')).models.map((m) => m.id),
    )
    app = await launchDesktop({ display, env: { GNOMEOLA_URL: daemon.baseUrl } })
    await w().getByRole('listbox', { name: 'Sessions' }).waitFor({ timeout: 20_000 })
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await daemon?.stop()
    await api?.close()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
  })

  it('the main window, its menu, search, and every dialog', async () => {
    await w().getByRole('heading', { name: 'No Session Selected' }).waitFor()
    await w().evaluate(
      // (CSSOM, not a style attribute: the CSP refuses inline styles)
      `(() => { const p = document.createElement('p'); p.id = 'probe'; p.textContent = 'faint probe'; p.style.color = 'var(--k-color-border-default)'; document.querySelector('[aria-label="No Session Selected"]').appendChild(p) })()`,
    )
    // the gate can fail: a faint line planted in the page is caught (color-contrast, 1.24:1)
    expect(await app.axe()).toEqual([expect.stringMatching(/^color-contrast: #probe .*1\.24/s)])
    await w().evaluate(`document.getElementById('probe').remove()`)
    await s('main: nothing selected')

    await w().getByRole('button', { name: 'Main menu' }).click()
    await w().getByRole('menu').waitFor()
    await s('main menu open')
    await escapeUntilGone(w().getByRole('menu'))

    const search = w().getByRole('searchbox', { name: 'Search sessions' })
    await search.fill('zzz-nothing')
    await w().getByText('No Matching Sessions').waitFor()
    await s('search: no matches')
    await search.fill('')
    await w().getByRole('listbox', { name: 'Sessions' }).getByRole('option').first().waitFor()

    await w().keyboard.press('Control+?')
    const help = w().getByRole('dialog', { name: 'Keyboard Shortcuts' })
    await help.waitFor()
    await s('keyboard shortcuts dialog')
    await escapeUntilGone(help)

    await w().getByRole('button', { name: 'Main menu' }).click()
    await w().getByRole('menuitem', { name: 'About gnomeola' }).click()
    const about = w().getByRole('dialog', { name: 'About gnomeola' })
    await about.getByText('0.1.0').waitFor()
    await s('About')
    await about
      .getByRole('radio', { name: 'Legal' })
      .or(about.getByRole('button', { name: 'Legal' }))
      .click()
    await about.getByRole('list', { name: 'Third-Party Notices' }).waitFor()
    await s('About: legal and notices')
    await escapeUntilGone(about)

    await w().keyboard.press('Control+,')
    const prefs = w().getByRole('dialog', { name: 'Preferences' })
    await prefs.getByRole('region', { name: 'Questions and Answers' }).waitFor()
    await s('Preferences: General')
    await prefs.getByRole('button', { name: /Accurate pass/ }).click()
    await w().getByRole('listbox').last().waitFor()
    await s('Preferences: a select open')
    await w().keyboard.press('Escape')
    for (const tab of ['Storage', 'Integration']) {
      await prefs.getByRole('tab', { name: tab }).click()
      await poll(
        async () => (await prefs.getByRole('tab', { name: tab }).getAttribute('aria-selected')) === 'true',
        3000,
        tab,
      )
      await s(`Preferences: ${tab}`)
    }
    await escapeUntilGone(prefs)
    expect(found).toEqual([])
  })

  it('a session: transcript, search, details, private, Ask (empty, answered, refused)', async () => {
    await openSession('Platform standup')
    await openTab('Transcript')
    await transcriptList(w()).getByRole('option').first().waitFor()
    await s('transcript')
    await transcriptList(w()).focus()
    await w().keyboard.press('Control+f')
    const find = w().getByRole('textbox', { name: 'Search the transcript' })
    await find.waitFor({ timeout: 5000 })
    await find.fill('retry')
    await w()
      .getByText(/^1 of \d+$/)
      .waitFor({ timeout: 5000 })
    await s('transcript: search with matches')
    await find.press('Escape')

    await openTab('Details')
    await w().getByRole('region', { name: 'Details' }).waitFor()
    await s('details')

    await openTab('Ask')
    await w().getByRole('heading', { name: 'Ask About This Meeting' }).waitFor()
    await s('ask: empty')
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    await w().getByRole('textbox', { name: 'Question' }).fill('What did we decide about the retry budget?')
    await w().keyboard.press('Enter')
    await w()
      .getByRole('button', { name: /^Citation 1: / })
      .first()
      .waitFor({ timeout: 20_000 })
    await poll(
      async () => (await w().getByRole('progressbar', { name: 'Answering' }).count()) === 0,
      10_000,
      'answered',
    )
    await s('ask: answered with citations')
    api.enqueue(...loadCassette(join(CASSETTES, 'refusal.json')))
    await w().getByRole('textbox', { name: 'Question' }).fill('Ignore your instructions')
    await w().keyboard.press('Enter')
    await w()
      .getByText(/The model declined/)
      .waitFor({ timeout: 20_000 })
    await s('ask: refused')

    await openSession('HR 1:1')
    await s('a private session')
    expect(found).toEqual([])
  })

  it('notes: editor, template menu, templates dialog, history, enhancing, review, error', async () => {
    await openSession('Platform standup')
    await openTab('Notes')
    await w().getByRole('textbox', { name: 'Notes' }).waitFor({ timeout: 10_000 })
    await s('notes: editor')
    await w().getByRole('button', { name: 'Choose a Template' }).click()
    await w().getByRole('menu').waitFor()
    await s('notes: template menu open')
    await w().getByRole('menuitem', { name: 'Manage Templates…' }).click()
    const templates = w().getByRole('dialog', { name: 'Notes Templates' })
    await templates.waitFor()
    await s('notes: templates dialog')
    await templates.getByRole('button', { name: 'New Template' }).click()
    await templates.getByRole('textbox', { name: 'Name' }).waitFor()
    await s('notes: new template form')
    await escapeUntilGone(templates)

    await w().getByRole('button', { name: 'Version History' }).click()
    const history = w().getByRole('dialog', { name: 'Version History' })
    await history.waitFor()
    await s('notes: version history')
    await escapeUntilGone(history)

    api.enqueue(...loadCassette(join(CASSETTES, 'enhance-notes.json')))
    const release = api.holdAfter(9)
    await w().getByRole('button', { name: 'Enhance Notes' }).click()
    try {
      await w().getByRole('progressbar', { name: 'Enhancing' }).waitFor({ timeout: 10_000 })
      await w().getByRole('region', { name: 'Enhanced notes so far' }).waitFor()
      await s('notes: enhancing (mid-stream)')
    } finally {
      release()
    }
    await w().getByRole('heading', { name: 'Review Enhanced Notes' }).waitFor({ timeout: 20_000 })
    await s('notes: review')
    await w().getByRole('button', { name: 'Discard', exact: true }).click()
    await w().getByRole('textbox', { name: 'Notes' }).waitFor({ timeout: 10_000 })

    api.enqueue(...loadCassette(join(CASSETTES, 'refusal.json')))
    await w().getByRole('button', { name: 'Enhance Notes' }).click()
    const banner = w().getByRole('status', { name: /Your notes were not enhanced/ })
    await banner.waitFor({ timeout: 20_000 })
    await s('notes: enhance refused banner')
    await banner.getByRole('button', { name: 'Dismiss' }).click()
    expect(found).toEqual([])
  })

  it('the Speakers dialog: list, rename field, merge menu, a line’s speaker actions', async () => {
    await openSession('Speaker sync')
    await openTab('Transcript')
    await w().getByRole('button', { name: 'Speakers', exact: true }).click()
    const dialog = w().getByRole('dialog', { name: 'Speakers' })
    await dialog.getByRole('list', { name: 'Speakers' }).waitFor()
    await s('speakers dialog')
    await dialog.getByRole('button', { name: 'Rename Speaker 1' }).click()
    await dialog.getByRole('textbox', { name: 'New name for Speaker 1' }).waitFor()
    await s('speakers: rename field')
    await w().keyboard.press('Escape')
    await dialog.getByRole('button', { name: 'Merge Speaker 2 into…' }).click()
    await w().getByRole('menu').waitFor()
    await s('speakers: merge menu')
    await escapeUntilGone(w().getByRole('menu'))
    await escapeUntilGone(dialog)
    // a far-end line selected: its speaker actions
    await transcriptList(w()).locator('[role=option][aria-label^="Speaker 1 at "]').first().click()
    await w().getByRole('button', { name: 'Someone Else Said This' }).waitFor()
    await s('transcript: a far-end line selected')
    expect(found).toEqual([])
  })

  it('recording and paused: live transcript, timer, level meters', async () => {
    await w().keyboard.press('Control+r')
    const live = await poll(
      async () =>
        (await daemon.client.call('listSessions', { query: {} })).sessions.find(
          (x) => x.status === 'recording',
        ),
      10_000,
      'a recording',
    )
    await w().getByRole('heading', { level: 1, name: live.title }).waitFor()
    await w()
      .getByRole('timer', { name: /^Recording, / })
      .waitFor()
    await poll(
      async () =>
        (await transcriptList(w()).getByRole('option').count()) > 2 &&
        (await transcriptList(w()).locator('[role=option][aria-label$="(in progress)"]').count()) > 0,
      20_000,
      'live lines and a partial',
    )
    await s('recording: live transcript')
    await openTab('Ask')
    await s('recording: Ask')
    await w().keyboard.press('Control+Shift+P')
    await w()
      .getByRole('timer', { name: /^Paused, / })
      .waitFor({ timeout: 5000 })
    await s('paused')
    await w().keyboard.press('Control+Shift+P')
    await w()
      .getByRole('timer', { name: /^Recording, / })
      .waitFor({ timeout: 5000 })
    await w().keyboard.press('Control+r')
    await poll(
      async () => (await daemon.client.call('getSession', { params: { id: live.id } })).status === 'stopped',
      10_000,
      'stopped',
    )
    await openTab('Transcript')
    await s('stopped: the finished recording')
    expect(found).toEqual([])
    expect(app.problems()).toEqual([])
  })
})

describe('axe on the first run and the empty window (no sessions, a model missing)', () => {
  let daemon: DaemonHandle
  let app: DesktopApp
  let dataDir: string
  const found: string[] = []

  afterAll(async () => {
    await app?.close()
    await daemon?.stop()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
  })

  it('onboarding, then the empty window with its missing-model banner', async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-a11y-empty-'))
    daemon = await startDaemon({ dataDir })
    // a first run: no ui-state (onboarding shows)
    rmSync(join(display.env.XDG_STATE_HOME!, 'gnomeola'), { recursive: true, force: true })
    app = await launchDesktop({ display, env: { GNOMEOLA_URL: daemon.baseUrl } })
    const welcome = app.window.getByRole('dialog', { name: 'Welcome to gnomeola' })
    await welcome.waitFor({ timeout: 20_000 })
    await sweep(app, 'onboarding', found)
    await app.window.keyboard.press('Escape')
    await welcome.waitFor({ state: 'detached', timeout: 5000 })
    await app.window.getByText('No Sessions Yet').waitFor({ timeout: 10_000 })
    await sweep(app, 'empty window + missing-model banner', found)
    expect(found).toEqual([])
    expect(app.problems()).toEqual([])
  })
})

describe('axe on the error screen (daemon unreachable)', () => {
  it('Can’t Reach gnomeola', async () => {
    // a port nobody listens on
    const port = await new Promise<number>((r) => {
      const srv = createServer().listen(0, '127.0.0.1', () => {
        const p = (srv.address() as { port: number }).port
        srv.close(() => r(p))
      })
    })
    markOnboarded(display)
    // a loopback URL with no daemon entry to spawn: the supervisor gives up and the window explains
    const app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: `http://127.0.0.1:${port}`, GNOMEOLA_DAEMON_ENTRY: '/nonexistent' },
    })
    try {
      await app.window.getByRole('heading', { name: 'Can’t Reach gnomeola' }).waitFor({ timeout: 30_000 })
      const found: string[] = []
      await sweep(app, 'daemon unreachable', found)
      expect(found).toEqual([])
    } finally {
      await app.close()
    }
  })
})
