import { writeFileSync } from 'node:fs'

// Synthetic, analysable audio for capture tests. Speech fixtures prove STT; these prove the plumbing:
// each track gets tones at its own frequency, in bursts at known offsets, so separation (is the mic
// signal only on the mic track?), timing (did any samples go missing?) and alignment (do the tracks
// line up?) can be measured exactly with a Goertzel filter instead of eyeballed.

export const RATE = 16_000

export type Burst = { atMs: number; durationMs: number }

export type ToneFixture = {
  /** Tone frequency in Hz. Keep fixtures' frequencies far apart (≥ 300 Hz) and off each other's harmonics. */
  freq: number
  bursts: Burst[]
  totalMs: number
  /** Peak amplitude 0..1. Default 0.5 (rms ≈ 0.354). */
  amplitude?: number
  /** Fade in/out per burst, ms (avoids clicks that smear energy across frequencies). Default 5. */
  rampMs?: number
}

/** Render a fixture to 16 kHz mono Int16. */
export function synthesize(f: ToneFixture, rate = RATE): Int16Array {
  const n = Math.round((f.totalMs / 1000) * rate)
  const out = new Int16Array(n)
  const amp = (f.amplitude ?? 0.5) * 32767
  const ramp = Math.max(1, Math.round(((f.rampMs ?? 5) / 1000) * rate))
  for (const b of f.bursts) {
    const s0 = Math.round((b.atMs / 1000) * rate)
    const len = Math.round((b.durationMs / 1000) * rate)
    for (let i = 0; i < len && s0 + i < n; i++) {
      const env = Math.min(1, i / ramp, (len - 1 - i) / ramp)
      out[s0 + i] = Math.round(amp * env * Math.sin((2 * Math.PI * f.freq * i) / rate))
    }
  }
  return out
}

/** Linear chirp (for anything that wants a signal whose position is unambiguous). */
export function chirp(
  fromHz: number,
  toHz: number,
  durationMs: number,
  amplitude = 0.5,
  rate = RATE,
): Int16Array {
  const n = Math.round((durationMs / 1000) * rate)
  const out = new Int16Array(n)
  const k = (toHz - fromHz) / (durationMs / 1000)
  for (let i = 0; i < n; i++) {
    const t = i / rate
    out[i] = Math.round(amplitude * 32767 * Math.sin(2 * Math.PI * (fromHz * t + (k * t * t) / 2)))
  }
  return out
}

export function encodeWav16(samples: Int16Array, rate = RATE): Buffer {
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0, 'ascii')
  h.writeUInt32LE(36 + data.length, 4)
  h.write('WAVE', 8, 'ascii')
  h.write('fmt ', 12, 'ascii')
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24)
  h.writeUInt32LE(rate * 2, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36, 'ascii')
  h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

export function writeFixture(path: string, f: ToneFixture): string {
  writeFileSync(path, encodeWav16(synthesize(f)))
  return path
}

/**
 * Goertzel power of `freq` over samples[from, to), normalised so a full-scale sine at exactly `freq`
 * reads ≈ 0.25 (amplitude²/4) regardless of window length. Int16 input is scaled to ±1.
 */
export function goertzel(
  samples: Int16Array,
  freq: number,
  from = 0,
  to = samples.length,
  rate = RATE,
): number {
  const n = to - from
  if (n <= 0) return 0
  const w = (2 * Math.PI * freq) / rate
  const coeff = 2 * Math.cos(w)
  let s1 = 0
  let s2 = 0
  for (let i = from; i < to; i++) {
    const s0 = samples[i]! / 32768 + coeff * s1 - s2
    s2 = s1
    s1 = s0
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2
  return power / (n * n)
}

export type DetectedBurst = { startMs: number; endMs: number }

/**
 * Find bursts of `freq` by sliding a Goertzel window (10 ms, 5 ms hop) and thresholding at `ratio` of the
 * tone's expected power at `amplitude`. Edges are refined to the sample where the envelope crosses half
 * the amplitude, so onsets are accurate to well under a millisecond on clean signals.
 */
export function detectBursts(
  samples: Int16Array,
  freq: number,
  opts: { amplitude?: number; ratio?: number; rate?: number } = {},
): DetectedBurst[] {
  const rate = opts.rate ?? RATE
  const win = Math.round(rate / 100)
  const hop = Math.round(rate / 200)
  const expected = (opts.amplitude ?? 0.5) ** 2 / 4
  const thr = expected * (opts.ratio ?? 0.1)
  const out: DetectedBurst[] = []
  let on: number | null = null
  for (let s = 0; s + win <= samples.length; s += hop) {
    const p = goertzel(samples, freq, s, s + win, rate)
    if (p >= thr && on === null) on = s
    else if (p < thr && on !== null) {
      out.push(refine(samples, on, s + win, opts.amplitude ?? 0.5, rate))
      on = null
    }
  }
  if (on !== null) out.push(refine(samples, on, samples.length, opts.amplitude ?? 0.5, rate))
  return out
}

function refine(samples: Int16Array, roughStart: number, roughEnd: number, amplitude: number, rate: number) {
  const half = amplitude * 0.5 * 32768
  let a = Math.max(0, roughStart - rate / 100)
  while (a < roughEnd && Math.abs(samples[a]!) < half) a++
  let b = Math.min(samples.length - 1, roughEnd + rate / 100)
  while (b > a && Math.abs(samples[b]!) < half) b--
  return { startMs: (a / rate) * 1000, endMs: ((b + 1) / rate) * 1000 }
}

/** Power ratio in dB of `signal` vs `leak` frequencies over a range. */
export function separationDb(
  samples: Int16Array,
  signalHz: number,
  leakHz: number,
  from = 0,
  to = samples.length,
) {
  const s = goertzel(samples, signalHz, from, to)
  const l = goertzel(samples, leakHz, from, to)
  return 10 * Math.log10((s + 1e-20) / (l + 1e-20))
}

export function rms(samples: Int16Array, from = 0, to = samples.length): number {
  let acc = 0
  for (let i = from; i < to; i++) acc += (samples[i]! / 32768) ** 2
  return to > from ? Math.sqrt(acc / (to - from)) : 0
}
