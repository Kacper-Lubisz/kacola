import { Segment, type TrackKind } from '@gnomeola/protocol'
import { assertNoViolations, checkSegmentHistory, checkSegments } from '@gnomeola/testkit/invariants'
import { describe, expect, it } from 'vitest'
import {
  type FinalizeRequest,
  type FinalPass,
  Reconciler,
  type ReconcilerInput,
  type ReconcilerOutput,
} from '../src/reconciler.ts'
import type { LiveHypothesis, TimedWord } from '../src/types.ts'

const counterIds = () => {
  let n = 0
  return () => `seg_${String(++n).padStart(4, '0')}`
}

const mk = (finalPass: FinalPass = 'during') =>
  new Reconciler({ sessionId: 'ses_test', finalPass, newSegmentId: counterIds() })

const words = (text: string, startMs: number, stepMs = 300): TimedWord[] =>
  text
    .split(' ')
    .map((w, i) => ({ text: w, startMs: startMs + i * stepMs, endMs: startMs + (i + 1) * stepMs }))

const hyp = (
  kind: LiveHypothesis['kind'],
  track: TrackKind,
  ws: TimedWord[],
  endMs?: number,
): ReconcilerInput => ({
  type: 'live',
  hyp: {
    kind,
    track,
    text: ws.map((w) => w.text).join(' '),
    words: ws,
    startMs: ws[0]?.startMs ?? 0,
    endMs: endMs ?? ws.at(-1)?.endMs ?? 0,
  },
})

function run(r: Reconciler, inputs: ReconcilerInput[]): ReconcilerOutput[] {
  return inputs.flatMap((i) => r.step(i))
}
const upserts = (o: ReconcilerOutput[]) =>
  o.flatMap((x) => (x.type === 'segment.upserted' ? [x.segment] : []))
const finalizes = (o: ReconcilerOutput[]) => o.filter((x): x is FinalizeRequest => x.type === 'finalize')
const partials = (o: ReconcilerOutput[]) => o.filter((x) => x.type === 'transcript.partial')

