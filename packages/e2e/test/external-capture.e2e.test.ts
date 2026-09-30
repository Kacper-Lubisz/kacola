import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type AnyEvent,
  type DurableEvent,
  floatToPcm16,
  type IngestResult,
  ingestPcm,
  type Segment,
  type TrackKind,
} from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { loadFixture } from '@gnomeola/testkit/fixtures'
import {
  assertNoViolations,
  checkEventLog,
  checkSegmentHistory,
  checkSegments,
} from '@gnomeola/testkit/invariants'
import { compareToBaseline, readBaseline, wer } from '@gnomeola/testkit/metrics'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pacedFrames } from '../src/external-client.ts'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { AS_NODE, bundledCli, electronBinary, REPO, testRuntime } from '../src/runtime.ts'

// P-3 on real audio and real models: the macOS recording path, tested on Linux. A stand-in for the
// desktop app streams a fixture meeting's two tracks to the daemon's ingest route in real time (the same
// 16 kHz s16 frames its AudioWorklet produces); the daemon records them through ExternalCaptureSource and
// transcribes with the production models. The meeting runs on the RELEASE runtime — the esbuild bundle
// on Electron 44's Node, with the sherpa-onnx and better-sqlite3 N-API natives and the diarization
// worker beside it — exactly as the .app runs it. Accuracy must hold against the committed baselines
// (packages/testkit/fixtures/baselines), attribution must hold by track, and the audio must be on disk.
// A second daemon (plain Node, from source) takes the chaos: a dropped stream, pause/resume, SIGKILL.

const FIXTURE = loadFixture('standup-2p')
const CASSETTES = join(REPO, 'packages', 'llm', 'test', 'fixtures', 'cassettes')
const BASELINE =
  'pipeline_live=live-nemo-fastconformer-en-80ms-int8+final=final-parakeet-tdt-110m-en-int8+pass=during'
const TRACKS: TrackKind[] = ['mic', 'system']
const pcm = Object.fromEntries(TRACKS.map((t) => [t, floatToPcm16(FIXTURE.pcm(t))])) as Record<
  TrackKind,
  Int16Array
>

const text = (segs: Segment[], track: TrackKind) =>
  segs
    .filter((s) => s.track === track)
    .sort((a, b) => a.startMs - b.startMs)
    .map((s) => s.text)
    .join(' ')

async function waitingFor(d: DaemonHandle, sessionId: string): Promise<void> {
  await waitFor(
    async () =>
      (await d.client.call('externalCaptureStatus')).captures.some((c) => c.sessionId === sessionId),
    5_000,
    'the recording to wait for external audio',
  )
}

let api: FakeAnthropic
beforeAll(async () => {
  api = await startFakeAnthropic()
})
afterAll(async () => {
  await api?.close()
})

