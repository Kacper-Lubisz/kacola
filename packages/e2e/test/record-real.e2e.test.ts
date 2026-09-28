import { join } from 'node:path'
import type { AnyEvent, DurableEvent, Segment } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { loadFixture } from '@gnomeola/testkit/fixtures'
import {
  assertNoViolations,
  checkEventLog,
  checkSegmentHistory,
  checkSegments,
} from '@gnomeola/testkit/invariants'
import { wer } from '@gnomeola/testkit/metrics'
import { assertDefaultsUnchanged, PipeWireRig, readDefaults } from '@gnomeola/testkit/rig'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { gnomeola } from '../src/cli.ts'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'

// The whole product on real audio. A fixture meeting (per-track speech with exact ground truth) is played
// in real time into two virtual PipeWire devices; the REAL daemon records them through the production
// capture path and transcribes with the real models; then the CLI searches, windows and asks. Nothing on
// the recording path is faked — only the far end of the LLM call is a replay.

const FIXTURE = loadFixture('standup-2p')
const CASSETTES = join(import.meta.dirname, '..', '..', 'llm', 'test', 'fixtures', 'cassettes')

let rig: PipeWireRig
let d: DaemonHandle
let api: FakeAnthropic
let defaults: Awaited<ReturnType<typeof readDefaults>>
let sessionId = ''
let segments: Segment[] = []
const durable: DurableEvent[] = []
let partials = 0

beforeAll(async () => {
  defaults = await readDefaults()
  rig = await PipeWireRig.create()
  api = await startFakeAnthropic()
  d = await startDaemon({
    fake: false,
    env: { ANTHROPIC_API_KEY: 'sk-ant-e2e-real-audio', ANTHROPIC_BASE_URL: api.url },
  })
  await d.client.call('updateSettings', {
    body: { capture: { micDevice: rig.mic.captureTarget, systemDevice: rig.system.captureTarget } },
  })
  const health = await d.client.call('health')
  expect(health.capture, JSON.stringify(health.capture)).toMatchObject({
    available: true,
    backend: 'pipewire',
    detail: null,
  })
}, 120_000)

afterAll(async () => {
  await d?.stop()
  await api?.close()
  await rig?.teardown()
  if (defaults) await assertDefaultsUnchanged(defaults)
}, 120_000)

describe('a real meeting, recorded and transcribed', () => {
  it('records both tracks in real time and produces a transcript that satisfies every invariant', async () => {
    const ac = new AbortController()
    const events = d.client.subscribe({
      since: (await d.client.call('health')).lastSeq,
      signal: ac.signal,
      onEvent: (e: AnyEvent) => {
        if (e.seq !== null) durable.push(e as DurableEvent)
        else if (e.data.type === 'transcript.partial') partials++
      },
    })
    const s = await d.client.call('createSession', { body: { title: 'Standup (real audio)' } })
    sessionId = s.id
    const started = await d.client.call('startSession', { params: { id: s.id } })
    expect(started.status).toBe('recording')
    await rig.playTogether(
      [
        [rig.mic, FIXTURE.wavPath('mic')],
        [rig.system, FIXTURE.wavPath('system')],
      ],
      { timeoutMs: FIXTURE.truth.durationMs + 30_000 },
    )
    const stopped = await d.client.call('stopSession', { params: { id: s.id } })
    expect(stopped.status).toBe('stopped')
    // give the SSE stream a moment to deliver the last durable events
    await new Promise((r) => setTimeout(r, 500))
    ac.abort()
    await events

    segments = (await d.client.call('getTranscript', { params: { id: s.id } })).segments
    expect(segments.length).toBeGreaterThan(8)
    assertNoViolations(
      checkSegments(segments, { durationMs: stopped.durationMs, requireFinal: true }),
      'final transcript',
    )
    const history = durable.flatMap((e) => (e.data.type === 'segment.upserted' ? [e.data.segment] : []))
    assertNoViolations(checkSegmentHistory(history), 'segment history over SSE')
    assertNoViolations(checkEventLog(durable, durable[0]!.seq - 1), 'durable stream')
    expect(partials, 'live partials streamed while recording').toBeGreaterThan(10)
    expect(stopped.tracks.map((t) => t.gaps.filter((g) => g.reason !== 'latency'))).toEqual([[], []])
  }, 240_000)

  it('transcribes accurately enough through the real PipeWire path, per track', async () => {
    for (const track of ['mic', 'system'] as const) {
      const hyp = segments
        .filter((s) => s.track === track)
        .sort((a, b) => a.startMs - b.startMs)
        .map((s) => s.text)
        .join(' ')
      const r = wer(FIXTURE.reference(track), hyp)
      console.log(
        `[real-audio] ${track}: WER ${(r.wer * 100).toFixed(1)}% (S${r.substitutions} D${r.deletions} I${r.insertions} / ${r.refWords} words)`,
      )
      // docs/stt.md measures ~8% on this fixture from file; PipeWire adds resampling and edge latency.
      expect(r.wer, `${track} WER`).toBeLessThan(0.15)
    }
  })

  it('attributes by track: the mic is always me, the far end never is', () => {
    expect(new Set(segments.filter((s) => s.track === 'mic').map((s) => s.speaker))).toEqual(new Set(['me']))
    expect(segments.filter((s) => s.track === 'system').every((s) => s.speaker !== 'me')).toBe(true)
  })

  it('places each fact near where it was said', () => {
    for (const f of FIXTURE.truth.facts) {
      const u = FIXTURE.truth.utterances[f.utterance]!
      const near = segments.filter(
        (s) => s.track === u.track && s.endMs >= u.startMs - 1500 && s.startMs <= u.endMs + 1500,
      )
      expect(near.length, `segments near fact ${f.key}`).toBeGreaterThan(0)
    }
  })

  // Real ASR, not a script: on this fixture it hears "three detempts, then dead letter". Assertions check what
  // a recogniser must get right for the product to work (subject and number); accuracy is the WER test above.
  it('is searchable and windowable through the CLI — search → window finds the decision', async () => {
    const s = await gnomeola(['search', 'retry budget'], d.baseUrl)
    expect(s.code).toBe(0)
    const hit = JSON.parse(s.stdout).hits.find((h: { sessionId: string }) => h.sessionId === sessionId)
    expect(hit, 'the real transcript is indexed').toBeDefined()
    const w = await gnomeola(['transcript', sessionId, '--around', hit.segmentId], d.baseUrl)
    expect(w.code).toBe(0)
    expect(
      JSON.parse(w.stdout)
        .segments.map((x: Segment) => x.text)
        .join(' '),
    ).toMatch(/retry budget is three/i)
  })

  it('answers a question over the real transcript with citations to real segments', async () => {
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    const r = await gnomeola(['ask', 'what is the retry budget?', '--session', sessionId], d.baseUrl)
    expect(r.code, r.stderr).toBe(0)
    const out = JSON.parse(r.stdout)
    const ids = new Set(segments.map((s) => s.id))
    expect(out.citations.length).toBeGreaterThan(0)
    for (const c of out.citations) expect(ids.has(c.segmentId)).toBe(true)
    const sent = JSON.stringify(api.seen[0]!.body)
    expect(sent).toMatch(/retry budget is three/i) // the model was shown the real transcript
  })

  it('wrote both tracks to disk as valid WAVs of the session length', async () => {
    const s = await d.client.call('getSession', { params: { id: sessionId } })
    const { statSync } = await import('node:fs')
    for (const t of s.tracks) {
      expect(t.audioPath).toBeTruthy()
      const bytes = statSync(t.audioPath!).size - 44
      const ms = (bytes / 2 / 16_000) * 1000
      expect(Math.abs(ms - s.durationMs), `${t.kind} WAV length vs session`).toBeLessThan(1500)
    }
  })
})

