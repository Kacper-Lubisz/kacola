import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { formatOffset } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { markOnboarded } from '../src/desktop.ts'
import { poll, rowName, selectedRowNames, speakerName } from '../src/desktop-ui.ts'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { SEED, seedMeetings } from '../src/seed.ts'

// A keyboard-only walkthrough of the window against the real daemon: no pointer event at all. Record
// and stop, find a meeting, switch tabs, ask a question, follow a citation into the transcript, enhance
// the notes and apply the review — each step with shortcuts, Tab / Shift+Tab, arrows, Enter and Space,
// and each checked against the daemon. The focus is asserted by role and name at every stop, so a
// control that cannot be reached (or is reached unnamed) fails here.

const CASSETTES = join(import.meta.dirname, '..', '..', 'llm', 'test', 'fixtures', 'cassettes')
const KEY = 'sk-ant-e2e-keyboard-planted-key-0000'
const PIPELINE = { speed: 4, segmentEveryMs: 1500, partialEveryMs: 250, finalizeAfterMs: 300, tickMs: 20 }

describe('keyboard-only walkthrough against the real daemon', () => {
  let display: HeadlessDisplay
  let daemon: DaemonHandle
  let api: FakeAnthropic
  let app: DesktopApp
  let dataDir: string
  let markerId = ''
  const trail: string[] = []

  const w = () => app.window
  const key = async (k: string) => {
    await w().keyboard.press(k)
    trail.push(k)
  }
  /** The focused element as "role:name" (the accessible name, or its label). */
  const focused = async (): Promise<string> =>
    (await w().evaluate(`(() => {
      let e = document.activeElement
      // into shadow roots (the notes editor lives in one)
      while (e && e.shadowRoot && e.shadowRoot.activeElement) e = e.shadowRoot.activeElement
      if (!e || e === document.body) return 'body:'
      const role = e.getAttribute('role') || (e.tagName === 'TEXTAREA' ? 'textbox' : e.tagName === 'INPUT' ? (e.type === 'search' ? 'searchbox' : 'textbox') : e.tagName.toLowerCase())
      const labelled = e.getAttribute('aria-labelledby')
      const name = e.getAttribute('aria-label')
        || (labelled && labelled.split(' ').map((id) => document.getElementById(id)?.textContent || '').join(' ').trim())
        || (e.labels && e.labels[0] && e.labels[0].textContent)
        || e.textContent || ''
      return role + ':' + name.trim().replace(/\\s+/g, ' ').slice(0, 80)
    })()`)) as string
  /** Press Tab (or Shift+Tab) until the focus matches `want`; fails listing the stops it made. */
  const tabTo = async (want: RegExp, o: { reverse?: boolean; max?: number } = {}) => {
    const stops: string[] = []
    for (let i = 0; i < (o.max ?? 25); i++) {
      const f = await focused()
      if (want.test(f)) return f
      stops.push(f)
      await key(o.reverse ? 'Shift+Tab' : 'Tab')
    }
    const f = await focused()
    if (want.test(f)) return f
    throw new Error(`Tab never reached ${want}; stops: ${[...stops, f].join(' → ')}`)
  }
  const tabSelected = async (name: string) =>
    (await w().getByRole('tab', { name }).getAttribute('aria-selected')) === 'true'

  beforeAll(async () => {
    buildDesktop()
    api = await startFakeAnthropic({ eventDelayMs: 50 })
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-keyboard-'))
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
    display = await startHeadlessDisplay({ size: '1280x800' })
    markerId = display.env.GNOMEOLA_HEADLESS_ID!
    markOnboarded(
      display,
      (await daemon.client.call('listModels')).models.map((m) => m.id),
    )
    app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: daemon.baseUrl, GNOMEOLA_COLOR_SCHEME: 'light' },
    })
    await w().getByRole('listbox', { name: 'Sessions' }).waitFor({ timeout: 20_000 })
    // from here on the tests use only keyboard.press / keyboard.type — no click, hover or mouse call
  }, 240_000)

  afterAll(async () => {
    await app?.close()
    await display?.close()
    await daemon?.stop()
    await api?.close()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('records and stops with Ctrl+R', async () => {
    await key('Control+r')
    const live = await poll(
      async () =>
        (await daemon.client.call('listSessions', { query: {} })).sessions.find(
          (s) => s.status === 'recording',
        ),
      10_000,
      'a recording started from the keyboard',
    )
    await w().getByRole('heading', { level: 1, name: live.title }).waitFor({ timeout: 10_000 })
    await poll(
      async () =>
        (await daemon.client.call('getTranscript', { params: { id: live.id } })).segments.length >= 2,
      15_000,
      'something said',
    )
    await key('Control+r')
    await poll(
      async () => (await daemon.client.call('getSession', { params: { id: live.id } })).status === 'stopped',
      10_000,
      'stopped from the keyboard',
    )
    await w().getByRole('button', { name: 'Record', exact: true }).waitFor()
  })

  it('finds a meeting from the search field and opens it with the arrows and Enter', async () => {
    // Ctrl+F searches what has the focus: inside the (just recorded) transcript it is the transcript's
    // own search; Escape closes it and Shift+Tab walks back to the sidebar's search field
    await key('Control+f')
    if ((await focused()) === 'textbox:Search the transcript') {
      await key('Escape')
      await tabTo(/^searchbox:Search sessions$/, { reverse: true, max: 40 })
    }
    expect(await focused()).toBe('searchbox:Search sessions')
    await w().keyboard.type('Quarterly')
    trail.push('type "Quarterly"')
    await w()
      .getByRole('listbox', { name: 'Sessions' })
      .getByRole('option', { name: /Quarterly planning/ })
      .waitFor()
    expect(await tabTo(/^option:Quarterly planning/)).toMatch(/^option:Quarterly planning/)
    await key('Enter')
    await w().getByRole('heading', { level: 1, name: 'Quarterly planning' }).waitFor({ timeout: 10_000 })
    expect(w().url()).toContain(`/sessions/${SEED.long}`)
  })

  it('switches tabs with Ctrl+2 and with the arrow keys on the tab list', async () => {
    await key('Control+2')
    await poll(() => tabSelected('Ask'), 5000, 'the Ask tab')
    await key('Control+1')
    await poll(() => tabSelected('Transcript'), 5000, 'the Transcript tab')
    // Tab reaches the tab list (on the selected tab); the arrows move between tabs
    await tabTo(/^tab:Transcript/, { reverse: true })
    await key('ArrowRight')
    await poll(() => tabSelected('Ask'), 5000, 'Ask by arrow')
    expect(await focused()).toBe('tab:Ask')
  })

  it('asks a question from the composer, reached with Tab, and follows a citation with Enter', async () => {
    await w().getByRole('heading', { name: 'Ask About This Meeting' }).waitFor()
    await tabTo(/^textbox:Question/)
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    await w().keyboard.type('What did we decide about the retry budget?')
    trail.push('type question')
    await key('Enter')
    const answer = await poll(
      async () => {
        const { messages } = await daemon.client.call('getQaHistory', { params: { id: SEED.long } })
        return messages.find((m) => m.role === 'assistant')
      },
      20_000,
      'the answer',
    )
    expect(answer.citations).toHaveLength(2)
    const { segments } = await daemon.client.call('getTranscript', { params: { id: SEED.long } })
    const cited = answer.citations.map((c) => segments.find((s) => s.id === c.segmentId)!)
    const chip2 = `Citation 2: ${speakerName(cited[1]!.speaker)} at ${formatOffset(cited[1]!.startMs)}`
    await w().getByRole('button', { name: chip2, exact: true }).waitFor({ timeout: 10_000 })
    // back up from the composer to the answer's second chip
    await tabTo(new RegExp(`^button:${chip2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), { reverse: true })
    await key('Enter')
    await poll(() => tabSelected('Transcript'), 5000, 'the Transcript tab')
    await poll(
      async () => JSON.stringify(await selectedRowNames(w())) === JSON.stringify([rowName(cited[1]!)]),
      5000,
      'the cited line selected',
    )
  })

  it('enhances the notes and applies the review, from the keyboard', async () => {
    await key('Control+3')
    await poll(() => tabSelected('Notes'), 5000, 'the Notes tab')
    await w().getByRole('textbox', { name: 'Notes' }).waitFor({ timeout: 10_000 })
    // some notes of our own first: the editor takes the keyboard
    await tabTo(/^textbox:Notes/)
    await w().keyboard.type('retry budget three attempts\nana owns the dashboard\n')
    trail.push('type notes')
    await poll(
      async () =>
        (await daemon.client.call('getNotes', { params: { id: SEED.long } })).note.markdown.includes(
          'ana owns',
        ),
      10_000,
      'the typed notes saved',
    )
    api.enqueue(...loadCassette(join(CASSETTES, 'enhance-notes.json')))
    await tabTo(/^button:Enhance Notes$/, { reverse: true })
    await key('Enter')
    await w().getByRole('heading', { name: 'Review Enhanced Notes' }).waitFor({ timeout: 20_000 })
    // choose with Space on a change's switch, then Apply
    const first = await tabTo(/^switch:Use enhanced text for change 1$/)
    expect(first).toBe('switch:Use enhanced text for change 1')
    await key('Space')
    await poll(
      async () =>
        !(await w().getByRole('switch', { name: 'Use enhanced text for change 1', exact: true }).isChecked()),
      5000,
      'change 1 kept as mine',
    )
    await tabTo(/^button:Apply$/, { reverse: true })
    await key('Enter')
    const merged = await poll(
      async () =>
        (await daemon.client.call('listNoteVersions', { params: { id: SEED.long } })).versions.find(
          (v) => v.kind === 'merge',
        ),
      10_000,
      'the merge version',
    )
    expect(merged.merge?.choices).toContain('mine')
    await w().getByRole('textbox', { name: 'Notes' }).waitFor({ timeout: 10_000 })
    expect(app.problems()).toEqual([])
    console.log(`keyboard walkthrough: ${trail.length} keyboard steps`)
  })
})