describe('a real meeting through external capture, on the bundled Electron runtime', () => {
  let d: DaemonHandle
  let runtime = ''
  let sessionId = ''
  let segments: Segment[] = []
  let durationMs = 0
  let tracks: { kind: string; audioPath: string | null; gaps: { reason: string; durationMs: number }[] }[] =
    []
  const results: Partial<Record<TrackKind, IngestResult>> = {}
  const durable: DurableEvent[] = []
  const levels: Record<TrackKind, number> = { mic: 0, system: 0 }
  let partials = 0

  beforeAll(async () => {
    runtime = (await testRuntime()).outDir
    d = await startDaemon({
      fake: false,
      execPath: electronBinary(),
      entry: join(runtime, 'daemon.mjs'),
      env: {
        ...AS_NODE,
        GNOMEOLA_CAPTURE: 'external',
        ANTHROPIC_API_KEY: 'sk-ant-e2e-external',
        ANTHROPIC_BASE_URL: api.url,
      },
    })
  }, 120_000)
  afterAll(async () => {
    await d?.stop()
  }, 60_000)

  it('reports the external capture backend and never looks for PipeWire', async () => {
    const h = await d.client.call('health')
    expect(h.capture).toEqual({ available: true, backend: 'external', detail: null })
    const devices = (await d.client.call('listDevices')).devices
    expect(devices.map((x) => `${x.kind}:${x.name}`)).toEqual(['source:default', 'sink:default'])
    expect(d.output()).not.toMatch(/pw-record|pw-dump|gjs/)
  })

  it('records both streamed tracks in real time; the transcript satisfies every invariant', async () => {
    const ac = new AbortController()
    const events = d.client.subscribe({
      since: (await d.client.call('health')).lastSeq,
      signal: ac.signal,
      onEvent: (e: AnyEvent) => {
        if (e.seq !== null) durable.push(e as DurableEvent)
        else if (e.data.type === 'transcript.partial') partials++
        else if (e.data.type === 'audio.level') levels[e.data.track as TrackKind]++
      },
    })
    const s = await d.client.call('createSession', { body: { title: 'Standup (external capture)' } })
    sessionId = s.id
    expect((await d.client.call('startSession', { params: { id: s.id } })).status).toBe('recording')
    await waitingFor(d, s.id)
    const t0 = performance.now()
    await Promise.all(
      TRACKS.map(async (track, i) => {
        // rotate each request every 20 s: three reconnects per track over the meeting, all lossless
        results[track] = await ingestPcm({
          baseUrl: d.baseUrl,
          sessionId: s.id,
          track,
          frames: pacedFrames(pcm[track], { epoch: 100 + i, t0 }),
          rotateMs: 20_000,
        })
      }),
    )
    const stopped = await d.client.call('stopSession', { params: { id: s.id } })
    expect(stopped.status).toBe('stopped')
    await new Promise((r) => setTimeout(r, 500))
    ac.abort()
    await events
    durationMs = stopped.durationMs
    tracks = stopped.tracks

    for (const t of TRACKS)
      expect(results[t], t).toEqual({
        frames: expect.any(Number),
        samples: pcm[t].length,
        discarded: 0,
        ended: 'client',
      })
    segments = (await d.client.call('getTranscript', { params: { id: s.id } })).segments
    expect(segments.length).toBeGreaterThan(8)
    assertNoViolations(checkSegments(segments, { durationMs, requireFinal: true }), 'final transcript')
    const history = durable.flatMap((e) => (e.data.type === 'segment.upserted' ? [e.data.segment] : []))
    assertNoViolations(checkSegmentHistory(history), 'segment history over SSE')
    assertNoViolations(checkEventLog(durable, durable[0]!.seq - 1), 'durable stream')
    expect(partials, 'live partials while recording').toBeGreaterThan(10)
    // 100 ms level windows on both tracks, as with PipeWire
    for (const t of TRACKS)
      expect(levels[t], `${t} levels`).toBeGreaterThan(FIXTURE.truth.durationMs / 100 / 2)
    // nothing but start/stop latency: rotation and reconnects left no holes
    expect(tracks.map((t) => t.gaps.filter((g) => g.reason !== 'latency'))).toEqual([[], []])
  }, 240_000)

  it('is as accurate as the committed baseline (same models, same fixture, from file)', () => {
    const mic = wer(FIXTURE.reference('mic'), text(segments, 'mic'))
    const system = wer(FIXTURE.reference('system'), text(segments, 'system'))
    const errs = (w: typeof mic) => w.substitutions + w.deletions + w.insertions
    const metrics = {
      wer: (errs(mic) + errs(system)) / (mic.refWords + system.refWords),
      wer_mic: mic.wer,
      wer_system: system.wer,
    }
    console.log(
      `[external capture, Electron runtime] WER ${(metrics.wer * 100).toFixed(1)}% (mic ${(mic.wer * 100).toFixed(1)}%, system ${(system.wer * 100).toFixed(1)}%)`,
    )
    const base = readBaseline('standup-2p', BASELINE)
    expect(base, 'baseline for standup-2p').not.toBeNull()
    // RTF is a property of the offline benchmark, not of a real-time recording
    const { rtf: _rtf, ...accuracy } = base!.metrics
    const c = compareToBaseline({ ...base!, metrics: accuracy }, metrics)
    expect(c.failures).toEqual([])
  })

  it('attributes by track: the mic is always me, the far end never is', () => {
    expect(new Set(segments.filter((s) => s.track === 'mic').map((s) => s.speaker))).toEqual(new Set(['me']))
    expect(segments.filter((s) => s.track === 'system').every((s) => s.speaker !== 'me')).toBe(true)
    expect(segments.some((s) => s.track === 'system')).toBe(true)
  })

  it('wrote both tracks as WAVs of the session length, holding the streamed audio', () => {
    for (const t of tracks) {
      const buf = readFileSync(t.audioPath!)
      const samples = (buf.length - 44) / 2
      expect(Math.abs(samples / 16 - durationMs), `${t.kind} WAV length vs session`).toBeLessThan(250)
      expect(buf.readUInt32LE(40), `${t.kind} header finalised`).toBe(buf.length - 44)
      // the streamed PCM is in the file verbatim (after the start anchor)
      const src = pcm[t.kind as TrackKind]
      const probe = src.subarray(16_000 * 20, 16_000 * 20 + 64)
      const hay = new Int16Array(buf.buffer, buf.byteOffset + 44, samples)
      let found = -1
      for (let i = 16_000 * 19; i < 16_000 * 22 && found < 0; i++)
        if (hay[i] === probe[0] && probe.every((v, k) => hay[i + k] === v)) found = i
      expect(found, `${t.kind}: fixture audio found bit-exact in the WAV`).toBeGreaterThan(0)
    }
  })

  it('the bundled CLI searches and asks over the transcript it produced', async () => {
    const env = { GNOMEOLA_URL: d.baseUrl }
    const s = await bundledCli(runtime, ['search', 'retry budget'], env)
    expect(s.code, s.stderr).toBe(0)
    expect(JSON.parse(s.stdout).hits.some((h: { sessionId: string }) => h.sessionId === sessionId)).toBe(true)
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    const a = await bundledCli(runtime, ['ask', 'what is the retry budget?', '--session', sessionId], env)
    expect(a.code, a.stderr).toBe(0)
    const ids = new Set(segments.map((x) => x.id))
    for (const c of JSON.parse(a.stdout).citations) expect(ids.has(c.segmentId)).toBe(true)
    expect(JSON.stringify(api.seen.at(-1)!.body)).toMatch(/retry budget/i)
  })
})

