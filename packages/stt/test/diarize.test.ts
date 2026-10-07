import type { Segment, TrackKind } from '@kacola/protocol'
import { assertNoViolations, checkAttribution, checkSegments } from '@kacola/testkit/invariants'
import { describe, expect, it } from 'vitest'
import { agglomerate, cosine, normalize, OnlineClusterer, stabilise } from '../src/diarize/clustering.ts'
import { changePoints, EmbeddingDiarizer } from '../src/diarize/session.ts'
import type { LocalTurn, SpeakerEmbedder, TurnDetector } from '../src/diarize/types.ts'
import { EchoGate } from '../src/echo-gate.ts'
import { type PipelineEvent, TranscriptionPipeline } from '../src/pipeline.ts'
import {
  type LiveRecognizer,
  msToSamples,
  SAMPLE_RATE,
  type VadEvent,
  type VoiceActivityDetector,
} from '../src/types.ts'

// A-2/A-3/A-4 with fake engines: clustering, turn detection, the echo gate, and the pipeline's
// diarization plumbing — deterministic, no models.

const vec = (...xs: number[]) => new Float32Array(xs)
/** A voice as a direction in 4-D, with a little per-utterance wobble. */
const voice = (k: number, wobble = 0) => {
  const v = new Float32Array(4)
  v[k] = 1
  v[(k + 1) % 4] = wobble
  return v
}

describe('clustering', () => {
  it('cosine and normalize', () => {
    expect(cosine(vec(1, 0), vec(0, 1))).toBe(0)
    expect(cosine(vec(1, 1), vec(2, 2))).toBeCloseTo(1)
    expect(cosine(vec(0, 0), vec(1, 0))).toBe(0)
    expect([...normalize(vec(3, 4))]).toEqual([0.6000000238418579, 0.800000011920929])
    expect(() => cosine(vec(1), vec(1, 2))).toThrow(/dimension/)
  })

  it('online: joins the nearest speaker above the threshold, founds a new one below it; ids never change', () => {
    const c = new OnlineClusterer({ threshold: 0.7 })
    expect(c.assign(voice(0), 2000)).toMatchObject({ cluster: 0, created: true })
    expect(c.assign(voice(0, 0.2), 2000)).toMatchObject({ cluster: 0, created: false })
    expect(c.assign(voice(1), 2000)).toMatchObject({ cluster: 1, created: true })
    expect(c.assign(voice(0, 0.1), 1500).cluster).toBe(0)
    expect(c.assign(voice(2), 3000)).toMatchObject({ cluster: 2, created: true })
    expect(c.clusters.map((x) => [x.id, x.segments])).toEqual([
      [0, 3],
      [1, 1],
      [2, 1],
    ])
  })

  it('online: a short segment joins the nearest speaker but never founds one nor moves a centroid', () => {
    const c = new OnlineClusterer({ threshold: 0.9, minFoundMs: 1000 })
    c.assign(voice(0), 2000)
    const before = [...c.centroid(0)]
    expect(c.assign(voice(1), 400)).toMatchObject({ cluster: 0, created: false })
    expect([...c.centroid(0)]).toEqual(before)
    // …but the very first segment of a meeting may be short
    const d = new OnlineClusterer()
    expect(d.assign(voice(3), 300)).toMatchObject({ cluster: 0, created: true })
  })

  it('online: recognises a known voice once, and never gives it to two speakers', () => {
    const c = new OnlineClusterer({
      threshold: 0.8,
      voices: [
        { id: 'vp_ana', embedding: [...voice(1)] },
        { id: 'vp_ben', embedding: [...voice(2)] },
      ],
      voiceThreshold: 0.6,
    })
    c.assign(voice(0), 2000)
    c.assign(voice(1, 0.3), 2000)
    c.assign(voice(1, -0.9), 2000) // a different speaker that also resembles Ana a little
    expect(c.clusters.map((x) => x.voiceprintId)).toEqual([null, 'vp_ana', null])
  })

  it('agglomerate groups by average linkage and stops at the threshold', () => {
    const items = [voice(0), voice(1), voice(0, 0.3), voice(1, 0.2), voice(2), voice(0, -0.2)].map((e) => ({
      embedding: e,
      weightMs: 1000,
    }))
    expect(agglomerate(items, 0.7)).toEqual([0, 1, 0, 1, 2, 0])
    expect(agglomerate(items, -1)).toEqual([0, 0, 0, 0, 0, 0])
    expect(agglomerate(items, 1.01)).toEqual([0, 1, 2, 3, 4, 5])
    expect(agglomerate([], 0.5)).toEqual([])
  })

  it('stabilise maps re-clustered labels onto the online ids by shared time', () => {
    // online said [0,0,1,2] ; offline says 1 and 2 are the same person
    expect(stabilise([0, 0, 1, 2], [5, 5, 7, 7], [1000, 1000, 3000, 500], 3)).toEqual([0, 0, 1, 1])
    // offline found someone online never did: a fresh id
    expect(stabilise([0, 0, 0], [0, 0, 1], [1000, 1000, 1000], 1)).toEqual([0, 0, 1])
  })
})

