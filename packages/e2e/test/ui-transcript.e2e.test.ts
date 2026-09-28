import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { formatOffset, type Segment } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import {
  type AccessibleNode,
  type AppHandle,
  type HeadlessDisplay,
  markedPids,
  pngInfo,
  startHeadlessDisplay,
} from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SEED, seedMeetings } from '../src/seed.ts'
import {
  APP,
  buildUi,
  capture,
  launchUi,
  logTail,
  markOnboarded,
  perfLines,
  unnamedInteractive,
  waitForWindow,
} from '../src/ui.ts'

// V-9a / T-6: the transcript view in the real window, against the real daemon (child process, fake
// capture + STT pipeline), asserted through AT-SPI. Every transcript line is a GtkListView row whose
// accessible name is "<Speaker> at <m:ss>: <text>", suffixed " (provisional)" for a live-quality
// segment and " (in progress)" for the partial line.

// Audio runs 4x wall clock: a segment closes every 2.5 s of audio per track (≈0.6 s wall), partials
// every 250 ms of audio, and a live segment is re-emitted as final 1.5 s (wall) after it closes — long
// enough to see a provisional line and watch it be replaced.
const PIPELINE = { speed: 4, segmentEveryMs: 2500, partialEveryMs: 250, finalizeAfterMs: 1500, tickMs: 20 }

const speakerName = (s: string) => (s === 'me' ? 'Me' : s === 'them' ? 'Them' : s)
const rowName = (s: Pick<Segment, 'speaker' | 'startMs' | 'text'>) =>
  `${speakerName(s.speaker)} at ${formatOffset(s.startMs)}: ${s.text}`

async function transcriptRows(d: HeadlessDisplay): Promise<AccessibleNode[]> {
  const list = await d.findOne({ app: APP, role: 'list', name: 'Transcript', states: ['showing'] })
  const tree = await d.describe(list, true)
  return (tree.children ?? []).filter((c) => c.role === 'list item')
}

const rowNames = async (d: HeadlessDisplay) => (await transcriptRows(d)).map((r) => r.name)

