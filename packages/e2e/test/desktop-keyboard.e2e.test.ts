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
// and stop, go Back to Today, find a meeting, open Ask and the transcript, ask a question, follow a
// citation into the transcript, enhance the notes and go back to the draft — each step with shortcuts, Tab / Shift+Tab, arrows, Enter and Space,
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
    await w().getByRole('searchbox', { name: 'Search or ask' }).waitFor({ timeout: 20_000 })
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
    await w()
      .getByRole('timer', { name: /^Recording/ })
      .waitFor()
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
    // the page moves on to the outcome by itself
    await w().getByRole('region', { name: 'Outcome' }).waitFor({ timeout: 10_000 })
  })

  it('goes Back to Today, finds a meeting with Ctrl+F and opens it with Tab and Enter', async () => {
    await tabTo(/^button:Back to Today$/, { reverse: true, max: 40 })
    await key('Enter')
    await w().getByRole('searchbox', { name: 'Search or ask' }).waitFor()
    await key('Control+f')
    expect(await focused()).toBe('searchbox:Search or ask')
    await w().keyboard.type('Quarterly')
    trail.push('type "Quarterly"')
    await w()
      .getByRole('list', { name: 'Moments' })
      .getByRole('button', { name: /^Quarterly planning/ })
      .first()
      .waitFor()
    expect(await tabTo(/^button:Quarterly planning/)).toMatch(/^button:Quarterly planning/)
    await key('Enter')
    await w().getByRole('heading', { level: 1, name: 'Quarterly planning' }).waitFor({ timeout: 10_000 })
    expect(w().url()).toContain(`/sessions/${SEED.long}`)
  })

  it('opens and closes Ask (Ctrl+K) and the transcript (Ctrl+T, or its toggle with Space)', async () => {
    await key('Control+k')
    await poll(
      async () => /^textbox:Ask about this meeting/.test(await focused()),
      5000,
      'the Ask bar focused',
    )
    await key('Escape')
    await w().getByRole('region', { name: 'Ask about this meeting' }).waitFor({ state: 'detached' })
    await key('Control+t')
    await w().getByRole('listbox', { name: 'Transcript' }).waitFor({ timeout: 10_000 })
    await key('Control+t')
    await w().getByRole('listbox', { name: 'Transcript' }).waitFor({ state: 'detached' })
    // the header's Transcript toggle, reached with Tab
    await tabTo(/^button:Transcript$/, { reverse: true, max: 40 })
    await key('Space')
    await w().getByRole('listbox', { name: 'Transcript' }).waitFor({ timeout: 10_000 })
    await key('Space')
    await w().getByRole('listbox', { name: 'Transcript' }).waitFor({ state: 'detached' })
  })

  it('asks a question from the Ask bar and follows a citation with Enter; the answer stays', async () => {
    await key('Control+k')
    await poll(
      async () => /^textbox:Ask about this meeting/.test(await focused()),
      5000,
      'the Ask bar focused',
    )
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
    // back up from the box to the answer's second chip
    await tabTo(new RegExp(`^button:${chip2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), { reverse: true })
    await key('Enter')
    await w().getByRole('listbox', { name: 'Transcript' }).waitFor({ timeout: 10_000 })
    await poll(
      async () => JSON.stringify(await selectedRowNames(w())) === JSON.stringify([rowName(cited[1]!)]),
      5000,
      'the cited line selected',
    )
    // following the citation never loses the answer
    await w().getByRole('button', { name: chip2, exact: true }).waitFor()
    await key('Control+k')
    await w().getByRole('region', { name: 'Ask about this meeting' }).waitFor({ state: 'detached' })
  })

  it('enhances the notes (it replaces the draft) and goes back to the draft, from the keyboard', async () => {
    await w().getByRole('textbox', { name: 'Notes' }).waitFor({ timeout: 10_000 })
    // some notes of our own first: the editor takes the keyboard
    await tabTo(/^textbox:Notes/, { max: 60 })
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
    const merged = await poll(
      async () =>
        (await daemon.client.call('listNoteVersions', { params: { id: SEED.long } })).versions.find(
          (v) => v.kind === 'merge',
        ),
      20_000,
      'the enhanced notes applied',
    )
    expect(merged.merge?.choices.every((c) => c === 'enhanced')).toBe(true)
    // undo through the history: Back to my draft restores what was typed
    await w().getByRole('button', { name: 'Back to my draft' }).waitFor({ timeout: 10_000 })
    await tabTo(/^button:Back to my draft$/, { reverse: true })
    await key('Enter')
    const restored = await poll(
      async () =>
        (await daemon.client.call('listNoteVersions', { params: { id: SEED.long } })).versions.find(
          (v) => v.kind === 'restore',
        ),
      10_000,
      'the draft restored',
    )
    expect(restored.markdown).toContain('ana owns the dashboard')
    await w().getByRole('textbox', { name: 'Notes' }).waitFor({ timeout: 10_000 })
    expect(app.problems()).toEqual([])
    console.log(`keyboard walkthrough: ${trail.length} keyboard steps`)
  })
})
