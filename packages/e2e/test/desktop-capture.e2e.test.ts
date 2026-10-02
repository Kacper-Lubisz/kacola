import type { AnyEvent, DurableEvent, Segment } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import {
  buildDesktop,
  type DesktopApp,
  launchDesktop,
  waitForDaemon,
  waitForLog,
} from '@gnomeola/testkit/desktop'
import { loadFixture } from '@gnomeola/testkit/fixtures'
import { assertNoViolations, checkEventLog, checkSegments } from '@gnomeola/testkit/invariants'
import { compareToBaseline, readBaseline, wer } from '@gnomeola/testkit/metrics'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { markOnboarded } from '../src/desktop.ts'

// P-7 in-app capture (the macOS recording path), on Linux: the daemon records with the `external`
// backend, so the app itself captures. Chromium's fake capture device plays the fixture meeting's mic
// track (--use-fake-device-for-media-stream --use-file-for-fake-audio-capture) into the hidden capture
// window's getUserMedia; its AudioWorklet cuts 16 kHz s16 frames, main streams them to the daemon's
// ingest route, and the production models transcribe. The recording is started and stopped with the
// window's own Record / Stop buttons.
//
// Only the mic track can be fed this way: Linux Chromium has no loopback getDisplayMedia, so the system
// track waits unfed (the daemon records it as a disconnected gap). The system-track ingest path is the
// daemon-level external-capture e2e's subject (external-capture.e2e.test.ts).

const FIXTURE = loadFixture('standup-2p')
const BASELINE =
  'pipeline_live=live-nemo-fastconformer-en-80ms-int8+final=final-parakeet-tdt-110m-en-int8+pass=during'

let display: HeadlessDisplay
let markerId = ''
let daemon: DaemonHandle
let app: DesktopApp
let segments: Segment[] = []
let durationMs = 0
const durable: DurableEvent[] = []
let levelEvents = 0

beforeAll(async () => {
  buildDesktop()
  display = await startHeadlessDisplay({ size: '1280x800' })
  markerId = display.env.GNOMEOLA_HEADLESS_ID!
  markOnboarded(display)
  daemon = await startDaemon({ fake: false, env: { GNOMEOLA_CAPTURE: 'external' } })
  app = await launchDesktop({
    display,
    env: { GNOMEOLA_URL: daemon.baseUrl },
    args: [
      '--use-fake-device-for-media-stream',
      // %noloop: play the meeting once (Chromium's fake device loops the file by default)
      `--use-file-for-fake-audio-capture=${FIXTURE.wavPath('mic')}%noloop`,
    ],
  })
}, 240_000)

afterAll(async () => {
  await app?.close()
  await daemon?.stop()
  if (display) {
    await display.close()
    expect(markedPids(markerId)).toEqual([])
  }
}, 60_000)