describe('reconciler — scripted lifecycle', () => {
  it('live partials → endpoint → close → final, with stable id and increasing revisions', () => {
    const r = mk()
    const out = run(r, [
      { type: 'vad.start', track: 'mic', atMs: 1000 },
      hyp('partial', 'mic', words('the retry', 1100)),
      hyp('partial', 'mic', words('the retry budget', 1100)),
      hyp('endpoint', 'mic', words('the retry budget is three', 1100)),
      { type: 'vad.end', track: 'mic', startMs: 980, endMs: 2700 },
    ])
    const ps = partials(out)
    expect(ps.map((p) => p.text)).toEqual(['the retry', 'the retry budget', ''])
    expect(ps.every((p) => p.speaker === 'me')).toBe(true)
    const ups = upserts(out)
    expect(ups).toHaveLength(2)
    expect(ups[0]).toMatchObject({
      id: 'seg_0001',
      revision: 1,
      quality: 'live',
      text: 'the retry budget is three',
    })
    expect(ups[1]).toMatchObject({ id: 'seg_0001', revision: 2, startMs: 980, endMs: 2700, quality: 'live' })
    const [req] = finalizes(out)
    expect(req).toEqual({ type: 'finalize', segmentId: 'seg_0001', track: 'mic', startMs: 980, endMs: 2700 })

    const fin = r.step({
      type: 'final',
      segmentId: 'seg_0001',
      text: 'The retry budget is three.',
      confidence: 0.93,
    })
    expect(upserts(fin)).toEqual([
      {
        id: 'seg_0001',
        sessionId: 'ses_test',
        track: 'mic',
        speaker: 'me',
        startMs: 980,
        endMs: 2700,
        text: 'The retry budget is three.',
        quality: 'final',
        revision: 3,
        confidence: 0.93,
      },
    ])
    // A second final, and late live words, change nothing.
    expect(r.step({ type: 'final', segmentId: 'seg_0001', text: 'other', confidence: 1 })).toEqual([])
    expect(upserts(r.step(hyp('endpoint', 'mic', words('attempts', 2600))))).toEqual([])
    expect(r.stats.finalsIgnored).toBe(1)
  })

  it('far-end speech is attributed to them, never me', () => {
    const r = mk()
    const out = run(r, [
      { type: 'vad.start', track: 'system', atMs: 0 },
      hyp('endpoint', 'system', words('Ana owns the dashboard', 100)),
      { type: 'vad.end', track: 'system', startMs: 0, endMs: 1400 },
    ])
    for (const s of upserts(out)) expect(s.speaker).toBe('them')
  })

  it('late tier-1 words revise a closed segment until its final lands', () => {
    const r = mk()
    const out = run(r, [
      { type: 'vad.start', track: 'mic', atMs: 0 },
      hyp('partial', 'mic', words('the migration', 100)),
      { type: 'vad.end', track: 'mic', startMs: 0, endMs: 1500 },
      hyp('endpoint', 'mic', words('the migration lands thursday', 100)),
    ])
    expect(upserts(out).map((s) => [s.revision, s.text])).toEqual([
      [1, 'the migration'],
      [2, 'the migration lands thursday'],
    ])
  })

  it('attaches words to the right segment by time', () => {
    const r = mk()
    const out = run(r, [
      { type: 'vad.start', track: 'mic', atMs: 0 },
      { type: 'vad.end', track: 'mic', startMs: 0, endMs: 1000 },
      { type: 'vad.start', track: 'mic', atMs: 2500 },
      // one endpoint spanning both VAD segments
      hyp('endpoint', 'mic', [...words('first part', 100), ...words('second part', 2600)]),
      { type: 'vad.end', track: 'mic', startMs: 2500, endMs: 3500 },
    ])
    const latest = new Map(upserts(out).map((s) => [s.id, s]))
    expect([...latest.values()].map((s) => s.text)).toEqual(['first part', 'second part'])
  })

  it('a segment with no text anywhere is dropped silently; one with only a final is born final', () => {
    const r = mk()
    const out = run(r, [
      { type: 'vad.start', track: 'mic', atMs: 0 },
      { type: 'vad.end', track: 'mic', startMs: 0, endMs: 400 },
      { type: 'vad.start', track: 'mic', atMs: 1000 },
      { type: 'vad.end', track: 'mic', startMs: 1000, endMs: 2000 },
    ])
    expect(upserts(out)).toEqual([])
    const [a, b] = finalizes(out)
    expect(r.step({ type: 'final', segmentId: a!.segmentId, text: '  ', confidence: null })).toEqual([])
    const born = upserts(r.step({ type: 'final', segmentId: b!.segmentId, text: 'hello', confidence: null }))
    expect(born).toMatchObject([{ revision: 1, quality: 'final', text: 'hello' }])
    expect(r.stats.segmentsDropped).toBe(1)
  })

  it("finalPass 'after' defers every tier-2 request to the end of the session", () => {
    const r = mk('after')
    const during = run(r, [
      { type: 'vad.start', track: 'mic', atMs: 0 },
      hyp('endpoint', 'mic', words('one', 100)),
      { type: 'vad.end', track: 'mic', startMs: 0, endMs: 800 },
      { type: 'vad.start', track: 'system', atMs: 500 },
      hyp('endpoint', 'system', words('two', 600)),
    ])
    expect(finalizes(during)).toEqual([])
    const end = r.step({ type: 'end', atMs: 3000 })
    expect(finalizes(end).map((f) => [f.track, f.startMs, f.endMs])).toEqual([
      ['mic', 0, 800],
      ['system', 500, 3000],
    ])
    for (const f of finalizes(end))
      r.step({ type: 'final', segmentId: f.segmentId, text: 'x', confidence: null })
    assertNoViolations(checkSegments(r.segments(), { durationMs: 3000, requireFinal: true }))
  })

  it("finalPass 'off' never asks for tier 2 and segments stay live", () => {
    const r = mk('off')
    const out = run(r, [
      { type: 'vad.start', track: 'mic', atMs: 0 },
      hyp('endpoint', 'mic', words('one', 100)),
      { type: 'vad.end', track: 'mic', startMs: 0, endMs: 800 },
      { type: 'end', atMs: 1000 },
    ])
    expect(finalizes(out)).toEqual([])
    expect(r.segments().map((s) => s.quality)).toEqual(['live'])
  })

  it('pause closes open speech on every track and ignores VAD until resume', () => {
    const r = mk()
    const out = run(r, [
      { type: 'vad.start', track: 'mic', atMs: 0 },
      hyp('partial', 'mic', words('about the', 100)),
      { type: 'pause', atMs: 900 },
      { type: 'vad.start', track: 'mic', atMs: 1000 },
      { type: 'resume', atMs: 5000 },
      { type: 'vad.start', track: 'mic', atMs: 5200 },
      hyp('endpoint', 'mic', words('after pause', 5300)),
      { type: 'vad.end', track: 'mic', startMs: 5200, endMs: 6000 },
    ])
    const segs = r.segments()
    expect(segs.map((s) => [s.startMs, s.endMs, s.text])).toEqual([
      [0, 900, 'about the'],
      [5200, 6000, 'after pause'],
    ])
    // the partial row is cleared when pausing
    expect(partials(out).map((p) => p.text)).toContain('')
    expect(r.stats.ignoredInputs).toBe(1)
  })

  it('a recorded gap closes the open segment at the gap and keeps offsets on the session timeline', () => {
    const r = mk()
    run(r, [
      { type: 'vad.start', track: 'system', atMs: 1000 },
      hyp('endpoint', 'system', words('before the', 1100)),
      { type: 'gap', track: 'system', atMs: 2000, durationMs: 8000, reason: 'device switch' },
      { type: 'vad.start', track: 'system', atMs: 10_100 },
      hyp('endpoint', 'system', words('after the gap', 10_200)),
      { type: 'vad.end', track: 'system', startMs: 10_100, endMs: 11_200 },
    ])
    expect(r.segments().map((s) => [s.startMs, s.endMs])).toEqual([
      [1000, 2000],
      [10_100, 11_200],
    ])
    expect(r.stats.gaps).toEqual([{ track: 'system', atMs: 2000, durationMs: 8000, reason: 'device switch' }])
  })

  it('a VAD start earlier than the previous end is clamped — no overlap on a track', () => {
    const r = mk()
    run(r, [
      { type: 'vad.start', track: 'mic', atMs: 0 },
      hyp('endpoint', 'mic', words('a b', 0)),
      { type: 'vad.end', track: 'mic', startMs: 0, endMs: 1000 },
      { type: 'vad.start', track: 'mic', atMs: 700 },
      hyp('endpoint', 'mic', words('c d', 1500)),
      { type: 'vad.end', track: 'mic', startMs: 600, endMs: 2500 },
    ])
    assertNoViolations(checkSegments(r.segments()))
    expect(r.segments()[1]!.startMs).toBe(1000)
  })

  it('is deterministic: the same inputs give byte-identical outputs', () => {
    const script: ReconcilerInput[] = [
      { type: 'vad.start', track: 'mic', atMs: 0 },
      hyp('partial', 'mic', words('x y', 10)),
      hyp('endpoint', 'mic', words('x y z', 10)),
      { type: 'vad.end', track: 'mic', startMs: 0, endMs: 1000 },
      { type: 'final', segmentId: 'seg_0001', text: 'X y z.', confidence: 0.5 },
    ]
    expect(JSON.stringify(run(mk(), script))).toBe(JSON.stringify(run(mk(), script)))
  })
})

