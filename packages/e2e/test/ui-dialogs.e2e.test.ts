import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { type AppHandle, type HeadlessDisplay, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { seedMeetings } from '../src/seed.ts'
import {
  APP,
  allAccessibleText,
  buildUi,
  capture,
  launchUi,
  logTail,
  markOnboarded,
  unnamedInteractive,
  waitForWindow,
} from '../src/ui.ts'

// V-9a / S-3 / S-4 / S-5 and the no-key path of Q-5, against the real daemon. The daemon starts
// WITHOUT an API key (in-memory keyring) but pointed at a replayed Anthropic API, so a key typed into
// Preferences is the only thing that makes questions work — and the test watches that key reach the
// API's x-api-key header while never appearing in the window's accessible tree or on screen.

const CASSETTES = join(import.meta.dirname, '..', '..', 'llm', 'test', 'fixtures', 'cassettes')
const KEY = 'sk-ant-typed-into-prefs-5Z7Q2W9X4K'

async function openTab(d: HeadlessDisplay, name: string) {
  const tab = await d.findOne({ app: APP, role: 'page tab', name, states: ['showing'] })
  await d.click(tab)
  await d.waitFor(async () => (await d.describe(tab)).states.includes('selected'), 5000, `the ${name} tab`)
}

/** Close the open dialog with its own Close button (Escape first ends an entry row's editing). */
async function closeDialog(d: HeadlessDisplay) {
  const dialog = await d.findOne({ app: APP, role: 'dialog', states: ['showing'] })
  await d.click(await d.findOne({ app: APP, role: 'button', name: 'Close', within: dialog }))
}

const gone = (d: HeadlessDisplay, q: Parameters<HeadlessDisplay['find']>[0], what: string) =>
  d.waitFor(async () => (await d.find(q)).length === 0, 5000, what)

/** OCR a screenshot (tesseract is on this machine); used to prove a secret is not painted. */
function ocr(png: string): string {
  return execFileSync('tesseract', [png, '-', '--psm', '3'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

describe('questions without a key, Preferences, About', () => {
  let d: HeadlessDisplay
  let daemon: DaemonHandle
  let api: FakeAnthropic
  let app: AppHandle
  let dataDir: string

  beforeAll(async () => {
    buildUi()
    api = await startFakeAnthropic()
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-ui-dialogs-'))
    seedMeetings(dataDir)
    daemon = await startDaemon({ dataDir, env: { ANTHROPIC_BASE_URL: api.url } })
    expect((await daemon.client.call('getSettings')).llm.apiKeyConfigured).toBe(false)
    d = await startHeadlessDisplay({ size: '1280x800' })
    markOnboarded(d)
    app = launchUi(d, { GNOMEOLA_URL: daemon.baseUrl })
    await waitForWindow(d, app)
  })

  afterEach(() => {
    if (app?.hasExited()) throw new Error(`gnomeola exited:\n${logTail(app)}`)
  })

  afterAll(async () => {
    await d?.close()
    await daemon?.stop()
    await api?.close()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
  })

  it('explains that questions are unavailable without a key, with a way to Preferences', async () => {
    await d.click(await d.findOne({ app: APP, role: 'list item', name: 'Platform standup' }))
    await openTab(d, 'Ask')
    const entry = await d.findOne({ app: APP, role: 'text', name: 'Question', states: ['showing'] })
    await d.focus(entry)
    await d.typeText('Who owns the dashboard?')
    // keyboard only: Return submits (the Ask button is the pointer path)
    await d.pressKeys('Return')
    await d.findOne(
      { app: APP, role: 'label', nameContains: 'Questions are not available right now', states: ['showing'] },
      10_000,
    )
    const why = await d.findOne({ app: APP, role: 'label', nameContains: 'is an API key configured?' })
    expect(why.name).toMatch(/Add an API key in Preferences|Preferences\./)
    expect(api.seen).toHaveLength(0) // nothing went to the API
    await capture(d, 'ask-unavailable')
    expect(await unnamedInteractive(d)).toEqual([])

    // non-default settings, set elsewhere (the CLI, say) before Preferences first opens
    await daemon.client.call('updateSettings', {
      body: { stt: { finalPass: 'off' }, retention: { audio: 'delete-after-days', days: 14 } },
    })
    const before = await daemon.client.call('getSettings')
    await d.click(
      await d.findOne({ app: APP, role: 'button', name: 'Open Preferences', states: ['showing'] }),
    )
    await d.findOne({ app: APP, role: 'label', name: 'Questions and Answers', states: ['showing'] }, 10_000)
    await d.findOne({ app: APP, role: 'label', name: 'Not configured', states: ['showing'] })
    // the dialog shows them — and opening it wrote nothing back (a regression: combo rows used to
    // reset to their first option on mount and PATCH it)
    await d.findOne({ app: APP, role: 'label', name: 'Off (live transcript only)', states: ['showing'] })
    await new Promise((r) => setTimeout(r, 1000))
    expect(await daemon.client.call('getSettings')).toEqual(before)
  })

  it('stores an API key typed into Preferences: the daemon reports it, the window never shows it', async () => {
    const field = await d.findOne({ app: APP, role: 'password text', name: 'API key', states: ['showing'] })
    await d.focus(field)
    await d.typeText(KEY)
    // while typed: masked in the accessible tree and on screen
    expect(await allAccessibleText(d)).not.toContain(KEY)
    const typed = await capture(d, 'prefs-key-typed')
    const text = ocr(typed)
    expect(text).toMatch(/Preferences|Provider/) // OCR works on this screen at all
    expect(text).not.toContain(KEY.slice(8, 20))
    // Return applies the entry row
    await d.pressKeys('Return')
    await d.waitFor(
      async () => (await daemon.client.call('getSettings')).llm.apiKeyConfigured,
      10_000,
      'the daemon to report a configured key',
    )
    await d.findOne({ app: APP, role: 'label', name: 'Configured (kept in the keyring, never shown)' }, 5000)
    await d.findOne({ app: APP, role: 'label', name: 'API key saved' }, 5000) // toast
    // cleared from the entry, absent from the tree and the screen
    await d.waitFor(async () => !(await allAccessibleText(d)).includes('•'), 5000, 'the entry to be emptied')
    expect(await allAccessibleText(d)).not.toContain(KEY)
    const after = await capture(d, 'prefs-key-saved')
    expect(ocr(after)).not.toContain(KEY.slice(8, 20))
    expect(await unnamedInteractive(d)).toEqual([])
    await closeDialog(d)
    await gone(
      d,
      { app: APP, role: 'label', name: 'Questions and Answers', states: ['showing'] },
      'Preferences to close',
    )

    // and the key works: the same question now goes to the (replayed) API with exactly that key
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    const entry = await d.findOne({ app: APP, role: 'text', name: 'Question', states: ['showing'] })
    await d.focus(entry)
    await d.typeText('Who owns the dashboard?')
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Ask', states: ['showing'] }))
    await d.findOne({ app: APP, role: 'button', nameContains: 'Citation 1:', states: ['showing'] }, 15_000)
    expect(api.seen).toHaveLength(1)
    expect(api.seen[0]!.headers['x-api-key']).toBe(KEY)
    // the earlier unavailable turn is still explained, the new one answered
    expect(
      await d.find({ app: APP, role: 'label', nameContains: 'Questions are not available right now' }),
    ).toHaveLength(1)
    expect(daemon.output()).not.toContain(KEY)
  })

  it('persists settings changed in Preferences (keyboard), and reflects changes made elsewhere live', async () => {
    // Ctrl+, opens Preferences (win.preferences)
    await d.pressKeys('Control_L', ',')
    await d.findOne({ app: APP, role: 'label', name: 'Questions and Answers', states: ['showing'] }, 10_000)
    const pass = await d.findOne({ app: APP, role: 'combo box', name: 'Accurate pass', states: ['showing'] })
    await d.focus(pass)
    await d.pressKeys('Return')
    await d.findOne({ app: APP, role: 'label', name: 'After the recording', states: ['showing'] })
    // the popover's keyboard focus does not start on the selected item: go to the top, then down one
    await d.pressKeys('Home')
    await d.pressKeys('Down')
    await d.pressKeys('Return')
    await d.waitFor(
      async () => (await daemon.client.call('getSettings')).stt.finalPass === 'after',
      5000,
      'finalPass=after persisted',
    )
    // the microphone list comes from listDevices: Default plus the fake mic
    const mic = await d.findOne({ app: APP, role: 'combo box', name: 'Microphone', states: ['showing'] })
    await d.focus(mic)
    await d.pressKeys('Return')
    await d.findOne({ app: APP, role: 'label', name: 'Fake Microphone (default)', states: ['showing'] })
    await d.pressKeys('Home')
    await d.pressKeys('Down')
    await d.pressKeys('Return')
    await d.waitFor(
      async () => (await daemon.client.call('getSettings')).capture.micDevice === 'fake.mic',
      5000,
      'micDevice=fake.mic persisted',
    )
    await capture(d, 'prefs-general')

    // a change made by another client (the CLI, say) shows up while the dialog is open
    await daemon.client.call('updateSettings', { body: { llm: { provider: 'ollama' } } })
    await d.findOne({ app: APP, role: 'text', name: 'Ollama URL', states: ['showing'] }, 5000)
    expect(await d.find({ app: APP, role: 'password text', name: 'API key', states: ['showing'] })).toEqual(
      [],
    )
    await daemon.client.call('updateSettings', { body: { llm: { provider: 'anthropic' } } })
    await d.findOne({ app: APP, role: 'password text', name: 'Replace API key', states: ['showing'] }, 5000)

    // retention lives on the Storage page
    await d.click(await d.findOne({ app: APP, role: 'page tab', name: 'Storage', states: ['showing'] }))
    // delete-after-days (set before the dialog first opened) shows its day count
    const spin = await d.findOne(
      { app: APP, role: 'spin button', name: 'Days to keep audio', states: ['showing'] },
      5000,
    )
    expect(spin.value).toBe(14)
    await d.focus(spin)
    await d.pressKeys('Up')
    await d.waitFor(
      async () => (await daemon.client.call('getSettings')).retention.days === 15,
      5000,
      'days=15',
    )
    const audio = await d.findOne({ app: APP, role: 'combo box', name: 'Audio', states: ['showing'] })
    await d.focus(audio)
    await d.pressKeys('Return')
    await d.findOne({ app: APP, role: 'label', name: 'Delete once transcribed', states: ['showing'] })
    await d.pressKeys('Home')
    await d.pressKeys('Down')
    await d.pressKeys('Return')
    await d.waitFor(
      async () => (await daemon.client.call('getSettings')).retention.audio === 'delete-after-transcription',
      5000,
      'retention=delete-after-transcription persisted',
    )
    await gone(d, { app: APP, name: 'Days to keep audio', states: ['showing'] }, 'the day count to hide')
    await d.click(await d.findOne({ app: APP, role: 'switch', name: 'Archive audio', states: ['showing'] }))
    await d.waitFor(
      async () => (await daemon.client.call('getSettings')).retention.archive,
      5000,
      'archive on',
    )
    expect(await unnamedInteractive(d)).toEqual([])
    await capture(d, 'prefs-storage')
    await closeDialog(d)
    await gone(d, { app: APP, role: 'combo box', name: 'Audio' }, 'Preferences to close')
  })

  it('About (from the main menu) credits Granola plainly and links the third-party notices', async () => {
    await d.click(
      await d.findOne({ app: APP, role: 'toggle button', name: 'Main menu', states: ['showing'] }),
    )
    await d.click(
      await d.findOne({ app: APP, role: 'button', name: 'About gnomeola', states: ['showing'] }, 5000),
    )
    await d.findOne({ app: APP, role: 'dialog', name: 'About' }, 10_000)
    await d.findOne({ app: APP, role: 'label', name: '0.1.0' })
    await capture(d, 'about')
    // AdwAboutDialog shows `comments` on its Details page
    // its rows have no AT-SPI action: activate them as a keyboard user does
    await d.focus(await d.findOne({ app: APP, role: 'list item', name: 'Details', states: ['showing'] }))
    await d.pressKeys('Return')
    const credit = await d.findOne({
      app: APP,
      role: 'label',
      nameContains: 'independent clean-room project inspired by Granola',
    })
    expect(credit.name).toContain('It is not affiliated with or endorsed by Granola.')
    await d.findOne({ app: APP, nameContains: 'Third-Party Notices' })
    await capture(d, 'about-details')
    await d.pressKeys('Escape') // back to the main page
    await d.findOne({ app: APP, role: 'list item', name: 'Legal', states: ['showing'] }, 5000)
    // Legal: GPL-3.0-or-later and the bundled component list
    await d.focus(await d.findOne({ app: APP, role: 'list item', name: 'Legal', states: ['showing'] }))
    await d.pressKeys('Return')
    await d.findOne(
      { app: APP, role: 'label', nameContains: 'GNU General Public License', states: ['showing'] },
      5000,
    )
    await d.findOne({ app: APP, role: 'label', nameContains: '@gtkx/react 1.6.0 — MPL-2.0' }, 5000)
    await capture(d, 'about-legal')
    await d.pressKeys('Escape')
    await d.pressKeys('Escape')
    await gone(d, { app: APP, role: 'dialog', name: 'About' }, 'About to close')
  })

  it('every screen in the main window is keyboard reachable: Tab lands on each control in order', async () => {
    await openTab(d, 'Ask')
    const seen: string[] = []
    for (let i = 0; i < 30; i++) {
      await d.pressKeys('Tab')
      const f = await d.find({ app: APP, states: ['focused'] })
      if (f[0]) seen.push(`${f[0].role}:${f[0].name}`)
    }
    for (const want of [
      'button:Record',
      'toggle button:Main menu',
      'entry:Search sessions',
      'page tab:Ask',
      'text:Question',
    ]) {
      expect(seen, `Tab order: ${seen.join(' → ')}`).toContain(want)
    }
    // nothing focusable is unnamed
    expect(seen.filter((s) => s.endsWith(':'))).toEqual([])
  })

  it('still explains a key-less daemon after the key is removed', async () => {
    await d.pressKeys('Control_L', ',')
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Remove', states: ['showing'] }, 10_000))
    await d.waitFor(
      async () => !(await daemon.client.call('getSettings')).llm.apiKeyConfigured,
      5000,
      'the key to be removed',
    )
    await d.findOne({ app: APP, role: 'label', name: 'Not configured', states: ['showing'] })
    await closeDialog(d)
  })
})

describe('first-run onboarding (slow fake model downloads)', () => {
  let d: HeadlessDisplay
  let daemon: DaemonHandle

  beforeAll(async () => {
    buildUi()
    daemon = await startDaemon({
      entry: join(import.meta.dirname, '..', 'src', 'slow-models-daemon.ts'),
      env: { GNOMEOLA_E2E_MODEL_STEP_MS: '700' },
    })
    d = await startHeadlessDisplay({ size: '1280x800' })
  })

  afterAll(async () => {
    await d?.close()
    await daemon?.stop()
  })

  it('opens on first run, downloads the missing model with live progress, and is remembered', async () => {
    const statePath = join(d.env.XDG_STATE_HOME!, 'gnomeola', 'ui-state.json')
    expect(existsSync(statePath)).toBe(false)
    const app = launchUi(d, { GNOMEOLA_URL: daemon.baseUrl })
    await waitForWindow(d, app)
    await d.findOne({ app: APP, role: 'dialog', name: 'Welcome to gnomeola' }, 15_000)
    // every required model, with its size and state
    const models = (await daemon.client.call('listModels')).models
    for (const m of models) {
      await d.findOne({ app: APP, role: 'list item', name: m.title })
    }
    const whisper = models.find((m) => m.state === 'missing')!
    const subtitle = async () =>
      (await d.find({ app: APP, role: 'label', nameContains: 'Accurate transcription · 1 MB' }))[0]?.name ??
      ''
    expect(await subtitle()).toBe('Accurate transcription · 1 MB · Not downloaded')
    await d.findOne({ app: APP, role: 'label', name: 'Available (fake)' }) // capture check from health()
    expect(await unnamedInteractive(d)).toEqual([])
    await capture(d, 'onboarding')

    await d.click(
      await d.findOne({ app: APP, role: 'button', name: 'Download all models', states: ['showing'] }),
    )
    // progress arrives through model.progress events: watch several distinct values go by
    const seen = new Set<string>()
    const bars = new Set<number>()
    await d.waitFor(
      async () => {
        const s = await subtitle()
        const m = /Downloading… (\d+)%/.exec(s)
        if (m) seen.add(m[1]!)
        const bar = (
          await d.find({ app: APP, role: 'progress bar', name: `${whisper.title} download progress` })
        )[0]
        if (bar?.value !== undefined) bars.add(Math.round(bar.value * 100))
        if (seen.size === 2) await capture(d, 'onboarding-progress')
        return s.endsWith('· Ready')
      },
      20_000,
      'the download to finish',
    )
    expect([...seen].map(Number).filter((p) => p > 0 && p < 100).length).toBeGreaterThanOrEqual(2)
    expect([...bars].filter((p) => p > 0 && p < 100).length).toBeGreaterThanOrEqual(1)
    expect((await daemon.client.call('listModels')).models.every((m) => m.state === 'ready')).toBe(true)

    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Done', states: ['showing'] }))
    await gone(d, { app: APP, role: 'dialog', name: 'Welcome to gnomeola' }, 'onboarding to close')
    expect(JSON.parse(readFileSync(statePath, 'utf8'))).toEqual({
      version: 1,
      onboardingDone: true,
      skippedMissing: [],
    })
    // nothing missing: no banner
    expect(await d.find({ app: APP, nameContains: 'not downloaded yet' })).toEqual([])

    // remembered: a second launch goes straight to the window
    await app.stop()
    const again = launchUi(d, { GNOMEOLA_URL: daemon.baseUrl })
    await waitForWindow(d, again)
    await d.findOne({ app: APP, role: 'label', name: 'No Sessions Yet' }, 10_000)
    await new Promise((r) => setTimeout(r, 2000))
    expect(await d.find({ app: APP, role: 'dialog', name: 'Welcome to gnomeola' })).toEqual([])
    await again.stop()
  })
})

describe('onboarding skipped', () => {
  let d: HeadlessDisplay
  let daemon: DaemonHandle

  afterAll(async () => {
    await d?.close()
    await daemon?.stop()
  })

  it('remembers the skip, shows a banner for the missing model, and the banner reopens it', async () => {
    buildUi()
    daemon = await startDaemon()
    d = await startHeadlessDisplay({ size: '1280x800' })
    const app = launchUi(d, { GNOMEOLA_URL: daemon.baseUrl })
    await waitForWindow(d, app)
    await d.findOne({ app: APP, role: 'dialog', name: 'Welcome to gnomeola' }, 15_000)
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Skip for Now', states: ['showing'] }))
    await gone(d, { app: APP, role: 'dialog', name: 'Welcome to gnomeola' }, 'onboarding to close')
    const state = JSON.parse(readFileSync(join(d.env.XDG_STATE_HOME!, 'gnomeola', 'ui-state.json'), 'utf8'))
    expect(state).toEqual({ version: 1, onboardingDone: true, skippedMissing: ['whisper-small.en'] })
    const banner = await d.findOne({
      app: APP,
      nameContains: 'A speech model is not downloaded yet',
      states: ['showing'],
    })
    await capture(d, 'onboarding-skipped-banner')
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Set Up', within: banner }))
    await d.findOne({ app: APP, role: 'dialog', name: 'Welcome to gnomeola' }, 5000)
    // Escape counts as skipping again
    await d.pressKeys('Escape')
    await gone(d, { app: APP, role: 'dialog', name: 'Welcome to gnomeola' }, 'onboarding to close')
  })
})