describe('recording through the app’s own capture (daemon backend: external)', () => {
  it('attaches to a daemon with the external backend; no capture window until something records', async () => {
    await waitForDaemon(app, 'attached')
    expect((await daemon.client.call('health')).capture.backend).toBe('external')
    expect(await app.evaluateMain(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
  })

  it('Record → the fixture meeting streams from the capture window → Stop; levels show while recording', async () => {
    const ac = new AbortController()
    const events = daemon.client.subscribe({
      since: (await daemon.client.call('health')).lastSeq,
      signal: ac.signal,
      onEvent: (e: AnyEvent) => {
        if (e.seq !== null) durable.push(e as DurableEvent)
        else if (e.data.type === 'audio.level' && e.data.track === 'mic') levelEvents++
      },
    })
    await app.window.getByRole('button', { name: 'New recording', exact: true }).click()
    const running = await waitForLog(
      app,
      /"event":"capture","kind":"state","track":"mic","state":"running"/,
      20_000,
    )
    const t0 = Date.now()
    expect(JSON.parse(running)).toMatchObject({ sampleRate: 16_000, label: expect.any(String) })
    // Linux: the mic only (no loopback system audio in Linux Chromium)
    const starts = app
      .log()
      .split('\n')
      .filter((l) => l.includes('"event":"capture","kind":"start"'))
    expect(starts.map((l) => JSON.parse(l).track)).toEqual(['mic'])
    // the hidden capture window: never shown, never focusable
    expect(
      await app.evaluateMain(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().map((w) => ({ visible: w.isVisible(), title: w.getTitle() })),
      ),
    ).toEqual(
      expect.arrayContaining([
        { visible: false, title: expect.stringMatching(/^(kacola|gnomeola) capture$/) },
      ]),
    )
    // the live page: the recording pill runs, and the quiet "can't hear you" line never shows while
    // the fixture is heard (no level meters any more: levels only feed that warning). The system track
    // is unfed here (no loopback in Linux Chromium), so "can't hear the other side" may rightly appear.
    await app.window.getByRole('timer', { name: /^Recording, / }).waitFor({ timeout: 10_000 })
    while (Date.now() - t0 < FIXTURE.truth.durationMs + 2_000) {
      expect(await app.window.getByText(/can’t hear (you|anyone)/).count()).toBe(0)
      await new Promise((r) => setTimeout(r, 500))
    }
    await app.window.getByRole('button', { name: 'Stop', exact: true }).first().click()
    await waitFor(
      async () =>
        durable.some((e) => e.data.type === 'session.upserted' && e.data.session.status === 'stopped'),
      30_000,
      'the recording to stop',
    )
    const sessionId = durable.find((e) => e.data.type === 'session.upserted')!
    const id = (sessionId.data as { session: { id: string } }).session.id
    const stopped = await daemon.client.call('getSession', { params: { id } })
    durationMs = stopped.durationMs
    // the final pass runs during the recording; give the last segments a moment to settle
    await new Promise((r) => setTimeout(r, 2_000))
    ac.abort()
    await events
    segments = (await daemon.client.call('getTranscript', { params: { id } })).segments
    const mic = stopped.tracks.find((t) => t.kind === 'mic')!
    expect(mic.audioPath).toBeTruthy()
    // nothing lost on the way but the start-up latency (capture window + getUserMedia)
    expect(mic.gaps.filter((g) => g.reason !== 'latency')).toEqual([])
    expect(levelEvents, 'mic audio.level events').toBeGreaterThan(FIXTURE.truth.durationMs / 100 / 2)
    assertNoViolations(checkSegments(segments, { durationMs, requireFinal: true }), 'final transcript')
    assertNoViolations(checkEventLog(durable, durable[0]!.seq - 1), 'durable stream')
  }, 180_000)

  it('the mic transcript is as accurate as the committed baseline', () => {
    const text = segments
      .filter((s) => s.track === 'mic')
      .sort((a, b) => a.startMs - b.startMs)
      .map((s) => s.text)
      .join(' ')
    const mic = wer(FIXTURE.reference('mic'), text)
    console.log(`[in-app capture] mic WER ${(mic.wer * 100).toFixed(1)}% over ${mic.refWords} words`)
    const base = readBaseline('standup-2p', BASELINE)
    expect(base).not.toBeNull()
    const c = compareToBaseline(
      { ...base!, metrics: { wer_mic: base!.metrics.wer_mic! } },
      { wer_mic: mic.wer },
    )
    expect(c.failures).toEqual([])
  })

  it('attributes by track: every mic segment is me; the unfed system track has none', () => {
    expect(segments.filter((s) => s.track === 'mic').length).toBeGreaterThan(3)
    expect(new Set(segments.filter((s) => s.track === 'mic').map((s) => s.speaker))).toEqual(new Set(['me']))
    expect(segments.filter((s) => s.track === 'system')).toEqual([])
  })

  it('no console errors, CSP violations or page errors in the window', () => {
    expect(app.problems()).toEqual([])
  })
})
