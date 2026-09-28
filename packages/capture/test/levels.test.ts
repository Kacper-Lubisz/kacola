import { describe, expect, it } from 'vitest'
import { type Level, LevelMeter, levelOf } from '../src/index.ts'

const sine = (n: number, amp: number, period = 37) => {
  const s = new Int16Array(n)
  for (let i = 0; i < n; i++) s[i] = Math.round(amp * 32767 * Math.sin((2 * Math.PI * i) / period))
  return s
}

describe('levelOf', () => {
  it('silence is 0/0', () => {
    expect(levelOf(new Int16Array(100))).toEqual({ rms: 0, peak: 0 })
    expect(levelOf(new Int16Array(0))).toEqual({ rms: 0, peak: 0 })
  })

  it('a sine of amplitude A has rms A/√2 and peak A', () => {
    for (const a of [1, 0.5, 0.1]) {
      const l = levelOf(sine(37 * 100, a))
      expect(l.rms).toBeCloseTo(a / Math.SQRT2, 3)
      expect(l.peak).toBeCloseTo(a, 2) // period 37 never lands exactly on the crest
    }
  })

  it('a full-scale square wave reads 1/1, and -32768 is clamped to 1', () => {
    const sq = new Int16Array(100).map((_, i) => (i % 2 ? 32767 : -32768))
    const l = levelOf(sq)
    expect(l.peak).toBe(1)
    expect(l.rms).toBeGreaterThan(0.9999)
    expect(l.rms).toBeLessThanOrEqual(1)
  })

  it('respects the sub-range', () => {
    const s = new Int16Array(200)
    s.fill(16384, 100)
    expect(levelOf(s, 0, 100)).toEqual({ rms: 0, peak: 0 })
    expect(levelOf(s, 100, 200)).toEqual({ rms: 0.5, peak: 0.5 })
  })
})

describe('LevelMeter', () => {
  it('emits one level per window regardless of how input is chunked', () => {
    const signal = sine(16000 * 2 + 700, 0.3, 23)
    const collect = (chunks: number[]) => {
      const out: Array<[Level, number]> = []
      const m = new LevelMeter(1600, (l, end) => out.push([l, end]))
      let pos = 0
      for (const c of chunks) {
        m.push(signal.subarray(pos, Math.min(signal.length, pos + c)))
        pos += c
      }
      m.push(signal.subarray(pos))
      return out
    }
    const whole = collect([])
    expect(whole).toHaveLength(20)
    expect(whole.map(([, e]) => e)).toEqual(Array.from({ length: 20 }, (_, i) => (i + 1) * 1600))
    let seed = 7
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return 1 + (seed % 2000)
    }
    for (let trial = 0; trial < 20; trial++) {
      const chunks = Array.from({ length: 60 }, rnd)
      expect(collect(chunks)).toEqual(whole)
    }
    for (const [l] of whole) {
      expect(l.rms).toBeCloseTo(0.3 / Math.SQRT2, 2)
      expect(l.peak).toBeGreaterThan(0.29)
    }
  })

  it('matches levelOf on each window', () => {
    const s = sine(4800, 0.8, 11)
    s.fill(0, 1600, 3200)
    const out: Level[] = []
    new LevelMeter(1600, (l) => out.push(l)).push(s)
    expect(out).toEqual([levelOf(s, 0, 1600), levelOf(s, 1600, 3200), levelOf(s, 3200, 4800)])
    expect(out[1]).toEqual({ rms: 0, peak: 0 })
  })

  it('rejects a non-positive window', () => {
    expect(() => new LevelMeter(0, () => {})).toThrow()
  })
})
