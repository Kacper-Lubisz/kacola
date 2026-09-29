import { describe, expect, it } from 'vitest'
import { der, maxWeightMatching, type Turn } from '../src/metrics/index.ts'

// A-7 — the DER metric against hand-computed cases. Times in ms; each expectation is worked out in the
// comment beside it.

const t = (speaker: string, startMs: number, endMs: number): Turn => ({ speaker, startMs, endMs })

describe('der', () => {
  it('is zero for a perfect hypothesis, whatever the hypothesis calls the speakers', () => {
    const ref = [t('Ana', 0, 1000), t('Ben', 1000, 3000), t('Ana', 3500, 4000)]
    expect(der(ref, ref).der).toBe(0)
    const renamed = [t('s2', 0, 1000), t('s0', 1000, 3000), t('s2', 3500, 4000)]
    const r = der(ref, renamed)
    expect(r.der).toBe(0)
    expect(r.mapping).toEqual({ s0: 'Ben', s2: 'Ana' })
    expect(r.scoredMs).toBe(3500)
  })

  it('missed speech: ref Ana 0–10 s, hyp Ana 0–6 s → 4 / 10', () => {
    const r = der([t('A', 0, 10_000)], [t('x', 0, 6000)])
    expect(r).toMatchObject({ missedMs: 4000, falseAlarmMs: 0, confusionMs: 0, scoredMs: 10_000, der: 0.4 })
  })

  it('false alarm: an extra 2 s of speech nobody said → 2 / 10', () => {
    const r = der([t('A', 0, 10_000)], [t('x', 0, 10_000), t('y', 10_000, 12_000)])
    expect(r).toMatchObject({ missedMs: 0, falseAlarmMs: 2000, confusionMs: 0, der: 0.2 })
  })

  it('confusion: one hypothesis speaker for two people → half the time is the wrong person', () => {
    // ref A 0–10, B 10–30; hyp X 0–30 → X maps to B (20 s shared), 10 s of A are confused
    const r = der([t('A', 0, 10_000), t('B', 10_000, 30_000)], [t('X', 0, 30_000)])
    expect(r.mapping).toEqual({ X: 'B' })
    expect(r).toMatchObject({ missedMs: 0, falseAlarmMs: 0, confusionMs: 10_000, scoredMs: 30_000 })
    expect(r.der).toBeCloseTo(1 / 3)
  })

  it('the mapping is one-to-one: two hypothesis speakers for one person confuse the smaller', () => {
    // ref A 0–20; hyp X 0–15, Y 15–20 → X→A; Y unmapped: 5 s confused
    const r = der([t('A', 0, 20_000)], [t('X', 0, 15_000), t('Y', 15_000, 20_000)])
    expect(r.mapping).toEqual({ X: 'A' })
    expect(r.confusionMs).toBe(5000)
    expect(r.der).toBe(0.25)
  })

  it('overlapped reference speech counts each speaker: a single-speaker hypothesis misses the other', () => {
    // ref A 0–10, B 5–15 (scored 10 + 10 = 20); hyp X 0–10, Y 10–15
    // 0–5: A/X ✓ · 5–10: A+B vs X → 5 s missed · 10–15: B/Y ✓
    const r = der([t('A', 0, 10_000), t('B', 5000, 15_000)], [t('X', 0, 10_000), t('Y', 10_000, 15_000)])
    expect(r).toMatchObject({ scoredMs: 20_000, missedMs: 5000, falseAlarmMs: 0, confusionMs: 0, der: 0.25 })
    // …and with overlap excluded from scoring, it is perfect on the rest (0–5 and 10–15)
    expect(
      der([t('A', 0, 10_000), t('B', 5000, 15_000)], [t('X', 0, 10_000), t('Y', 10_000, 15_000)], {
        skipOverlap: true,
      }),
    ).toMatchObject({ der: 0, scoredMs: 10_000 })
  })

  it('a collar forgives boundary jitter within ±collar of every reference boundary', () => {
    const ref = [t('A', 1000, 2000)]
    const hyp = [t('x', 1100, 2150)]
    // no collar: 100 missed + 150 false alarm over 1000
    expect(der(ref, hyp).der).toBeCloseTo(0.25)
    // collar 250: scored only 1250–1750 (500 ms), all correct
    expect(der(ref, hyp, { collarMs: 250 })).toMatchObject({ der: 0, scoredMs: 500 })
  })

  it('handles the degenerate cases', () => {
    expect(der([], []).der).toBe(0)
    expect(der([], [t('x', 0, 1000)]).der).toBe(Number.POSITIVE_INFINITY)
    expect(der([t('A', 0, 1000)], []).der).toBe(1)
    // zero-length and inverted turns are ignored
    expect(der([t('A', 0, 1000), t('B', 500, 500)], [t('x', 0, 1000), t('y', 900, 800)]).der).toBe(0)
  })

  it('combines all three error kinds', () => {
    // ref: A 0–4, B 4–8, A 8–10 (scored 10 s)
    // hyp: X 0–3, Y 3–8, X 8–12
    //   X→A (3 + 2 = 5 s), Y→B (4 s)
    //   0–3 ✓ · 3–4 A said, Y speaks → confusion 1 · 4–8 ✓ · 8–10 ✓ · 10–12 false alarm 2
    const r = der(
      [t('A', 0, 4000), t('B', 4000, 8000), t('A', 8000, 10_000)],
      [t('X', 0, 3000), t('Y', 3000, 8000), t('X', 8000, 12_000)],
    )
    expect(r).toMatchObject({ missedMs: 0, falseAlarmMs: 2000, confusionMs: 1000, scoredMs: 10_000 })
    expect(r.der).toBeCloseTo(0.3)
  })
})

describe('maxWeightMatching', () => {
  it('finds the maximum-weight one-to-one assignment', () => {
    // greedy would take 9 (0→0) then 1 (1→1) = 10; optimal is 8 + 7 = 15
    expect(
      maxWeightMatching([
        [9, 8],
        [7, 1],
      ]),
    ).toEqual([1, 0])
    expect(
      maxWeightMatching([
        [1, 2, 3],
        [3, 2, 1],
        [2, 3, 1],
      ]),
    ).toEqual([2, 0, 1])
  })
  it('rectangular: more rows than columns leaves the weakest row unmatched', () => {
    expect(maxWeightMatching([[5], [9], [1]])).toEqual([-1, 0, -1])
    expect(maxWeightMatching([[1, 9, 2]])).toEqual([1])
    expect(maxWeightMatching([])).toEqual([])
  })
})