describe('chaos on the real pipeline', () => {
  it('SIGKILL mid-meeting: restart recovers the session, repairs the audio, keeps the transcript', async () => {
    const s = await d.client.call('createSession', { body: { title: 'Killed mid-meeting' } })
    await d.client.call('startSession', { params: { id: s.id } })
    const play = rig
      .playTogether(
        [
          [rig.mic, FIXTURE.wavPath('mic')],
          [rig.system, FIXTURE.wavPath('system')],
        ],
        { timeoutMs: FIXTURE.truth.durationMs + 30_000 },
      )
      .catch(() => {})
    await waitFor(
      async () => (await d.client.call('getTranscript', { params: { id: s.id } })).segments.length >= 3,
      60_000,
      'segments before the kill',
    )
    await new Promise((r) => setTimeout(r, 2500))
    const before = (await d.client.call('getTranscript', { params: { id: s.id } })).segments
    const aliveMs =
      Date.now() -
      new Date((await d.client.call('getSession', { params: { id: s.id } })).startedAt!).getTime()
    await d.kill('SIGKILL')
    await play
    await d.restart()
    const after = await d.client.call('getSession', { params: { id: s.id } })
    expect(after.status).toBe('recovered')
    expect(after.error).toMatch(/interrupted/)
    const kept = (await d.client.call('getTranscript', { params: { id: s.id } })).segments
    expect(kept.map((x) => x.id)).toEqual(expect.arrayContaining(before.map((x) => x.id)))
    assertNoViolations(checkSegments(kept), 'recovered transcript')
    const { readFileSync } = await import('node:fs')
    for (const t of after.tracks) {
      const buf = readFileSync(t.audioPath!)
      const dataBytes = buf.readUInt32LE(40)
      expect(buf.length - 44, `${t.kind}: header repaired to match the data`).toBe(dataBytes)
      const ms = (dataBytes / 2 / 16_000) * 1000
      // Flushed every second: at most ~1 s (plus start latency) may be lost to the kill.
      expect(ms, `${t.kind}: audio kept up to the last flush`).toBeGreaterThan(aliveMs - 2500)
    }
    // The log is gap-free from the beginning after a crash.
    const all: DurableEvent[] = []
    const ac = new AbortController()
    const last = (await d.client.call('health')).lastSeq
    await d.client.subscribe({
      since: 0,
      ephemeral: false,
      signal: ac.signal,
      onEvent: (e) => {
        all.push(e as DurableEvent)
        if (e.seq === last) ac.abort()
      },
    })
    assertNoViolations(checkEventLog(all), 'event log after recovery')
  }, 240_000)
})