// ------------------------------------------------------------------------------ property test

/** mulberry32 — tiny seeded PRNG so every failure is reproducible from its seed. */
function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
    chance: (p: number) => next() < p,
  }
}

const VOCAB = [
  'retry',
  'budget',
  'three',
  'attempts',
  'dead',
  'letter',
  'migration',
  'thursday',
  'ana',
  'owns',
]

type Sim = {
  inputs: ReconcilerInput[]
  outputs: ReconcilerOutput[]
  durationMs: number
  failed: Set<string>
}

/**
 * Random sessions: two tracks, VAD regions, partials and endpoints with jittered word times, tier-2
 * results in random order (some empty, some duplicated, some for unknown ids, some failing), pauses,
 * resumes, gaps, and deliberately malformed inputs (ends without starts, starts during speech,
 * timestamps going backwards). Every time stays inside [0, durationMs].
 */
function simulate(seed: number, finalPass: FinalPass): Sim {
  const R = rng(seed)
  const durationMs = R.int(5_000, 60_000)
  const r = new Reconciler({ sessionId: 'ses_prop', finalPass, newSegmentId: counterIds() })
  const inputs: ReconcilerInput[] = []
  const outputs: ReconcilerOutput[] = []
  const requested: string[] = []
  const failed = new Set<string>()
  const feed = (i: ReconcilerInput) => {
    inputs.push(i)
    const o = r.step(i)
    outputs.push(...o)
    for (const x of o) if (x.type === 'finalize') requested.push(x.segmentId)
  }
  const speech: Record<TrackKind, number | null> = { mic: null, system: null }
  const randomWords = (from: number, to: number): TimedWord[] => {
    const n = R.int(0, 6)
    const ws: TimedWord[] = []
    let t = Math.max(0, from)
    for (let i = 0; i < n && t < to; i++) {
      const len = R.int(50, 600)
      ws.push({ text: R.pick(VOCAB), startMs: t, endMs: Math.min(to, t + len) })
      t += len + R.int(0, 300)
    }
    return ws
  }
  const deliverFinal = () => {
    if (!requested.length) return
    const idx = R.int(0, requested.length - 1)
    const id = requested[idx]!
    if (!R.chance(0.2)) requested.splice(idx, 1) // sometimes deliver twice
    if (R.chance(0.08)) {
      failed.add(id)
      feed({ type: 'final.failed', segmentId: id, error: 'boom' })
    } else
      feed({
        type: 'final',
        segmentId: id,
        text: R.chance(0.15) ? '' : `${R.pick(VOCAB)} ${R.pick(VOCAB)}`,
        confidence: R.chance(0.5) ? R.next() : null,
      })
  }

  let now = 0
  while (now < durationMs) {
    now = Math.min(durationMs, now + R.int(10, 700))
    const track: TrackKind = R.pick(['mic', 'system'] as const)
    const roll = R.next()
    if (roll < 0.2) {
      feed({ type: 'vad.start', track, atMs: Math.max(0, now - R.int(0, 400)) })
      speech[track] = now
    } else if (roll < 0.35) {
      const start = speech[track] ?? now - R.int(0, 2000)
      feed({ type: 'vad.end', track, startMs: Math.max(0, start - R.int(-200, 300)), endMs: now })
      speech[track] = null
    } else if (roll < 0.55) {
      feed(hyp('partial', track, randomWords(now - R.int(0, 3000), now), now))
    } else if (roll < 0.7) {
      feed(hyp('endpoint', track, randomWords(now - R.int(0, 4000), now), now))
    } else if (roll < 0.82) {
      deliverFinal()
    } else if (roll < 0.86) {
      feed({ type: 'pause', atMs: now })
    } else if (roll < 0.9) {
      feed({ type: 'resume', atMs: now })
    } else if (roll < 0.93) {
      const dur = R.int(0, 3000)
      feed({ type: 'gap', track: R.chance(0.3) ? null : track, atMs: now, durationMs: dur, reason: 'test' })
      now = Math.min(durationMs, now + dur)
    } else if (roll < 0.96) {
      feed({ type: 'final', segmentId: `seg_bogus_${R.int(0, 9)}`, text: 'ghost', confidence: 2 })
    } else {
      // time going backwards: a stale event from a lagging engine
      feed(hyp('endpoint', track, randomWords(Math.max(0, now - 20_000), now - 5_000), now))
    }
  }
  feed({ type: 'end', atMs: durationMs })
  // Tier 2 drains after the session ends, in random order.
  while (requested.length) deliverFinal()
  return { inputs, outputs, durationMs, failed }
}

