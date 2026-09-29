// A-4 — the echo gate: far-end audio that leaks into the microphone must never become "me".
//
// Track A is the user by construction, so attribution can only go wrong about the user in one way: the
// far end playing through laptop speakers, picked up by the mic, and transcribed as the user's words.
// Removing the echo exactly needs a real acoustic echo canceller; what attribution needs is weaker and
// robust — never let a stretch of mic audio that the far end explains reach the recogniser.
//
// It works on 20 ms block energies:
//   · the echo path's delay L is the lag that best correlates mic and far-end log-energy envelopes
//     (re-estimated as the meeting goes; capture misalignment and the acoustic path both land in it);
//   · the far-end reference R[k] is the far-end energy around k − L summed through an exponential
//     reverberant tail (−3 dB per block, about a 0.4 s RT60), so a room's tail still counts as echo;
//   · the echo gain G is the 60th percentile of Em/R over blocks where the far end is talking (double talk is a
//     minority of those in any real meeting, and only pushes the median up, i.e. towards caution).
// A mic block is the user's only if Em > G·R·margin; otherwise it is silenced before VAD and both tiers
// see it. Nothing is ever removed from the recorded WAV.
//
// Tuned on synthetic rooms (packages/stt/test/diarize.test.ts) and measured on the bleed fixtures
// (V-3): it is a gate, not a canceller — leaked syllables that survive are too short for the VAD.
//
// The trade-off is deliberate and one-sided: a quiet syllable of the user's under a loud far end can be
// clipped (it costs a word), but the far end's speech is never attributed to the user.

export type EchoGateOptions = {
  sampleRate?: number
  blockMs?: number
  /** Largest echo delay considered (acoustic path + capture misalignment), ms. */
  maxLagMs?: number
  /** A mic block must exceed the predicted echo by this much to be the user's. */
  marginDb?: number
  /** Far-end blocks quieter than this (dBFS) are silence: no echo to fear, nothing to learn. */
  activeDbfs?: number
  /** Echo path gain (dB) assumed until enough far-end speech has been heard to measure it. */
  priorGainDb?: number
  /** Percentile of observed mic/reference ratios taken as the echo path gain. */
  percentile?: number
  /** Reverberant decay of the far-end reference per block (energy ratio). */
  decay?: number
  /** Keep passing for this long after a block passes, so word tails are not chopped. */
  hangoverMs?: number
}

export type EchoGateStats = {
  blocks: number
  gated: number
  /** Current echo path gain estimate, dB (energy ratio). */
  gainDb: number
  /** Current echo delay estimate, ms (null until measured). */
  lagMs: number | null
}

const EPS = 1e-12
const db = (energy: number) => 10 * Math.log10(Math.max(EPS, energy))
const HISTORY = 500 // blocks (10 s)

export class EchoGate {
  private readonly block: number
  private readonly blockMs: number
  private readonly lagBlocks: number
  private readonly margin: number
  private readonly active: number
  private readonly prior: number
  private readonly pct: number
  private readonly decay: number
  private readonly hangBlocks: number
  /** Block energies keyed by block index on the session timeline. */
  private readonly far = new Map<number, number>()
  private readonly mic = new Map<number, number>()
  private farMax = -1
  private lag: number | null = null
  private lastLagAt = -Infinity
  private readonly ratios: number[] = []
  private gainCache: { at: number; g: number } | null = null
  private hang = 0
  readonly stats: EchoGateStats

  constructor(opts: EchoGateOptions = {}) {
    const sr = opts.sampleRate ?? 16_000
    this.blockMs = opts.blockMs ?? 20
    this.block = Math.round((sr * this.blockMs) / 1000)
    this.lagBlocks = Math.ceil((opts.maxLagMs ?? 300) / this.blockMs)
    this.margin = 10 ** ((opts.marginDb ?? 9) / 10)
    this.active = 10 ** ((opts.activeDbfs ?? -50) / 10)
    this.prior = 10 ** ((opts.priorGainDb ?? -10) / 10)
    this.pct = opts.percentile ?? 0.6
    this.decay = opts.decay ?? 0.5
    this.hangBlocks = Math.ceil((opts.hangoverMs ?? 60) / this.blockMs)
    this.stats = { blocks: 0, gated: 0, gainDb: db(this.prior), lagMs: null }
  }

  /** Session time (ms) up to which far-end audio has been seen. */
  get farCoverageMs(): number {
    return (this.farMax + 1) * this.blockMs
  }