describe('changePoints', () => {
  const t = (startMs: number, endMs: number, speaker: number): LocalTurn => ({ startMs, endMs, speaker })
  it('one speaker, or nothing, is no change', () => {
    expect(changePoints([], 5000, 700)).toEqual([])
    expect(changePoints([t(0, 2000, 0), t(2500, 5000, 0)], 5000, 700)).toEqual([])
  })
  it('a clean hand-over is one split at the new speaker’s onset', () => {
    expect(changePoints([t(100, 2400, 0), t(2900, 6000, 1)], 6000, 700)).toEqual([2900])
  })
  it('an overlap belongs to whoever was talking; a back-and-forth gives two splits', () => {
    expect(changePoints([t(0, 3000, 0), t(2500, 5000, 1), t(5400, 8000, 0)], 8000, 700)).toEqual([3000, 5400])
  })
  it('a blip shorter than the minimum turn is absorbed, and no piece at the ends is too short', () => {
    expect(changePoints([t(0, 3000, 0), t(3000, 3300, 1), t(3300, 6000, 0)], 6000, 700)).toEqual([])
    expect(changePoints([t(0, 400, 1), t(400, 5000, 0)], 5000, 700)).toEqual([])
  })
})

// ------------------------------------------------------------------------------------ fake engines

/** Audio encodes its speaker: every sample of speaker k's speech is (k + 1) / 10. */
const speakerOf = (x: number) => Math.round(x * 10) - 1

const fakeEmbedder: SpeakerEmbedder = {
  modelId: 'fake-emb',
  async embed(samples) {
    const counts = [0, 0, 0, 0]
    for (const x of samples) {
      const k = speakerOf(x)
      if (k >= 0 && k < 4) counts[k]!++
    }
    return new Float32Array(counts)
  },
}

const fakeTurns: TurnDetector = {
  modelId: 'fake-turns',
  async turns(samples) {
    const out: LocalTurn[] = []
    const step = SAMPLE_RATE / 100
    for (let i = 0; i < samples.length; i += step) {
      const k = speakerOf(samples[i]!)
      const ms = (i * 1000) / SAMPLE_RATE
      const last = out.at(-1)
      if (k < 0) continue
      if (last && last.speaker === k && last.endMs >= ms - 20) last.endMs = ms + 10
      else out.push({ startMs: ms, endMs: ms + 10, speaker: k })
    }
    return out
  },
}

/** Speech wherever a sample is non-zero; segments are contiguous non-zero runs ≥ 200 ms apart. */
const fakeVad: VoiceActivityDetector = {
  modelId: 'fake-vad',
  createStream({ track, startMs, onEvent }) {
    let pos = 0
    let start: number | null = null
    let lastVoice = -1
    const ms = (n: number) => startMs + (n * 1000) / SAMPLE_RATE
    const close = (end: number) => {
      if (start === null) return
      onEvent({ kind: 'end', track, startMs: ms(start), endMs: ms(end) } satisfies VadEvent)
      start = null
    }
    return {
      accept(samples) {
        for (let i = 0; i < samples.length; i++, pos++) {
          if (samples[i] !== 0) {
            if (start === null) {
              start = pos
              onEvent({ kind: 'start', track, atMs: ms(pos) })
            }
            lastVoice = pos
          } else if (start !== null && pos - lastVoice > SAMPLE_RATE / 5) close(lastVoice + 1)
        }
      },
      flush() {
        close(lastVoice + 1)
      },
    }
  },
}