describe('reconciler — property: invariants hold for any interleaving', () => {
  const SEEDS = 400
  for (const finalPass of ['during', 'after', 'off'] as const) {
    it(`${SEEDS} random sessions, finalPass=${finalPass}`, () => {
      let totalUpserts = 0
      let totalFinal = 0
      for (let seed = 1; seed <= SEEDS; seed++) {
        const sim = simulate(seed * 7919 + finalPass.length, finalPass)
        const ctx = `seed ${seed} (${finalPass})`
        const ups = upserts(sim.outputs)
        totalUpserts += ups.length
        for (const s of ups) Segment.parse(s) // wire-valid, integer offsets, confidence in [0,1]
        assertNoViolations(checkSegmentHistory(ups), ctx)
        const latest = [...new Map(ups.map((s) => [s.id, s])).values()]
        assertNoViolations(checkSegments(latest, { durationMs: sim.durationMs }), ctx)

        // live → final at most once, and nothing at all after final
        const finalSeen = new Set<string>()
        for (const s of ups) {
          if (finalSeen.has(s.id)) throw new Error(`${ctx}: upsert after final for ${s.id}`)
          if (s.quality === 'final') finalSeen.add(s.id)
        }
        totalFinal += finalSeen.size
        // revisions are consecutive per id
        const rev = new Map<string, number>()
        for (const s of ups) {
          expect(s.revision, ctx).toBe((rev.get(s.id) ?? 0) + 1)
          rev.set(s.id, s.revision)
        }
        // once tier 2 has drained, everything that did not fail is final (unless the pass is off)
        const pending = latest.filter((s) => s.quality !== 'final' && !sim.failed.has(s.id))
        if (finalPass === 'off') expect(finalSeen.size, ctx).toBe(0)
        else
          expect(
            pending.map((s) => s.id),
            ctx,
          ).toEqual([])
        // partial events: speaker follows the track
        for (const o of sim.outputs)
          if (o.type === 'transcript.partial') expect(o.speaker, ctx).toBe(o.track === 'mic' ? 'me' : 'them')
      }
      // guard against a vacuous pass: the generator must actually exercise the machine
      expect(totalUpserts).toBeGreaterThan(SEEDS * 3)
      if (finalPass !== 'off') expect(totalFinal).toBeGreaterThan(SEEDS)
    })
  }

  it('replaying the same seed reproduces the same output stream', () => {
    const a = simulate(42, 'during')
    const b = simulate(42, 'during')
    expect(JSON.stringify(a.outputs)).toBe(JSON.stringify(b.outputs))
  })
})