  /** Far-end PCM starting at `atMs`, in order. */
  pushFar(samples: Float32Array, atMs: number): void {
    const first = Math.round(atMs / this.blockMs)
    for (let b = 0; b * this.block < samples.length; b++) {
      const k = first + b
      const e = energy(samples, b * this.block, Math.min(samples.length, (b + 1) * this.block))
      this.far.set(k, Math.max(this.far.get(k) ?? 0, e))
      this.farMax = Math.max(this.farMax, k)
    }
    forget(this.far, this.farMax - HISTORY - this.lagBlocks)
  }

  /** Mic PCM starting at `atMs`; returns it with echo-only blocks silenced (a new array). */
  processMic(samples: Float32Array, atMs: number): Float32Array {
    const out = Float32Array.from(samples)
    const first = Math.round(atMs / this.blockMs)
    for (let b = 0; b * this.block < samples.length; b++) {
      const from = b * this.block
      const to = Math.min(samples.length, from + this.block)
      const k = first + b
      const em = energy(samples, from, to)
      this.mic.set(k, em)
      forget(this.mic, k - HISTORY)
      if (k - this.lastLagAt >= 25) this.estimateLag(k)
      this.stats.blocks++
      const ref = this.reference(k)
      if (ref < this.active) {
        this.hang = 0
        continue // the far end is silent: whatever the mic hears is not echo
      }
      const g = this.gain(k)
      this.ratios.push(em / ref)
      if (this.ratios.length > HISTORY) this.ratios.shift()
      if (em > g * ref * this.margin) {
        this.hang = this.hangBlocks
        continue
      }
      if (this.hang > 0) {
        this.hang--
        continue
      }
      out.fill(0, from, to)
      this.stats.gated++
    }
    return out
  }

  /**
   * Echo the far end could be putting into mic block k: with a known lag, the far-end energy at k − L
   * held with a reverberant decay; before that, conservatively, the loudest block within reach.
   */
  private reference(k: number): number {
    if (this.lag === null) {
      let m = 0
      for (let j = k - this.lagBlocks; j <= k; j++) m = Math.max(m, this.far.get(j) ?? 0)
      return m
    }
    let r = this.far.get(k - this.lag + 1) ?? 0 // a little slack before the estimate
    let w = 1
    for (let j = k - this.lag; j >= k - this.lag - 8; j--) {
      r += (this.far.get(j) ?? 0) * w
      w *= this.decay
    }
    return r
  }

  /** The lag that best correlates the log-energy envelopes over recent far-end activity. */
  private estimateLag(k: number): void {
    this.lastLagAt = k
    const idx: number[] = []
    for (let j = k - HISTORY; j <= k; j++)
      if (this.mic.has(j) && (this.far.get(j) ?? 0) >= this.active) idx.push(j)
    if (idx.length < 100) return
    let best: { lag: number; r: number } | null = null
    for (let lag = 0; lag <= this.lagBlocks; lag++) {
      const xs: number[] = []
      const ys: number[] = []
      for (const j of idx) {
        const f = this.far.get(j - lag)
        if (f === undefined) continue
        xs.push(db(f))
        ys.push(db(this.mic.get(j)!))
      }
      const r = pearson(xs, ys)
      if (!best || r > best.r) best = { lag, r }
    }
    // only trust a clear relationship; without one there is no echo worth modelling (headphones)
    if (best && best.r > 0.5) {
      this.lag = best.lag
      this.stats.lagMs = best.lag * this.blockMs
    }
  }

  /** The echo path gain: a low percentile of recent ratios, or the prior until enough are known. */
  private gain(k: number): number {
    if (this.gainCache?.at === k) return this.gainCache.g
    let g = this.prior
    if (this.ratios.length >= 50) {
      const sorted = [...this.ratios].sort((a, b) => a - b)
      g = sorted[Math.floor(this.pct * (sorted.length - 1))]!
    }
    this.gainCache = { at: k, g }
    this.stats.gainDb = db(g)
    return g
  }
}

function energy(s: Float32Array, from: number, to: number): number {
  let e = 0
  for (let i = from; i < to; i++) e += s[i]! * s[i]!
  return to > from ? e / (to - from) : 0
}

function forget(m: Map<number, number>, before: number): void {
  if (m.size < 2 * HISTORY) return
  for (const k of m.keys()) if (k < before) m.delete(k)
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  let mx = 0
  let my = 0
  for (let i = 0; i < n; i++) {
    mx += xs[i]!
    my += ys[i]!
  }
  mx /= n
  my /= n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx
    const dy = ys[i]! - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0
}
