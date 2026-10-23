import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon, waitFor } from '@kacola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@kacola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@kacola/testkit/ui'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DESKTOP_ARTIFACTS, markOnboarded, pageText, uiStatePath } from '../src/desktop.ts'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { SEED, seedMeetings } from '../src/seed.ts'

// The Electron window's dialogs against the real daemon — the port of the GTK suite's
// ui-dialogs.e2e.test.ts (Preferences, API key, About, onboarding), same behaviours, role + name
// locators, plus the Ask and Notes panes' no-provider notices (ui-dialogs' key-less Ask path).

const CASSETTES = join(import.meta.dirname, '..', '..', 'llm', 'test', 'fixtures', 'cassettes')
const KEY = 'sk-ant-typed-into-prefs-5Z7Q2W9X4K'

function ocr(png: string): string {
  return execFileSync('tesseract', [png, '-', '--psm', '3'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

/** Toggle a switch the way a keyboard user does (its input is visually hidden: never click its box). */
async function toggle(app: DesktopApp, sw: ReturnType<DesktopApp['window']['getByRole']>) {
  await sw.focus()
  await app.window.keyboard.press('Space')
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

describe('Preferences and About against the real daemon', () => {
  let daemon: DaemonHandle
  let api: FakeAnthropic
  let app: DesktopApp
  let dataDir: string

  beforeAll(async () => {
    api = await startFakeAnthropic()
    dataDir = mkdtempSync(join(tmpdir(), 'kacola-desktop-dialogs-'))
    seedMeetings(dataDir)
    daemon = await startDaemon({ dataDir, env: { ANTHROPIC_BASE_URL: api.url } })
    expect((await daemon.client.call('getSettings')).llm.apiKeyConfigured).toBe(false)
    markOnboarded(display)
    app = await launchDesktop({ display, env: { KACOLA_URL: daemon.baseUrl } })
    await app.window.getByRole('searchbox', { name: 'Search or ask' }).waitFor({ timeout: 20_000 })
  }, 120_000)

  afterEach(() => {
    expect(app.problems()).toEqual([])
  })

  afterAll(async () => {
    await app?.close()
    await daemon?.stop()
    await api?.close()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
  })

  const prefs = () => app.window.getByRole('dialog', { name: 'Preferences' })
  const closePrefs = async () => {
    await prefs().getByRole('button', { name: 'Close' }).click()
    await prefs().waitFor({ state: 'detached' })
  }

  /** Open a meeting from home (its row on the day). */
  const openSession = async (title: string) => {
    await app.window
      .getByRole('list', { name: 'Today’s meetings' })
      .getByRole('button', { name: new RegExp(`^${title}, `) })
      .click()
    await app.window.getByRole('heading', { level: 1, name: title }).waitFor({ timeout: 10_000 })
  }
  const backToToday = async () => {
    await app.window.getByRole('button', { name: 'Back to Today' }).click()
    await app.window.getByRole('searchbox', { name: 'Search or ask' }).waitFor()
  }
  const askPane = () => app.window.getByRole('region', { name: 'Ask about this meeting' })
  // the daemon's own sentence, under one title, with the ONE action it names
  const unavailable = () => askPane().getByText('No answer this time', { exact: true })

  it('explains that questions and enhancing need a provider, and Set up a provider opens Preferences', async () => {
    await openSession('Platform standup')
    // Ask is the Ctrl+K bar over the page
    await app.window.keyboard.press('Control+k')
    const field = askPane().getByRole('textbox', { name: 'Ask about this meeting' })
    await field.click()
    await app.window.keyboard.type('Who owns the dashboard?')
    await app.window.keyboard.press('Enter')
    await unavailable().waitFor({ timeout: 10_000 })
    await askPane().getByRole('button', { name: 'Set up a provider' }).waitFor()
    // nothing was sent anywhere: no key, no request
    expect(api.seen).toHaveLength(0)
    expect(await app.axe()).toEqual([])
    await app.screenshot(join(DESKTOP_ARTIFACTS, 'ask-unavailable.png'))
    await askPane().getByRole('button', { name: 'Set up a provider' }).click()
    await prefs().getByRole('region', { name: 'Advanced' }).waitFor({ timeout: 5000 })
    await prefs()
      .getByText(/Answers: Anthropic, needs an API key/)
      .waitFor()
    await closePrefs()

    // Notes: Enhance says the same, with its own way to Preferences; the notes are untouched
    await askPane().getByRole('button', { name: 'Close Ask' }).click()
    await askPane().waitFor({ state: 'detached' })
    const before = await daemon.client.call('listNoteVersions', { params: { id: SEED.standup } })
    await app.window.getByRole('button', { name: 'Enhance notes' }).click()
    const banner = app.window.getByRole('status', { name: /Your notes were not changed/ })
    await banner.waitFor({ timeout: 10_000 })
    expect(await banner.getByRole('button', { name: 'Set up a provider' }).count()).toBe(1)
    expect(api.seen).toHaveLength(0)
    expect(await daemon.client.call('listNoteVersions', { params: { id: SEED.standup } })).toEqual(before)
    expect(await app.axe()).toEqual([])
    await app.screenshot(join(DESKTOP_ARTIFACTS, 'notes-unavailable.png'))
    await banner.getByRole('button', { name: 'Set up a provider' }).click()
    await prefs().getByRole('region', { name: 'Advanced' }).waitFor({ timeout: 5000 })
    await closePrefs()
    await banner.getByRole('button', { name: 'Dismiss' }).click()
    await banner.waitFor({ state: 'detached' })
    await backToToday()
  })

  it('opening Preferences shows the daemon’s values and writes nothing back', async () => {
    // non-default settings, set elsewhere (the CLI, say) before Preferences first opens
    await daemon.client.call('updateSettings', {
      body: { stt: { finalPass: 'off' }, retention: { audio: 'delete-after-days', days: 14 } },
    })
    const before = await daemon.client.call('getSettings')
    // from the primary menu
    await app.window.getByRole('button', { name: 'Main menu' }).click()
    await app.window.getByRole('menuitem', { name: /Preferences/ }).click()
    await prefs().getByRole('region', { name: 'Auto-record' }).waitFor()
    await prefs()
      .getByText(/Answers: Anthropic, needs an API key/)
      .waitFor()
    await expect
      .poll(() =>
        prefs()
          .getByRole('button', { name: /Accurate transcript/ })
          .textContent(),
      )
      .toContain('Off (live transcript only)')
    await new Promise((r) => setTimeout(r, 1000))
    expect(await daemon.client.call('getSettings')).toEqual(before)
    expect(await app.axe()).toEqual([])
  })

  it('a key set outside the window (kacola.env, the keyring) shows as a status line, never as the key', async () => {
    await daemon.client.call('setApiKey', { body: { key: KEY } })
    await prefs()
      .getByText(/Answers: Anthropic(?!, needs)/)
      .waitFor({ timeout: 10_000 })
    expect(
      await prefs()
        .getByRole('textbox', { name: /API key/ })
        .count(),
    ).toBe(0)
    expect(await prefs().getByRole('button', { name: 'Open config file' }).count()).toBe(1)
    expect(await pageText(app)).not.toContain(KEY)
    expect(ocr(await app.screenshot(join(DESKTOP_ARTIFACTS, 'prefs-advanced.png')))).not.toContain(
      KEY.slice(8, 20),
    )
    expect(daemon.output()).not.toContain(KEY)
    expect(app.log()).not.toContain(KEY)
    await closePrefs()
  })

  it('asks with the Ask button once a key is stored: exactly that key reaches the provider', async () => {
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    await openSession('Platform standup')
    await app.window.keyboard.press('Control+k')
    await askPane().getByRole('textbox', { name: 'Ask about this meeting' }).fill('Who owns the dashboard?')
    await askPane().getByRole('button', { name: 'Ask', exact: true }).click()
    await askPane()
      .getByRole('button', { name: /^Citation 1: / })
      .first()
      .waitFor({ timeout: 20_000 })
    expect(api.seen).toHaveLength(1)
    expect(api.seen[0]!.headers['x-api-key']).toBe(KEY)
    // the bar shows the latest exchange only: the answer replaced the earlier explanation
    expect(await unavailable().count()).toBe(0)
    expect(daemon.output()).not.toContain(KEY)
    expect(await pageText(app)).not.toContain(KEY)
    await askPane().getByRole('button', { name: 'Close Ask' }).click()
    await backToToday()
  })

  it('persists settings changed in Preferences (keyboard), and reflects changes made elsewhere live', async () => {
    // Ctrl+, opens Preferences
    await app.window.keyboard.press('Control+,')
    await prefs().getByRole('region', { name: 'Auto-record' }).waitFor()
    const pass = prefs().getByRole('button', { name: /Accurate transcript/ })
    await pass.focus()
    await app.window.keyboard.press('Enter')
    await app.screenshot(join(DESKTOP_ARTIFACTS, 'prefs-select-open.png'))
    await app.window.getByRole('option', { name: 'After the recording' }).click()
    await waitFor(
      async () => (await daemon.client.call('getSettings')).stt.finalPass === 'after',
      5000,
      'finalPass=after',
    )
    // the microphone list comes from listDevices: Default plus the fake mic
    await prefs()
      .getByRole('button', { name: /Microphone/ })
      .click()
    await app.window.getByRole('option', { name: /Fake Microphone/ }).click()
    await waitFor(
      async () => (await daemon.client.call('getSettings')).capture.micDevice === 'fake.mic',
      5000,
      'micDevice=fake.mic',
    )
    // M4 auto-record rules: off by default, a click turns one on, a change made elsewhere flips the other
    const onMeeting = prefs().getByRole('switch', { name: 'When a calendar meeting starts' })
    expect(await onMeeting.isChecked()).toBe(false)
    await toggle(app, onMeeting)
    await waitFor(
      async () => (await daemon.client.call('getSettings')).autoRecord.calendar,
      5000,
      'autoRecord.calendar',
    )
    await daemon.client.call('updateSettings', { body: { autoRecord: { micActivity: true } } })
    await expect
      .poll(() => prefs().getByRole('switch', { name: 'When another app uses the microphone' }).isChecked())
      .toBe(true)
    expect((await daemon.client.call('getSettings')).autoRecord).toMatchObject({
      calendar: true,
      micActivity: true,
    })
    await app.screenshot(join(DESKTOP_ARTIFACTS, 'prefs-general.png'))

    // a change made by another client shows up while the dialog is open (the provider itself is
    // kacola.env's, or the CLI's: Preferences only reports it)
    await daemon.client.call('updateSettings', { body: { llm: { provider: 'ollama' } } })
    await prefs()
      .getByText(/Answers: Ollama/)
      .waitFor()
    await daemon.client.call('updateSettings', { body: { llm: { provider: 'anthropic' } } })
    await prefs()
      .getByText(/Answers: Anthropic/)
      .waitFor()

    // retention lives on the Storage page; delete-after-days shows its day count
    await prefs().getByRole('tab', { name: 'Storage' }).click()
    const days = prefs().getByRole('textbox', { name: 'Days to keep audio' })
    expect(await days.inputValue()).toBe('14')
    await days.focus()
    await app.window.keyboard.press('ArrowUp')
    await waitFor(
      async () => (await daemon.client.call('getSettings')).retention.days === 15,
      5000,
      'days=15',
    )
    await prefs()
      .getByRole('button', { name: /Audio$/ })
      .click()
    await app.window.getByRole('option', { name: 'Delete once transcribed' }).click()
    await waitFor(
      async () => (await daemon.client.call('getSettings')).retention.audio === 'delete-after-transcription',
      5000,
      'retention=delete-after-transcription',
    )
    await days.waitFor({ state: 'detached' })
    await toggle(app, prefs().getByRole('switch', { name: 'Archive audio' }))
    await waitFor(async () => (await daemon.client.call('getSettings')).retention.archive, 5000, 'archive on')
    expect(await app.axe()).toEqual([])
    await app.screenshot(join(DESKTOP_ARTIFACTS, 'prefs-storage.png'))
    await closePrefs()
  })

  it('installs the command-line tool and Claude skill from Preferences (the real install-cli)', async () => {
    const home = display.env.HOME!
    const shim = join(home, '.local', 'bin', 'kacola')
    expect(existsSync(shim)).toBe(false)
    await app.window.keyboard.press('Control+,')
    await prefs().getByRole('tab', { name: 'Integration' }).click()
    const row = prefs().getByText('Command-line tool and Claude skill').locator('../..')
    await row.getByText(/Lets agents like Claude Code/).waitFor({ timeout: 20_000 })
    await row.getByRole('button', { name: 'Install' }).click()
    await row.getByText(`Installed at ${shim}`, { exact: false }).waitFor({ timeout: 30_000 })
    expect(readFileSync(shim, 'utf8')).toContain('# kacola-cli-shim v1')
    expect(existsSync(join(home, '.claude', 'skills', 'meeting-context', 'SKILL.md'))).toBe(true)
    // the shim runs the CLI against this daemon
    const out = execFileSync(shim, ['sessions', 'list', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, HOME: home, KACOLA_URL: daemon.baseUrl },
    })
    expect(out).toContain('Platform standup')
    // remove, and a foreign `kacola` is reported, never clobbered without asking
    await row.getByRole('button', { name: 'Remove' }).click()
    await row.getByRole('button', { name: 'Install' }).waitFor({ timeout: 30_000 })
    expect(existsSync(shim)).toBe(false)
    writeFileSync(shim, '#!/bin/sh\necho someone else\n', { mode: 0o755 })
    await closePrefs()
    await app.window.keyboard.press('Control+,')
    await prefs().getByRole('tab', { name: 'Integration' }).click()
    await prefs()
      .getByText(`A different kacola command is already installed at ${shim}`)
      .waitFor({ timeout: 30_000 })
    expect(readFileSync(shim, 'utf8')).toContain('someone else')
    // the top-bar extension row is there (a stub until packaging implements it)
    await prefs().getByText('Top-bar extension').waitFor()
    rmSync(shim)
    await closePrefs()
  })

  it('About (from the main menu) credits Granola plainly and lists the third-party notices', async () => {
    await app.window.getByRole('button', { name: 'Main menu' }).click()
    await app.window.getByRole('menuitem', { name: 'About kacola' }).click()
    const about = app.window.getByRole('dialog', { name: 'About kacola' })
    await about.waitFor()
    await about.getByText('0.1.0').waitFor()
    const credit = about.getByText(/independent clean-room project inspired by Granola/)
    expect(await credit.textContent()).toContain('It is not affiliated with or endorsed by Granola.')
    expect(await app.axe()).toEqual([])
    await app.screenshot(join(DESKTOP_ARTIFACTS, 'about.png'))
    await about
      .getByRole('radio', { name: 'Legal' })
      .or(about.getByRole('button', { name: 'Legal' }))
      .click()
    await about.getByText(/GNU General Public License/).waitFor()
    const notices = about.getByRole('list', { name: 'Third-party notices' })
    await notices.getByText('react-aria-components', { exact: false }).first().waitFor()
    await notices.getByText(/lucide-react [\d.]+ — ISC/).waitFor()
    expect(await notices.getByText(/Adwaita symbolic icons/).count()).toBe(0)
    expect(await app.axe()).toEqual([])
    await app.screenshot(join(DESKTOP_ARTIFACTS, 'about-legal.png'))
    await app.window.keyboard.press('Escape')
    await about.waitFor({ state: 'detached' })
  })

  it('removing the key: Preferences says Not configured again', async () => {
    await app.window.keyboard.press('Control+,')
    await prefs().getByRole('button', { name: 'Remove' }).click()
    await waitFor(
      async () => !(await daemon.client.call('getSettings')).llm.apiKeyConfigured,
      5000,
      'key removed',
    )
    await prefs().getByText('Not configured').waitFor()
    await closePrefs()
  })
})

describe('first-run onboarding (slow fake model downloads)', () => {
  let daemon: DaemonHandle
  const calendarFile = join(mkdtempSync(join(tmpdir(), 'kacola-desktop-onboarding-cal-')), 'calendar.json')
  writeFileSync(calendarFile, JSON.stringify({ calendars: [{ id: 'work', name: 'Work' }], occurrences: [] }))

  beforeAll(async () => {
    daemon = await startDaemon({
      entry: join(import.meta.dirname, '..', 'src', 'slow-models-daemon.ts'),
      env: { KACOLA_E2E_MODEL_STEP_MS: '700', KACOLA_CALENDAR: `file:${calendarFile}` },
    })
  })

  afterAll(async () => {
    await daemon?.stop()
  })

  it('opens on first run, downloads the required model by itself with live progress, walks its steps, installs the CLI, and is remembered', async () => {
    rmSync(uiStatePath(display), { force: true })
    const shim = join(display.env.HOME!, '.local', 'bin', 'kacola')
    rmSync(shim, { force: true })
    const app = await launchDesktop({ display, env: { KACOLA_URL: daemon.baseUrl } })
    try {
      const welcome = app.window.getByRole('dialog', { name: 'Welcome to kacola' })
      await welcome.waitFor({ timeout: 20_000 })
      // no question to answer: the missing model starts downloading as soon as setup opens, and its
      // progress arrives through model.progress events — watch several distinct values go by
      const models = welcome.getByRole('listitem', { name: 'Speech models' })
      const seen = new Set<string>()
      const bars = new Set<number>()
      const bar = welcome.getByRole('progressbar', { name: 'Speech models download progress' })
      await waitFor(
        async () => {
          const s = (await models.textContent()) ?? ''
          const m = /Downloading [\d.]+ MB · (\d+)%/.exec(s)
          if (m) seen.add(m[1]!)
          const v = await bar.getAttribute('aria-valuenow', { timeout: 50 }).catch(() => null)
          if (v !== null) bars.add(Number(v))
          if (seen.size === 2) await app.screenshot(join(DESKTOP_ARTIFACTS, 'onboarding-progress.png'))
          return s.includes('Ready · ')
        },
        20_000,
        'the download to finish',
      )
      expect([...seen].map(Number).filter((p) => p > 0 && p < 100).length).toBeGreaterThanOrEqual(1)
      expect([...bars].filter((p) => p > 0 && p < 100).length).toBeGreaterThanOrEqual(1)
      expect((await daemon.client.call('listModels')).models.every((m) => m.state === 'ready')).toBe(true)
      // step 1, recording: on Linux nothing to grant, capture either works or says why (health())
      await welcome.getByText('Working', { exact: true }).waitFor()
      expect(await app.axe()).toEqual([])
      await app.screenshot(join(DESKTOP_ARTIFACTS, 'onboarding.png'))
      await welcome.getByRole('button', { name: 'Continue' }).click()
      // step 2, calendar: which calendars are read, and a broken calendar shows live
      await welcome.getByText('Reading Work').waitFor({ timeout: 10_000 })
      writeFileSync(calendarFile, '{ broken')
      await welcome.getByText(/Not available: calendar file/).waitFor({ timeout: 10_000 })
      writeFileSync(
        calendarFile,
        JSON.stringify({ calendars: [{ id: 'work', name: 'Work' }], occurrences: [] }),
      )
      await welcome.getByText('Reading Work').waitFor({ timeout: 10_000 })
      await welcome.getByRole('button', { name: 'Continue' }).click()
      // step 3: the CLI + skill is on by default
      expect(
        await welcome.getByRole('switch', { name: 'Install command-line tool and Claude skill' }).isChecked(),
      ).toBe(true)
      expect(await app.axe()).toEqual([])

      await welcome.getByRole('button', { name: 'Done' }).click()
      await welcome.waitFor({ state: 'detached' })
      expect(JSON.parse(readFileSync(uiStatePath(display), 'utf8'))).toEqual({
        version: 1,
        onboardingDone: true,
        skippedMissing: [],
      })
      await waitFor(() => existsSync(shim), 30_000, 'the CLI shim from onboarding')
      expect(await app.window.getByText(/not downloaded yet/).count()).toBe(0)
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
      rmSync(shim, { force: true })
    }
    // remembered: a second launch goes straight to the window
    const again = await launchDesktop({ display, env: { KACOLA_URL: daemon.baseUrl } })
    try {
      await again.window.getByRole('searchbox', { name: 'Search or ask' }).waitFor({ timeout: 20_000 })
      await new Promise((r) => setTimeout(r, 2000))
      expect(await again.window.getByRole('dialog', { name: 'Welcome to kacola' }).count()).toBe(0)
    } finally {
      await again.close()
    }
  })
})

describe('onboarding skipped', () => {
  it('Skip ends setup at once and installs nothing, the models still download, and the menu reopens it', async () => {
    const daemon = await startDaemon()
    rmSync(uiStatePath(display), { force: true })
    const app = await launchDesktop({ display, env: { KACOLA_URL: daemon.baseUrl } })
    try {
      const welcome = app.window.getByRole('dialog', { name: 'Welcome to kacola' })
      await welcome.waitFor({ timeout: 20_000 })
      await welcome.getByRole('button', { name: 'Skip for now' }).click()
      await welcome.waitFor({ state: 'detached' })
      expect(JSON.parse(readFileSync(uiStatePath(display), 'utf8'))).toEqual({
        version: 1,
        onboardingDone: true,
        skippedMissing: [],
      })
      expect(existsSync(join(display.env.HOME!, '.local', 'bin', 'kacola'))).toBe(false)
      await waitFor(
        async () => (await daemon.client.call('listModels')).models.every((m) => m.state === 'ready'),
        20_000,
        'the models setup started to finish after Skip',
      )
      await app.window.getByRole('button', { name: 'Main menu' }).click()
      await app.window.getByRole('menuitem', { name: 'Set up kacola…' }).click()
      await welcome.waitFor()
      // Escape counts as skipping again
      await app.window.keyboard.press('Escape')
      await welcome.waitFor({ state: 'detached' })
      expect(app.problems()).toEqual([])
    } finally {
      await app.close()
      await daemon.stop()
    }
  })
})
