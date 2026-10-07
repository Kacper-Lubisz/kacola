import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type Baseline,
  compareToBaseline,
  normalizeWords,
  numberToWords,
  percentile,
  readBaseline,
  summarizeLatency,
  updatingBaselines,
  wer,
  writeBaseline,
} from '../src/metrics/index.ts'

describe('normalizeWords', () => {
  it.each([
    [
      'The retry budget is 3 attempts, then dead-letter.',
      'the retry budget is three attempts then dead letter',
    ],
    ['The migration lands Thursday!', 'the migration lands thursday'],
    ["Ana's team doesn't ship on the 1st.", "ana's team doesn't ship on the first"],
    ['We hit 95% of 2,048 requests', 'we hit ninety five percent of two thousand forty eight requests'],
    ['It costs $20 — about 3.5 hours', 'it costs twenty dollars about three point five hours'],
    ['OK, alright', 'okay all right'],
    ['“Quoted” ‘text’', 'quoted text'],
    ['the 22nd and 101st', 'the twenty second and one hundred first'],
  ])('%s', (input, expected) => {
    expect(normalizeWords(input).join(' ')).toBe(expected)
  })

  it('spells numbers', () => {
    expect(numberToWords(0)).toBe('zero')
    expect(numberToWords(40)).toBe('forty')
    expect(numberToWords(2024)).toBe('two thousand twenty four')
    expect(numberToWords(1_000_001)).toBe('one million one')
  })
})

describe('wer', () => {
  it('is zero for identical text modulo case, punctuation and number format', () => {
    expect(wer('The retry budget is three attempts.', 'the retry budget is 3 attempts').wer).toBe(0)
  })

  it('counts substitutions, deletions and insertions', () => {
    expect(wer('the cat sat on the mat', 'the bat sat on the mat')).toEqual({
      wer: 1 / 6,
      substitutions: 1,
      deletions: 0,
      insertions: 0,
      refWords: 6,
      hypWords: 6,
    })
    expect(wer('the cat sat on the mat', 'the cat sat on mat')).toMatchObject({ wer: 1 / 6, deletions: 1 })
    expect(wer('the cat sat', 'the fat cat sat')).toMatchObject({ wer: 1 / 3, insertions: 1 })
    const mixed = wer('the cat sat on the mat', 'the bat sat on mat today')
    expect(mixed.wer).toBe(3 / 6)
    expect(mixed.substitutions + mixed.deletions + mixed.insertions).toBe(3)
  })

  it('handles empty sides', () => {
    expect(wer('', '').wer).toBe(0)
    expect(wer('', 'hallucinated words').wer).toBe(1)
    expect(wer('three words here', '')).toMatchObject({ wer: 1, deletions: 3 })
  })

  it('can exceed 1 with many insertions', () => {
    expect(wer('yes', 'yes yes yes yes').wer).toBe(3)
  })

  it('accepts arrays of utterances', () => {
    expect(wer(['hello there', 'general kenobi'], ['hello there general', 'kenobi']).wer).toBe(0)
  })

  it('finds the minimum edit distance, not a greedy one', () => {
    // a greedy aligner would substitute 4 words; the optimum is 1 deletion + 1 insertion
    expect(wer('a b c d e', 'b c d e f')).toMatchObject({ deletions: 1, insertions: 1, substitutions: 0 })
  })
})

describe('latency stats', () => {
  it('interpolates percentiles', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5)
    expect(percentile([10], 95)).toBe(10)
    expect(percentile([0, 100], 95)).toBe(95)
    expect(Number.isNaN(percentile([], 50))).toBe(true)
    const s = summarizeLatency([100, 200, 300, 400, 1000])
    expect(s).toMatchObject({ n: 5, p50: 300, max: 1000, mean: 400 })
    expect(s.p95).toBeCloseTo(880, 9)
  })
})

describe('baselines', () => {
  const base: Baseline = {
    fixture: 'f',
    config: 'live=a+final=b',
    metrics: { wer: 0.1, rtf: 0.2, accuracy: 0.9 },
    bands: { wer: { abs: 0.02 }, rtf: { rel: 1 }, accuracy: { abs: 0.05, direction: 'higher-is-better' } },
    recordedAt: '2026-09-28T00:00:00Z',
  }

  it('passes inside the band and fails beyond it, per metric', () => {
    expect(compareToBaseline(base, { wer: 0.119, rtf: 0.39, accuracy: 0.86 }).ok).toBe(true)
    const bad = compareToBaseline(base, { wer: 0.13, rtf: 0.41, accuracy: 0.84 })
    expect(bad.ok).toBe(false)
    expect(bad.failures).toHaveLength(3)
    expect(bad.failures[0]).toMatch(/^wer: 0\.1300 is worse than baseline 0\.1000/)
  })

  it('flags improvements beyond the band so the baseline can be tightened', () => {
    const c = compareToBaseline(base, { wer: 0.05, rtf: 0.2, accuracy: 0.9 })
    expect(c.ok).toBe(true)
    expect(c.rows.find((r) => r.metric === 'wer')?.improved).toBe(true)
  })

  it('fails when a metric was not measured', () => {
    expect(compareToBaseline(base, { wer: 0.1, rtf: 0.2 }).failures).toEqual([
      'accuracy: no measurement (baseline 0.9)',
    ])
  })

  it('round-trips through committed JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baselines-'))
    try {
      expect(readBaseline('f', base.config, dir)).toBeNull()
      const p = writeBaseline(base, dir)
      expect(p).toBe(join(dir, 'f__live_a_final_b.json'))
      expect(readBaseline('f', base.config, dir)).toEqual(base)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('update mode is explicit', () => {
    expect(updatingBaselines({})).toBe(false)
    expect(updatingBaselines({ KACOLA_UPDATE_BASELINES: '1' })).toBe(true)
  })
})