/** Emits one word per 500 ms of speech, named after the speaker. */
const fakeLive: LiveRecognizer = {
  modelId: 'fake-live',
  createStream({ track, startMs, onHypothesis }) {
    let pos = 0
    let voiced = 0
    return {
      accept(samples) {
        for (let i = 0; i < samples.length; i++, pos++) {
          if (samples[i] === 0) continue
          if (++voiced % (SAMPLE_RATE / 2) === 0) {
            const at = startMs + (pos * 1000) / SAMPLE_RATE
            const w = { text: `s${speakerOf(samples[i]!)}`, startMs: at - 500, endMs: at }
            onHypothesis({ kind: 'endpoint', track, text: w.text, words: [w], startMs: w.startMs, endMs: at })
          }
        }
      },
      flush() {},
    }
  },
}

type Turn = { track: TrackKind; speaker: number; startMs: number; endMs: number }

/** Two tracks of fake audio; mic speech is "speaker 3", far-end speakers 0..2. */
function render(turns: Turn[], durationMs: number, bleed = 0) {
  const n = msToSamples(durationMs)
  const tracks = { mic: new Float32Array(n), system: new Float32Array(n) }
  for (const t of turns)
    tracks[t.track].fill((t.speaker + 1) / 10, msToSamples(t.startMs), msToSamples(t.endMs))
  if (bleed) for (let i = 0; i < n; i++) if (tracks.mic[i] === 0) tracks.mic[i] = tracks.system[i]! * bleed
  return tracks
}

async function runPipeline(
  turns: Turn[],
  durationMs: number,
  opts: { diarize?: boolean; bleed?: number; echoGate?: boolean } = {},
) {
  const events: PipelineEvent[] = []
  let n = 0
  const diarizer = new EmbeddingDiarizer({ embedder: fakeEmbedder, turns: fakeTurns, threshold: 0.8 })
  const p = new TranscriptionPipeline({
    sessionId: 'ses_fake',
    live: fakeLive,
    vad: fakeVad,
    final: {
      modelId: 'fake-final',
      async transcribe(samples) {
        const ks = new Set<number>()
        for (const x of samples) if (x !== 0) ks.add(speakerOf(x))
        return { text: [...ks].map((k) => `final s${k}`).join(' '), confidence: 1 }
      },
    },
    finalPass: 'during',
    diarizer: opts.diarize === false ? null : diarizer.createSession(),
    echoGate: opts.echoGate ?? true,
    newSegmentId: () => `seg_${String(++n).padStart(3, '0')}`,
    onEvent: (e) => events.push(e),
  })
  const audio = render(turns, durationMs, opts.bleed)
  const step = msToSamples(100)
  for (let i = 0; i < audio.mic.length; i += step)
    for (const track of ['mic', 'system'] as const)
      p.push(track, audio[track].subarray(i, i + step), (i * 1000) / SAMPLE_RATE)
  await p.stop(durationMs)
  const upserts = events.flatMap((e) => (e.type === 'segment.upserted' ? [e.segment] : []))
  const latest = [...new Map(upserts.map((s) => [s.id, s])).values()]
  const cluster = new Map<string, number>()
  for (const e of events)
    if (e.type === 'speaker.attributed') for (const id of e.segmentIds) cluster.set(id, e.cluster)
  return { p, events, latest, cluster }
}