describe('transcript view against the real daemon', () => {
  let d: HeadlessDisplay
  let daemon: DaemonHandle
  let app: AppHandle
  let dataDir: string
  let markerId: string

  beforeAll(async () => {
    buildUi()
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-ui-e2e-'))
    seedMeetings(dataDir)
    daemon = await startDaemon({
      dataDir,
      env: { GNOMEOLA_FAKE_PIPELINE: JSON.stringify(PIPELINE) },
    })
    d = await startHeadlessDisplay({ size: '1280x800' })
    markerId = d.env.GNOMEOLA_HEADLESS_ID!
    markOnboarded(d)
    app = launchUi(d, { GNOMEOLA_URL: daemon.baseUrl, GNOMEOLA_UI_PERF: '1' })
    await waitForWindow(d, app)
  })

  afterAll(async () => {
    await d?.close()
    await daemon?.stop()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('renders a seeded transcript as speaker-labelled, timestamped lines from getTranscript', async () => {
    await d.click(await d.findOne({ app: APP, role: 'list item', name: 'Platform standup' }))
    await d.findOne({ app: APP, role: 'heading', name: 'Platform standup' })
    const { segments } = await daemon.client.call('getTranscript', { params: { id: SEED.standup } })
    const expected = segments.map((s) => rowName(s) + (s.quality === 'live' ? ' (provisional)' : ''))
    await d.waitFor(
      async () => JSON.stringify(await rowNames(d)) === JSON.stringify(expected),
      10_000,
      'the standup rows',
    )
    // the last standup line is still live-quality in the seed: visibly provisional
    expect((await rowNames(d)).at(-1)).toBe('Me at 7:00: Okay, that is everything, thanks all. (provisional)')
    // speaker grouping: a "Them" label heads the first system line, not every one of its run
    const labels = (await d.find({ app: APP, role: 'label', name: 'Them', states: ['showing'] })).length
    expect(labels).toBe(2) // runs at 1:06-2:00 and 3:04-5:00
    expect(await unnamedInteractive(d)).toEqual([])
    await capture(d, 'transcript-seeded')
  })

  it('renders the 1,350-line meeting quickly and scrolls it end to end from the keyboard', async () => {
    await d.click(await d.findOne({ app: APP, role: 'list item', name: 'Quarterly planning' }))
    await d.findOne({
      app: APP,
      role: 'list item',
      nameContains: 'Planning item 0:',
      states: ['showing'],
    })
    // only the visible rows exist as widgets: that is what keeps a long meeting responsive
    const visible = await transcriptRows(d)
    expect(visible.length).toBeGreaterThan(5)
    expect(visible.length).toBeLessThan(60)
    // the app's own measurement: snapshot in hand → list model committed
    const commit = perfLines(app).filter((p) => p.perf === 'transcript.commit' && p.rows === 1350)
    expect(commit).toHaveLength(1)
    expect(commit[0]!.ms as number).toBeLessThan(250)

    const list = await d.findOne({ app: APP, role: 'list', name: 'Transcript', states: ['showing'] })
    // reverse Tab: forward would cross the sidebar list, whose selection follows focus
    await d.focusInto(list, { reverse: true })
    const t0 = Date.now()
    await d.pressKeys('End')
    await d.findOne(
      { app: APP, role: 'list item', nameContains: 'Planning item 1349:', states: ['showing'] },
      5000,
    )
    const toEnd = Date.now() - t0
    await capture(d, 'transcript-long-end')
    await d.pressKeys('Home')
    await d.findOne(
      { app: APP, role: 'list item', nameContains: 'Planning item 0:', states: ['showing'] },
      5000,
    )
    // PageDown moves through it without stalls
    const t1 = Date.now()
    for (let i = 0; i < 10; i++) await d.pressKeys('Page_Down')
    await d.waitFor(
      async () => (await rowNames(d)).some((n) => /Planning item (1\d\d|[2-9]\d):/.test(n)),
      5000,
      'ten pages down',
    )
    const tenPages = Date.now() - t1
    console.log(`long transcript: commit ${commit[0]!.ms} ms, End ${toEnd} ms, 10×PageDown ${tenPages} ms`)
    expect(toEnd).toBeLessThan(3000)
    if (app.hasExited()) throw new Error(logTail(app))
  })

  it('shows a live recording: partial line, provisional segments replaced in place by final ones', async () => {
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Record', states: ['showing'] }))
    const session = await d.waitFor(
      async () =>
        (await daemon.client.call('listSessions', { query: {} })).sessions.find(
          (s) => s.status === 'recording',
        ),
      10_000,
      'the daemon to report a recording session',
    )
    await d.findOne({ app: APP, role: 'heading', name: session.title })

    // the in-progress line, fed by transcript.partial, grows while its speaker talks
    const partialNames = new Set<string>()
    await d.waitFor(
      async () => {
        for (const n of await rowNames(d)) if (n.endsWith('(in progress)')) partialNames.add(n)
        return partialNames.size >= 3
      },
      15_000,
      'three different partial lines',
    )

    // a provisional (live-quality) line appears, then the same line — same speaker, same time — is
    // replaced by its final text, without a second row appearing for it
    const provisional = await d.waitFor(
      async () => (await rowNames(d)).find((n) => n.endsWith('(provisional)')),
      15_000,
      'a provisional line',
    )
    await capture(d, 'transcript-live')
    const prefix = provisional.slice(0, provisional.indexOf(': ') + 2)
    const finalName = await d.waitFor(
      async () => {
        const same = (await rowNames(d)).filter((n) => n.startsWith(prefix))
        if (same.length > 1) throw new Error(`two rows for one segment: ${JSON.stringify(same)}`)
        return same.length === 1 && !same[0]!.endsWith('(provisional)') ? same[0] : null
      },
      15_000,
      'the provisional line to become final',
    )
    // the final text is the tier-2 revision the daemon holds (the fake capitalises and adds a stop)
    const { segments } = await daemon.client.call('getTranscript', { params: { id: session.id } })
    const seg = segments.find((s) => rowName(s) === finalName)
    expect(seg, `${finalName} must be a segment the daemon holds`).toBeDefined()
    expect(seg!.quality).toBe('final')
    expect(seg!.revision).toBeGreaterThanOrEqual(2)
    expect(await unnamedInteractive(d)).toEqual([])
  })

  it('follows live output, stops following when scrolled up, and Jump to Live brings it back', async () => {
    // enough lines to scroll
    await d.waitFor(async () => (await rowNames(d)).length >= 10, 30_000, 'a screenful of lines')
    const list = await d.findOne({ app: APP, role: 'list', name: 'Transcript', states: ['showing'] })
    // following: the newest (partial) line stays on screen as lines are added
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 700))
      const names = await rowNames(d)
      expect(names.at(-1)!).toMatch(/\((in progress|provisional)\)$|\.$/)
    }
    expect(await d.find({ app: APP, role: 'button', name: 'Jump to Live', states: ['showing'] })).toEqual([])

    await d.focusInto(list, { reverse: true })
    await d.pressKeys('Home')
    const jump = await d.findOne(
      { app: APP, role: 'button', name: 'Jump to Live', states: ['showing'] },
      5000,
    )
    // not following: new lines arrive but the view stays at the top
    const top = (await rowNames(d))[0]
    await new Promise((r) => setTimeout(r, 1500))
    expect((await rowNames(d))[0]).toBe(top)
    await capture(d, 'transcript-jump-to-live')

    await d.click(jump)
    await d.waitFor(
      async () => (await rowNames(d)).some((n) => n.endsWith('(in progress)')),
      5000,
      'the live end back in view',
    )
    await d.waitFor(
      async () =>
        (await d.find({ app: APP, role: 'button', name: 'Jump to Live', states: ['showing'] })).length === 0,
      5000,
      'the Jump to Live button to go away',
    )
  })

  it('stops: the partial line goes, every line becomes final, and it matches the daemon', async () => {
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Stop', states: ['showing'] }))
    await d.findOne({ app: APP, role: 'button', name: 'Record', states: ['showing'] })
    const session = (await daemon.client.call('listSessions', { query: {} })).sessions[0]!
    expect(session.status).toBe('stopped')
    const { segments } = await daemon.client.call('getTranscript', { params: { id: session.id } })
    expect(segments.length).toBeGreaterThan(10)
    expect(segments.every((s) => s.quality === 'final')).toBe(true)
    await d.waitFor(
      async () => {
        const names = await rowNames(d)
        return (
          names.length > 0 &&
          names.every((n) => !n.endsWith('(in progress)') && !n.endsWith('(provisional)')) &&
          names.at(-1) === rowName(segments.at(-1)!)
        )
      },
      10_000,
      'a final, complete transcript ending in the daemon’s last segment',
    )
    const shot = await capture(d, 'transcript-stopped')
    expect(pngInfo(shot)).toMatchObject({ width: 1280, height: 800 })
    if (app.hasExited()) throw new Error(logTail(app))
  })
})