describe('external capture chaos (daemon from source, plain Node)', () => {
  let d: DaemonHandle
  beforeAll(async () => {
    d = await startDaemon({ fake: false, env: { GNOMEOLA_CAPTURE: 'external' } })
  }, 60_000)
  afterAll(async () => {
    await d?.stop()
  }, 60_000)

  it('a dropped stream is a gap of the outage length; pause excludes time; nothing else is lost', async () => {
    const s = await d.client.call('createSession', { body: { title: 'Flaky app' } })
    await d.client.call('startSession', { params: { id: s.id } })
    await waitingFor(d, s.id)
    const t0 = performance.now()
    const SR = 16_000
    const mic = ingestPcm({
      baseUrl: d.baseUrl,
      sessionId: s.id,
      track: 'mic',
      frames: pacedFrames(pcm.mic, { epoch: 1, t0, to: 20 * SR }),
    })
    // the system stream dies at 8 s and comes back 3 s later without resending (its clock kept counting)
    const system = (async () => {
      await ingestPcm({
        baseUrl: d.baseUrl,
        sessionId: s.id,
        track: 'system',
        frames: pacedFrames(pcm.system, { epoch: 2, t0, to: 8 * SR }),
      })
      return ingestPcm({
        baseUrl: d.baseUrl,
        sessionId: s.id,
        track: 'system',
        frames: pacedFrames(pcm.system, { epoch: 2, t0, from: 11 * SR, to: 20 * SR }),
      })
    })()
    // pause 14 → 16 s on the wall clock: the app keeps streaming, the daemon discards it
    await new Promise((r) => setTimeout(r, 14_000 - (performance.now() - t0)))
    await d.client.call('pauseSession', { params: { id: s.id } })
    await new Promise((r) => setTimeout(r, 2_000))
    await d.client.call('resumeSession', { params: { id: s.id } })
    const [m, sy] = await Promise.all([mic, system])
    const stopped = await d.client.call('stopSession', { params: { id: s.id } })
    const byKind = Object.fromEntries(stopped.tracks.map((t) => [t.kind, t]))
    expect(Math.abs(stopped.durationMs - 18_000)).toBeLessThan(500)
    expect(byKind.mic!.gaps.filter((g) => g.reason !== 'latency')).toEqual([])
    const outage = byKind.system!.gaps.filter((g) => g.reason !== 'latency')
    expect(outage).toHaveLength(1)
    expect(outage[0]!.reason).toBe('disconnected')
    expect(Math.abs(outage[0]!.atMs - 8_000)).toBeLessThan(300)
    expect(Math.abs(outage[0]!.durationMs - 3_000)).toBeLessThan(300)
    // ~2 s of each stream arrived while paused and was discarded, never written
    expect(m.discarded).toBeGreaterThan(1.5 * SR)
    expect(sy.discarded).toBeGreaterThan(1.5 * SR)
    // Every sample of a WAV is the app's audio or an accounted gap, and the two tracks stay aligned. (The
    // session's own clock may run a few hundred ms longer than the capture timeline around a pause: it
    // keeps counting while the STT pipeline pauses, for PipeWire exactly as here.)
    const wavSamples = (t: (typeof stopped.tracks)[number]) => (readFileSync(t.audioPath!).length - 44) / 2
    const gapSamples = (t: (typeof stopped.tracks)[number]) =>
      t.gaps.reduce((n, g) => n + g.durationMs * 16, 0)
    expect(Math.abs(wavSamples(byKind.mic!) - (m.samples + gapSamples(byKind.mic!)))).toBeLessThanOrEqual(16)
    expect(Math.abs(wavSamples(byKind.mic!) - wavSamples(byKind.system!))).toBeLessThan(100 * 16)
    for (const t of stopped.tracks)
      expect(Math.abs(wavSamples(t) / 16 - stopped.durationMs), `${t.kind} WAV ≈ session`).toBeLessThan(750)
    const segs = (await d.client.call('getTranscript', { params: { id: s.id } })).segments
    assertNoViolations(checkSegments(segs, { durationMs: stopped.durationMs }), 'chaos transcript')
    expect(segs.filter((x) => x.track === 'mic').every((x) => x.speaker === 'me')).toBe(true)
    expect(segs.filter((x) => x.track === 'system').every((x) => x.speaker !== 'me')).toBe(true)
  }, 120_000)

  it('SIGKILL mid-meeting: the WAVs are repaired and kept up to the last flush', async () => {
    const s = await d.client.call('createSession', { body: { title: 'Killed while streaming' } })
    await d.client.call('startSession', { params: { id: s.id } })
    await waitingFor(d, s.id)
    const t0 = performance.now()
    const streams = TRACKS.map((track, i) =>
      ingestPcm({
        baseUrl: d.baseUrl,
        sessionId: s.id,
        track,
        frames: pacedFrames(pcm[track], { epoch: 7 + i, t0 }),
      }).catch((e: Error) => e),
    )
    await new Promise((r) => setTimeout(r, 6_000))
    const aliveMs = performance.now() - t0
    await d.kill('SIGKILL')
    for (const r of await Promise.all(streams)) expect(r).toBeInstanceOf(Error) // the app sees the daemon go
    await d.restart()
    const after = await d.client.call('getSession', { params: { id: s.id } })
    expect(after.status).toBe('recovered')
    for (const t of after.tracks) {
      const buf = readFileSync(t.audioPath!)
      const dataBytes = buf.readUInt32LE(40)
      expect(buf.length - 44, `${t.kind}: header repaired`).toBe(dataBytes)
      expect((dataBytes / 2 / 16_000) * 1000, `${t.kind}: audio up to the last flush`).toBeGreaterThan(
        aliveMs - 2_000,
      )
    }
  }, 60_000)
})
