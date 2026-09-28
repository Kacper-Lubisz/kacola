import { setTimeout as sleep } from 'node:timers/promises'
import type { TrackKind } from '@gnomeola/protocol'
import { loadFixture } from '@gnomeola/testkit/fixtures'
import { normalizeWords, summarizeLatency, wer } from '@gnomeola/testkit/metrics'
import { beforeAll, describe, expect, it } from 'vitest'
import type { LiveHypothesis } from '../src/types.ts'
import { type Engines, LIVE_MODEL, loadEngines } from './e2e-helpers.ts'

// V-2b latency budget: tier 1 fed at 1× real time (100 ms chunks on a drift-free wall-clock schedule,
// both tracks at once, like the capture engine), measuring PCM-in to partial-out.
//
//   utterance-end latency  for every ground-truth utterance: wall time from the moment the chunk holding
//                          its last sample was pushed, to the first hypothesis that contains its last
//                          word. "How long after I stop talking do my words appear."
//   word latency           for every word the first time it appears in a hypothesis: wall time since
//                          the chunk holding the word's (model-reported) timestamp was pushed.

let engines: Engines
beforeAll(async () => {
  engines = await loadEngines()
})

const BUDGET = { utteranceEndP50: 800, utteranceEndP95: 1500, wordP95: 1000 }

describe(`tier-1 latency at 1× real time (${LIVE_MODEL})`, () => {
  it('standup-2p: PCM-in to partial-out p50/p95 within budget', async () => {
    const f = loadFixture('standup-2p')
    const tracks = ['mic', 'system'] as const
    type Emit = { wall: number; h: LiveHypothesis }
    const emits: Emit[] = []
    const streams = Object.fromEntries(
      tracks.map((t) => [
        t,
        engines.live.createStream({
          track: t,
          startMs: 0,
          onHypothesis: (h) => emits.push({ wall: performance.now(), h }),
        }),
      ]),
    ) as Record<TrackKind, ReturnType<Engines['live']['createStream']>>
    const chunks = Object.fromEntries(tracks.map((t) => [t, f.chunks(t, 100)])) as Record<
      TrackKind,
      ReturnType<typeof f.chunks>
    >
    const n = Math.max(...tracks.map((t) => chunks[t].length))
    const pushWall: number[] = [] // wall time chunk k (covering [k*100, k*100+100) ms) was pushed
    const start = performance.now()
    let late = 0
    for (let k = 0; k < n; k++) {
      const due = start + (k + 1) * 100 // a chunk is available once its 100 ms have been captured
      const wait = due - performance.now()
      if (wait > 0) await sleep(wait)
      else late++
      pushWall[k] = performance.now()
      for (const t of tracks) {
        const c = chunks[t][k]
        if (c) streams[t].accept(c.samples)
      }
    }
    for (const t of tracks) streams[t].flush()
    const wallS = (performance.now() - start) / 1000
    const at = (ms: number) => pushWall[Math.min(pushWall.length - 1, Math.max(0, Math.floor(ms / 100)))]!

    // utterance-end latency
    const uttLat: number[] = []
    const missed: string[] = []
    for (const u of f.truth.utterances) {
      const last = normalizeWords(u.text).at(-1)!
      const hit = emits.find(
        (e) =>
          e.h.track === u.track &&
          e.wall >= at(u.endMs) - 100 &&
          e.h.words.some(
            (w) =>
              w.startMs >= u.startMs - 300 &&
              w.startMs <= u.endMs + 1500 &&
              normalizeWords(w.text).includes(last),
          ),
      )
      if (hit) uttLat.push(hit.wall - at(u.endMs))
      else missed.push(`${u.track}: …${last}`)
    }
    // word latency (first appearance of each word position per hypothesis stream)
    const wordLat: number[] = []
    const seen: Record<TrackKind, number> = { mic: -1, system: -1 }
    for (const e of emits) {
      for (const w of e.h.words)
        if (w.startMs > seen[e.h.track]) {
          wordLat.push(e.wall - at(w.startMs))
          seen[e.h.track] = w.startMs
        }
    }
    const u = summarizeLatency(uttLat)
    const w = summarizeLatency(wordLat)
    const endpoints = (t: TrackKind) =>
      emits
        .filter((e) => e.h.track === t && e.h.kind === 'endpoint')
        .map((e) => e.h.text)
        .join(' ')
    const liveWer = wer(
      [f.reference('mic'), f.reference('system')],
      [endpoints('mic'), endpoints('system')],
    ).wer
    console.log(
      JSON.stringify({
        model: LIVE_MODEL,
        wallS: +wallS.toFixed(1),
        audioS: f.truth.durationMs / 1000,
        lateChunks: late,
        utteranceEnd: { ...u, missed: missed.length },
        word: w,
        liveWer,
      }),
    )
    expect(wallS).toBeGreaterThan((f.truth.durationMs / 1000) * 0.98) // really 1× real time
    expect(late).toBeLessThan(n * 0.02) // the decoder kept up
    expect(missed.length).toBeLessThanOrEqual(2) // (a word the live model gets wrong cannot be timed)
    expect(u.n).toBeGreaterThanOrEqual(f.truth.utterances.length - 2)
    expect(u.p50).toBeLessThan(BUDGET.utteranceEndP50)
    expect(u.p95).toBeLessThan(BUDGET.utteranceEndP95)
    expect(w.p95).toBeLessThan(BUDGET.wordP95)
  })
})