describe('pipeline diarization (fake engines)', () => {
  it('attributes far-end segments to stable clusters and never touches the mic', async () => {
    const turns: Turn[] = [
      { track: 'system', speaker: 0, startMs: 500, endMs: 2500 },
      { track: 'mic', speaker: 3, startMs: 3000, endMs: 4500 },
      { track: 'system', speaker: 1, startMs: 5000, endMs: 7500 },
      { track: 'system', speaker: 0, startMs: 8000, endMs: 10_000 },
      { track: 'system', speaker: 2, startMs: 10_500, endMs: 12_500 },
    ]
    const r = await runPipeline(turns, 13_000)
    expect(r.p.errors).toEqual([])
    const sys = r.latest.filter((s) => s.track === 'system').sort((a, b) => a.startMs - b.startMs)
    expect(sys).toHaveLength(4)
    expect(sys.map((s) => r.cluster.get(s.id))).toEqual([0, 1, 0, 2])
    for (const s of r.latest.filter((x) => x.track === 'mic')) expect(r.cluster.has(s.id)).toBe(false)
    assertNoViolations(checkAttribution(r.latest))
    // clusters come out at the end with their centroids
    const cl = r.events.find((e) => e.type === 'speaker.clusters')
    expect(cl && cl.type === 'speaker.clusters' && cl.clusters.map((c) => c.cluster)).toEqual([0, 1, 2])
    // and all final: the held tier-2 requests were released
    expect(sys.every((s) => s.quality === 'final')).toBe(true)
  })

  it('splits a far-end segment at a change of speaker before tier 2, so each piece is one person', async () => {
    // Ana hands straight over to Ben with no pause: VAD sees one segment
    const turns: Turn[] = [
      { track: 'system', speaker: 0, startMs: 500, endMs: 3500 },
      { track: 'system', speaker: 1, startMs: 3500, endMs: 7000 },
    ]
    const r = await runPipeline(turns, 8000)
    expect(r.p.stats().splits).toBe(1)
    const sys = r.latest.sort((a, b) => a.startMs - b.startMs)
    expect(sys.map((s) => [s.startMs, s.endMs, s.text, r.cluster.get(s.id)])).toEqual([
      [500, 3500, 'final s0', 0],
      [3500, 7000, 'final s1', 1],
    ])
    assertNoViolations(checkSegments(r.latest, { requireFinal: true }))
  })

  it('without a diarizer, the far end stays `them` and nothing is attributed', async () => {
    const r = await runPipeline([{ track: 'system', speaker: 0, startMs: 0, endMs: 2000 }], 3000, {
      diarize: false,
    })
    expect(r.events.some((e) => e.type === 'speaker.attributed')).toBe(false)
    expect(r.latest.map((s: Segment) => s.speaker)).toEqual(['them'])
  })

  it('far-end bleed into the mic is gated: it never becomes a "me" segment', async () => {
    const turns: Turn[] = [
      { track: 'system', speaker: 0, startMs: 500, endMs: 4000 },
      { track: 'mic', speaker: 3, startMs: 4500, endMs: 6000 },
      { track: 'system', speaker: 1, startMs: 6500, endMs: 9000 },
    ]
    const gated = await runPipeline(turns, 10_000, { bleed: 0.25 })
    const mic = gated.latest.filter((s) => s.track === 'mic')
    expect(mic).toHaveLength(1)
    expect(mic[0]!.startMs).toBeGreaterThanOrEqual(4400)
    expect(mic[0]!.endMs).toBeLessThanOrEqual(6100)
    expect(gated.p.stats().echoGate!.gated).toBeGreaterThan(100)
    // (and the test means something: without the gate the bleed really does become "me")
    const ungated = await runPipeline(turns, 10_000, { bleed: 0.25, echoGate: false })
    expect(ungated.latest.filter((s) => s.track === 'mic').length).toBeGreaterThan(1)
  })
})

