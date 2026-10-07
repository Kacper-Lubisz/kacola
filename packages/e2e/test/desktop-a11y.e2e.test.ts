import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, LEASE_HEADER } from '@kacola/protocol'
import { type DaemonHandle, startDaemon } from '@kacola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@kacola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@kacola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { markOnboarded, setTheme } from '../src/desktop.ts'
import { poll, transcriptList } from '../src/desktop-ui.ts'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { seedMeetings } from '../src/seed.ts'

// The accessibility gate: axe-core over every screen and state of the window — home, search results,
// prep, live (with a suggestion), paused, the outcome, dialogs, menus, popovers, empty, error, enhancing — in light, dark, and high contrast (both schemes).
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
  markerId = display.env.KACOLA_HEADLESS_ID!
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
  const home = () => w().getByRole('searchbox', { name: 'Search or ask' })
  const goHome = async () => {
    if ((await home().count()) === 0) await w().getByRole('button', { name: 'Back to Today' }).click()
    await home().waitFor()
  }
  const openSession = async (title: string) => {
    await goHome()
    await w()
      .locator('main ol[aria-label] > li button[aria-label]')
      .filter({ hasText: title })
      .first()
      .click()
    await w().getByRole('heading', { level: 1, name: title }).waitFor({ timeout: 10_000 })
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
  const askBar = () => w().getByRole('region', { name: 'Ask about this meeting' })
  const closeAsk = async () => {
    await askBar().getByRole('button', { name: 'Close Ask' }).click()
    await askBar().waitFor({ state: 'detached' })
  }
  const s = (state: string) => sweep(app, state, found)

  beforeAll(async () => {
    api = await startFakeAnthropic({ eventDelayMs: 100 })
    dataDir = mkdtempSync(join(tmpdir(), 'kacola-desktop-a11y-'))
    seedMeetings(dataDir)
    // a calendar meeting happening now: home expands it, and the live page records it with its agenda
    const calFile = join(dataDir, 'calendar.json')
    const start = Date.now() - 5 * 60_000
    writeFileSync(
      calFile,
      JSON.stringify({
        calendars: [{ id: 'cal-work', name: 'Work' }],
        occurrences: [
          {
            uid: 'sync@x',
            sourceUid: 'cal-work',
            calendarName: 'Work',
            recurrenceId: null,
            summary: 'Weekly sync',
            description: '',
            location: '',
            url: 'https://meet.google.com/abc-defg-hij',
            start: new Date(start).toISOString(),
            end: new Date(start + 60 * 60_000).toISOString(),
            allDay: false,
            startDate: null,
            endDate: null,
            timezone: 'UTC',
            status: 'CONFIRMED',
            myPartstat: 'ACCEPTED',
            organizer: 'mailto:me@example.com',
            attendees: 3,
            recurring: false,
            xprops: {},
          },
        ],
      }),
    )
    daemon = await startDaemon({
      dataDir,
      env: {
        KACOLA_CALENDAR: `file:${calFile}`,
        ANTHROPIC_API_KEY: KEY,
        ANTHROPIC_BASE_URL: api.url,
        KACOLA_FAKE_PIPELINE: JSON.stringify(PIPELINE),
        KACOLA_TRACKER: 'off',
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
    app = await launchDesktop({ display, env: { KACOLA_URL: daemon.baseUrl } })
    await home().waitFor({ timeout: 20_000 })
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await daemon?.stop()
    await api?.close()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
  })

  it('home, its menu, search results, and every dialog', async () => {
    await w().getByRole('list', { name: 'Today’s meetings' }).waitFor()
    await w().evaluate(
      // (CSSOM, not a style attribute: the CSP refuses inline styles)
      `(() => { const p = document.createElement('p'); p.id = 'probe'; p.textContent = 'faint probe'; p.style.color = 'var(--k-color-border-default)'; document.querySelector('main section').appendChild(p) })()`,
    )
    // the gate can fail: a faint line planted in the page is caught (color-contrast, 1.24:1)
    expect(await app.axe()).toEqual([expect.stringMatching(/^color-contrast: #probe .*1\.24/s)])
    await w().evaluate(`document.getElementById('probe').remove()`)
    await s('home: the day')

    await w().getByRole('button', { name: 'Main menu' }).click()
    await w().getByRole('menu').waitFor()
    await s('main menu open')
    await escapeUntilGone(w().getByRole('menu'))

    await home().fill('retry')
    await w().getByRole('list', { name: 'Moments' }).getByRole('button').first().waitFor({ timeout: 10_000 })
    await s('search: moments')
    await home().fill('zzz-nothing')
    await w()
      .getByText(/Nothing anyone said matches/)
      .waitFor({ timeout: 10_000 })
    await s('search: no matches')
    await home().fill('')
    await w().getByRole('list', { name: 'Today’s meetings' }).waitFor()

    await w().keyboard.press('Control+?')
    const help = w().getByRole('dialog', { name: 'Keyboard shortcuts' })
    await help.waitFor()
    await s('keyboard shortcuts dialog')
    await escapeUntilGone(help)

    await w().getByRole('button', { name: 'Main menu' }).click()
    await w().getByRole('menuitem', { name: 'About kacola' }).click()
    const about = w().getByRole('dialog', { name: 'About kacola' })
    await about.getByText('0.1.0').waitFor()
    await s('About')
    await about
      .getByRole('radio', { name: 'Legal' })
      .or(about.getByRole('button', { name: 'Legal' }))
      .click()
    await about.getByRole('list', { name: 'Third-party notices' }).waitFor()
    await s('About: legal and notices')
    await escapeUntilGone(about)

    await w().keyboard.press('Control+,')
    const prefs = w().getByRole('dialog', { name: 'Preferences' })
    await prefs.getByRole('region', { name: 'Questions and answers' }).waitFor()
    await s('Preferences: General')
    await prefs.getByRole('button', { name: /Accurate transcript/ }).click()
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

  it('prep: an agenda before its meeting (items, context, Ask)', async () => {
    const v = await daemon.client.call('createAgenda', {
      body: {
        title: 'Planning review',
        goals: ['Agree the Q4 scope'],
        items: [{ text: 'Roadmap', kind: 'must-cover' }, { text: 'Hiring' }, { text: 'Offsite dates' }],
      },
    })
    await daemon.client.call('addContextCard', {
      params: { id: v.agenda.id },
      body: { title: 'My notes', body: 'Keep the scope small.' },
    })
    await w().evaluate(`location.hash = '#/agendas/${v.agenda.id}'`)
    await w().getByRole('heading', { level: 1, name: 'Planning review' }).waitFor({ timeout: 10_000 })
    await w().getByRole('grid', { name: 'Agenda items' }).waitFor()
    await s('prep')
    await w().getByRole('button', { name: 'Add card' }).click()
    await w().getByRole('textbox', { name: 'Card title' }).waitFor()
    await s('prep: new context card form')
    await goHome()
    expect(found).toEqual([])
  })

  it('an outcome: transcript panel, its search, details, private, Ask (empty, answered, refused)', async () => {
    await openSession('Platform standup')
    await w().getByRole('region', { name: 'Outcome' }).waitFor()
    await s('outcome')
    await w().keyboard.press('Control+t')
    await transcriptList(w()).getByRole('option').first().waitFor()
    await s('outcome: transcript panel')
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
    await w().keyboard.press('Control+t')
    await transcriptList(w()).waitFor({ state: 'detached' })

    await w().getByRole('button', { name: 'Meeting actions' }).click()
    await w().getByRole('menu').waitFor()
    await s('outcome: meeting actions menu')
    await w().getByRole('menuitem', { name: 'Details…' }).click()
    const details = w().getByRole('dialog', { name: 'Details' })
    await details.getByRole('region', { name: 'Details' }).waitFor()
    await s('details dialog')
    await escapeUntilGone(details)

    await w().getByRole('button', { name: 'Share summary' }).click()
    const share = w().getByRole('dialog', { name: 'Share summary' })
    await share.waitFor()
    await s('share summary dialog')
    await escapeUntilGone(share)

    await w().keyboard.press('Control+k')
    await askBar().getByRole('textbox').waitFor()
    await s('ask: empty')
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    await askBar().getByRole('textbox').fill('What did we decide about the retry budget?')
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
    await askBar().getByRole('textbox').fill('Ignore your instructions')
    await w().keyboard.press('Enter')
    await w()
      .getByText(/The model declined/)
      .waitFor({ timeout: 20_000 })
    await s('ask: refused')
    await closeAsk()

    await openSession('HR 1:1')
    await s('a private meeting')
    expect(found).toEqual([])
  })

  it('notes: editor, template menu, templates dialog, history, enhancing, tidied, error', async () => {
    await openSession('Platform standup')
    await w().getByRole('textbox', { name: 'Notes' }).waitFor({ timeout: 10_000 })
    await s('notes: editor')
    await w().getByRole('button', { name: 'Choose a template' }).click()
    await w().getByRole('menu').waitFor()
    await s('notes: template menu open')
    await w().getByRole('menuitem', { name: 'Manage templates…' }).click()
    const templates = w().getByRole('dialog', { name: 'Notes templates' })
    await templates.waitFor()
    await s('notes: templates dialog')
    await templates.getByRole('button', { name: 'New template' }).click()
    await templates.getByRole('textbox', { name: 'Name' }).waitFor()
    await s('notes: new template form')
    await escapeUntilGone(templates)

    await w().getByRole('button', { name: 'Notes actions' }).click()
    await w().getByRole('menuitem', { name: 'Version history…' }).click()
    const history = w().getByRole('dialog', { name: 'Version history' })
    await history.waitFor()
    await s('notes: version history')
    await escapeUntilGone(history)

    api.enqueue(...loadCassette(join(CASSETTES, 'enhance-notes.json')))
    const release = api.holdAfter(9)
    await w().getByRole('button', { name: 'Enhance notes' }).click()
    try {
      await w().getByRole('progressbar', { name: 'Enhancing' }).waitFor({ timeout: 10_000 })
      await w().getByRole('region', { name: 'Enhanced notes so far' }).waitFor()
      await s('notes: enhancing (mid-stream)')
    } finally {
      release()
    }
    // Enhance replaces the draft, with an undo through the history
    await w().getByRole('button', { name: 'Back to my draft' }).waitFor({ timeout: 20_000 })
    await s('notes: tidied, Back to my draft')

    api.enqueue(...loadCassette(join(CASSETTES, 'refusal.json')))
    await w().getByRole('button', { name: 'Enhance notes' }).click()
    const banner = w().getByRole('status', { name: /Your notes were not changed/ })
    await banner.waitFor({ timeout: 20_000 })
    await s('notes: enhance refused banner')
    await banner.getByRole('button', { name: 'Dismiss' }).click()
    expect(found).toEqual([])
  })

  it('the Speakers dialog: list, rename field, merge menu, a line’s speaker actions', async () => {
    await openSession('Speaker sync')
    await w().getByRole('button', { name: 'Meeting actions' }).click()
    await w().getByRole('menuitem', { name: 'Speakers…' }).click()
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
    // a far-end line selected in the transcript panel: its speaker actions (and the naming prompt)
    await w().keyboard.press('Control+t')
    await transcriptList(w()).locator('[role=option][aria-label^="Speaker 1 at "]').first().click()
    await w().getByRole('button', { name: 'Someone else said this' }).waitFor()
    await s('transcript: a far-end line selected')
    await w().keyboard.press('Control+t')
    expect(found).toEqual([])
  })

  it('live and paused: the notepad, agenda, one suggestion, Ask, the transcript panel; then the outcome', async () => {
    // the calendar meeting under way: its agenda, then Join and record (through the daemon: nothing
    // opens a browser here); the window opens its live page
    await goHome()
    await w().getByRole('region', { name: 'Now: Weekly sync' }).waitFor({ timeout: 10_000 })
    await s('home: the meeting under way, in its place')
    const v = await daemon.client.call('createAgenda', {
      body: { eventUid: 'sync@x', items: [{ text: 'Roadmap' }, { text: 'Hiring' }] },
    })
    const agendaId = v.agenda.id
    const joined = await daemon.client.call('joinMeeting', {
      params: { id: v.agenda.meeting!.meetingId! },
      body: {},
    })
    const live = joined.session
    await w().evaluate(`location.hash = '#/sessions/${live.id}'`)
    await w().getByRole('heading', { level: 1, name: live.title }).waitFor({ timeout: 10_000 })
    await w()
      .getByRole('timer', { name: /^Recording, / })
      .waitFor()
    await w().getByRole('textbox', { name: 'Notes' }).waitFor()
    await w().getByRole('list', { name: 'Agenda items' }).waitFor({ timeout: 10_000 })
    const added = { items: v.items }
    await daemon.client.call('setAgendaItemStatus', {
      params: { id: agendaId, itemId: added.items[0]!.id },
      body: { status: 'in-progress' },
    })
    // the user's Claude, following with permission to suggest: its pill and its one suggestion
    const grant = await daemon.client.call('createAgentLease', {
      params: { id: live.id },
      body: { name: 'claude', mode: 'suggest' },
    })
    const claude = createClient({ baseUrl: daemon.baseUrl, headers: { [LEASE_HEADER]: grant.token } })
    await claude.call('addSuggestion', {
      params: { id: agendaId },
      body: {
        kind: 'next-point',
        text: 'Ask who owns the hiring plan',
        itemId: added.items[1]!.id,
        source: 'agent:claude',
        ttlSec: 3600,
      } as never,
    })
    await w()
      .getByRole('button', { name: /Your Claude · can suggest/ })
      .waitFor({ timeout: 10_000 })
    await w()
      .getByRole('region', { name: /^Suggestion: / })
      .getByRole('button', { name: 'Accept' })
      .waitFor({ timeout: 10_000 })
    await s('live: agenda, notepad and a suggestion')
    await w().keyboard.press('Control+t')
    await poll(
      async () =>
        (await transcriptList(w()).getByRole('option').count()) > 2 &&
        (await transcriptList(w()).locator('[role=option][aria-label$="(in progress)"]').count()) > 0,
      20_000,
      'live lines and a partial',
    )
    await s('live: transcript panel')
    await w().keyboard.press('Control+t')
    await transcriptList(w()).waitFor({ state: 'detached' })
    await w().keyboard.press('Control+k')
    await askBar().getByRole('textbox').waitFor()
    await s('live: Ask bar')
    await closeAsk()
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
    await w().getByRole('region', { name: 'Outcome' }).waitFor({ timeout: 10_000 })
    await s('stopped: the outcome')
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
    dataDir = mkdtempSync(join(tmpdir(), 'kacola-desktop-a11y-empty-'))
    daemon = await startDaemon({ dataDir })
    // a first run: no ui-state (onboarding shows)
    rmSync(join(display.env.XDG_STATE_HOME!, 'kacola'), { recursive: true, force: true })
    app = await launchDesktop({ display, env: { KACOLA_URL: daemon.baseUrl } })
    const welcome = app.window.getByRole('dialog', { name: 'Welcome to kacola' })
    await welcome.waitFor({ timeout: 20_000 })
    await sweep(app, 'onboarding', found)
    await app.window.keyboard.press('Escape')
    await welcome.waitFor({ state: 'detached', timeout: 5000 })
    await app.window.getByRole('searchbox', { name: 'Search or ask' }).waitFor({ timeout: 10_000 })
    await sweep(app, 'empty window + missing-model banner', found)
    expect(found).toEqual([])
    expect(app.problems()).toEqual([])
  })
})

describe('axe on the error screen (daemon unreachable)', () => {
  it('Can’t Reach kacola', async () => {
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
      env: { KACOLA_URL: `http://127.0.0.1:${port}`, KACOLA_DAEMON_ENTRY: '/nonexistent' },
    })
    try {
      await app.window.getByRole('heading', { name: 'Can’t reach kacola' }).waitFor({ timeout: 30_000 })
      const found: string[] = []
      await sweep(app, 'daemon unreachable', found)
      expect(found).toEqual([])
    } finally {
      await app.close()
    }
  })
})
