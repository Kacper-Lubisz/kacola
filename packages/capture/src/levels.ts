// Level maths for the meters. Linear, 0..1, full scale = 1 (a full-scale square wave has rms 1; a
// full-scale sine has rms 1/√2 ≈ 0.707). Int16 is normalised by 32768 and clamped, so -32768 reads as 1.

export type Level = { rms: number; peak: number }

export function levelOf(samples: Int16Array, from = 0, to = samples.length): Level {
  const n = to - from
  if (n <= 0) return { rms: 0, peak: 0 }
  let sum = 0
  let peak = 0
  for (let i = from; i < to; i++) {
    const x = samples[i]!
    sum += x * x
    const a = x < 0 ? -x : x
    if (a > peak) peak = a
  }
  return { rms: Math.min(1, Math.sqrt(sum / n) / 32768), peak: Math.min(1, peak / 32768) }
}

/**
 * Accumulates samples and emits one level per fixed window (default 100 ms), regardless of how the
 * input is chunked. `onLevel` receives the window's end position in samples.
 */
export class LevelMeter {
  private readonly window: number
  private readonly onLevel: (lvl: Level, endSample: number) => void
  private sum = 0
  private peak = 0
  private count = 0
  private position = 0

  constructor(windowSamples: number, onLevel: (lvl: Level, endSample: number) => void) {
    if (windowSamples <= 0) throw new Error('window must be positive')
    this.window = windowSamples
    this.onLevel = onLevel
  }

  push(samples: Int16Array): void {
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i]!
      this.sum += x * x
      const a = x < 0 ? -x : x
      if (a > this.peak) this.peak = a
      this.position++
      if (++this.count === this.window) {
        this.onLevel(
          {
            rms: Math.min(1, Math.sqrt(this.sum / this.count) / 32768),
            peak: Math.min(1, this.peak / 32768),
          },
          this.position,
        )
        this.sum = 0
        this.peak = 0
        this.count = 0
      }
    }
  }
}