describe('EchoGate', () => {
  const SR = SAMPLE_RATE
  /** Deterministic speech-like noise: syllables of 80–300 ms at random levels, short pauses between. */
  const speech = (n: number, seed: number, level = 0.1) => {
    let a = seed
    const rnd = () => {
      a = (a * 1103515245 + 12345) >>> 0
      return a / 2 ** 32
    }
    const out = new Float32Array(n)
    let i = 0
    while (i < n) {
      const len = Math.round(SR * (0.08 + rnd() * 0.22))
      const amp = level * (0.3 + rnd() * 0.9)
      for (let j = 0; j < len && i < n; j++, i++)
        out[i] = (rnd() * 2 - 1) * amp * Math.sin((Math.PI * j) / len)
      const gap = Math.round(SR * (0.02 + rnd() * 0.13))
      for (let j = 0; j < gap && i < n; j++, i++) out[i] = (rnd() * 2 - 1) * level * 0.01
    }
    return out
  }
  /** A room: the direct path after `delay` samples, then a tail every 5 ms decaying at `rt60`. */
  const room = (x: Float32Array, gain: number, delay: number, rt60: number) => {
    const y = new Float32Array(x.length)
    const taps: [number, number][] = [[delay, 1]]
    for (let t = 0.005; t < rt60; t += 0.005)
      taps.push([delay + Math.round(t * SR), 10 ** ((-60 * t) / rt60 / 20) * 0.5])
    for (const [d, g] of taps) for (let i = d; i < x.length; i++) y[i]! += x[i - d]! * g * gain
    return y
  }
  const run = (far: Float32Array, mic: Float32Array) => {
    const g = new EchoGate()
    const out = new Float32Array(mic.length)
    const step = SR / 10
    for (let i = 0; i < mic.length; i += step) {
      g.pushFar(far.subarray(i, i + step), (i * 1000) / SR)
      out.set(g.processMic(mic.subarray(i, i + step), (i * 1000) / SR), i)
    }
    return { out, g }
  }
  const energy = (x: Float32Array, a: number, b: number) => {
    let e = 0
    for (let i = a; i < b; i++) e += x[i]! * x[i]!
    return e / (b - a)
  }
  const rooms = [
    { gain: 0.3, delay: 480, rt60: 0.3 },
    { gain: 0.5, delay: 1600, rt60: 0.5 },
    { gain: 0.15, delay: 200, rt60: 0.2 },
    { gain: 0.7, delay: 800, rt60: 0.6 },
  ]

  it.each(rooms)(
    'silences echo-only mic audio once it has heard the far end (%o)',
    ({ gain, delay, rt60 }) => {
      const far = speech(SR * 12, 1)
      const echo = room(far, gain, delay, rt60)
      const { out, g } = run(far, echo)
      // after two seconds of learning, the leaked far end is gone
      expect(energy(out, SR * 2, SR * 12) / energy(echo, SR * 2, SR * 12)).toBeLessThan(0.02)
      expect(Math.abs(g.stats.lagMs! - (delay * 1000) / SR)).toBeLessThanOrEqual(40)
    },
  )

  it.each(rooms)('passes the user talking over the far end (%o)', ({ gain, delay, rt60 }) => {
    const far = speech(SR * 12, 1)
    const user = new Float32Array(SR * 12)
    user.set(speech(SR * 3, 7, 0.1), SR * 8) // at the far end's level
    const mic = room(far, gain, delay, rt60).map((x, i) => x + user[i]!)
    const { out } = run(far, mic)
    expect(energy(out, SR * 8, SR * 11) / energy(user, SR * 8, SR * 11)).toBeGreaterThan(0.7)
  })

  it('touches nothing without a far end; with headphones (no bleed) it leaves even a quiet user alone', () => {
    const alone = run(new Float32Array(SR * 2), speech(SR * 2, 3))
    expect(alone.g.stats.gated).toBe(0)
    expect([...alone.out]).toEqual([...speech(SR * 2, 3)])
    const far = speech(SR * 8, 1)
    const user = new Float32Array(SR * 8)
    user.set(speech(SR * 2, 9, 0.02), SR * 5) // −14 dB under the far end
    const mic = user.map((x, i) => x + (i % 2 ? 1e-4 : -1e-4))
    const { out, g } = run(far, mic)
    expect(g.stats.lagMs).toBeNull()
    expect(energy(out, SR * 5, SR * 7) / energy(mic, SR * 5, SR * 7)).toBeGreaterThan(0.9)
  })
})
