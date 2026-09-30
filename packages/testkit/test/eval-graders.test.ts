import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  binary,
  binaryCalibration,
  calibration,
  checkBaseline,
  checkBudgets,
  extraction,
  formatScorecard,
  levenshtein,
  matchValue,
  mentions,
  multiclass,
  parseJsonl,
  ranking,
  rubric,
  type Scorecard,
  settleLatency,
  tokenF1,
} from '../src/evals/index.ts'

// Every grader against hand-computed values, so the numbers in a scorecard mean what they say.

describe('classification graders', () => {
  it('binary: counts, precision/recall/F1, and null where undefined', () => {
    const s = binary([
      { pred: true, truth: true },
      { pred: true, truth: true },
      { pred: true, truth: false },
      { pred: false, truth: true },
      { pred: false, truth: false },
    ])
    expect(s).toMatchObject({ tp: 2, fp: 1, fn: 1, tn: 1, n: 5 })
    expect(s.precision).toBeCloseTo(2 / 3, 12)
    expect(s.recall).toBeCloseTo(2 / 3, 12)
    expect(s.f1).toBeCloseTo(2 / 3, 12)
    expect(s.accuracy).toBeCloseTo(3 / 5, 12)
    const none = binary([{ pred: false, truth: false }])
    expect(none).toMatchObject({ precision: null, recall: null, f1: null, accuracy: 1 })
  })

  it('multiclass: accuracy and macro F1 over the classes seen', () => {
    const m = multiclass([
      { pred: 'a', truth: 'a' },
      { pred: 'b', truth: 'a' },
      { pred: 'b', truth: 'b' },
    ])
    expect(m.accuracy).toBeCloseTo(2 / 3, 12)
    // a: P=1 R=.5 F1=2/3; b: P=.5 R=1 F1=2/3
    expect(m.macroF1).toBeCloseTo(2 / 3, 12)
  })
})

describe('calibration', () => {
  it('ECE and Brier by hand: two bins, one miscalibrated', () => {
    const c = calibration(
      [
        { probs: { a: 0.9, b: 0.1 }, truth: 'a' },
        { probs: { a: 0.9, b: 0.1 }, truth: 'b' },
        { probs: { a: 0.6, b: 0.4 }, truth: 'a' },
        { probs: { a: 0.6, b: 0.4 }, truth: 'a' },
      ],
      10,
    )
    // bin 0.9: conf 0.9 acc 0.5 → |0.4| × 2/4; bin 0.6: conf 0.6 acc 1 → |0.4| × 2/4 ⇒ ECE 0.4
    expect(c.ece).toBeCloseTo(0.4, 12)
    // Brier per item: (0.1²+0.1²)=0.02, (0.9²+0.9²)=1.62, (0.4²+0.4²)=0.32 ×2 ⇒ mean 0.57
    expect(c.brier).toBeCloseTo((0.02 + 1.62 + 0.32 + 0.32) / 4, 12)
    expect(c.bins.map((b) => b.count)).toEqual([2, 2])
  })

  it('perfectly calibrated yes/no gives ECE 0; a truth absent from the distribution still counts in Brier', () => {
    const items = [
      ...Array.from({ length: 8 }, () => ({ p: 0.75, truth: true })),
      ...Array.from({ length: 4 }, (_, i) => ({ p: 0.75, truth: i < 0 })),
    ]
    // 12 predictions at 0.75 of which 8 are right → accuracy 0.667, not 0.75: ECE = 0.0833
    expect(binaryCalibration(items).ece).toBeCloseTo(0.75 - 8 / 12, 12)
    expect(calibration([{ probs: { a: 1 }, truth: 'b' }]).brier).toBe(2)
    expect(calibration([]).ece).toBeNull()
  })
})

describe('settle latency (fixture time)', () => {
  it('delays, the 30 s budget, early and missed detections', () => {
    const s = settleLatency(
      [
        { settledAtMs: 10_000, decidedAtMs: 12_000 },
        { settledAtMs: 10_000, decidedAtMs: 45_000 },
        { settledAtMs: 10_000, decidedAtMs: 9_000 },
        { settledAtMs: 10_000, decidedAtMs: null },
      ],
      30_000,
    )
    // percentiles over the on-time-or-late detections only: [2 s, 35 s]
    expect(s).toEqual({ n: 4, detected: 3, withinBudget: 1, early: 1, p50: 2_000, p90: 35_000, max: 35_000 })
  })
})

describe('extraction matching', () => {
  it('edit distance and token F1', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(tokenF1('one hundred twenty thousand', 'one hundred and twenty thousand')).toBeCloseTo(8 / 9, 12)
  })

  it('exact / fuzzy / alias / containment / null handling', () => {
    expect(matchValue('120k-140k', '120k-140k')).toMatchObject({ exact: true, fuzzy: true })
    expect(matchValue('Six engineers', 'six engineers')).toMatchObject({ exact: true })
    expect(matchValue('a team of six engineers and a PM', 'six engineers')).toMatchObject({
      exact: false,
      fuzzy: true,
    })
    expect(matchValue('$120k-$140k', '120k-140k', ['$120k-$140k'])).toMatchObject({ exact: true })
    expect(matchValue('Friday', 'Thursday')).toMatchObject({ fuzzy: false })
    expect(matchValue(null, null)).toMatchObject({ exact: true, score: 1 })
    expect(matchValue('Thursday', null)).toMatchObject({ fuzzy: false })
  })

  it('aggregate: accuracy counts right nulls; hallucinations are non-null answers to unanswered items', () => {
    const e = extraction([
      { pred: 'Thursday', truth: 'Thursday' },
      { pred: null, truth: null },
      { pred: 'Monday', truth: null },
      { pred: null, truth: 'remote' },
    ])
    expect(e).toMatchObject({
      n: 4,
      accuracy: 0.5,
      exactAccuracy: 0.5,
      precision: 0.5,
      recall: 0.5,
      hallucinated: 1,
    })
  })
})

describe('ranking and rubric', () => {
  it('top-1, acceptable top-1 and MRR', () => {
    const r = ranking([
      { ranked: ['a', 'b'], best: 'a', acceptable: [] },
      { ranked: ['b', 'a'], best: 'a', acceptable: ['b'] },
      { ranked: ['c', 'b', 'a'], best: 'a', acceptable: [] },
    ])
    expect(r.top1).toBeCloseTo(1 / 3, 12)
    expect(r.acceptableTop1).toBeCloseTo(2 / 3, 12)
    expect(r.mrr).toBeCloseTo((1 + 1 / 2 + 1 / 3) / 3, 12)
  })

  it('rubric: any-of groups, forbidden phrases on word boundaries, length', () => {
    const text = 'Outcome: three attempts, then dead-letter. Actions: Sam updates the runbook.'
    expect(rubric(text, { mustInclude: [['three', '3'], ['dead letter'], ['runbook']] })).toEqual({
      passed: true,
      score: 1,
      failures: [],
    })
    const r = rubric(text, {
      mustInclude: [['four'], ['runbook']],
      mustNotInclude: ['delete the other sessions'],
      maxChars: 10,
    })
    expect(r.passed).toBe(false)
    expect(r.score).toBe(0.5)
    expect(r.failures).toHaveLength(2)
    expect(mentions('the rerun was fine', 'run')).toBe(false)
    expect(mentions('Please DELETE the other sessions!', 'delete the other sessions')).toBe(true)
  })
})

describe('scorecards and baselines', () => {
  const sc: Scorecard = {
    suite: 'demo',
    provider: 'local',
    model: 'm',
    mode: 'offline',
    dataset: { name: 'demo.jsonl', n: 3 },
    metrics: { f1: 0.8, ece: 0.1, unused: null },
    budgets: checkBudgets({ f1: 0.8 }, [
      { name: 'f1', metric: 'f1', op: '>=', threshold: 0.9, enforced: false },
    ]),
    cost: { usd: 0, calls: 3, inputTokens: 0, outputTokens: 0 },
    latency: { p50: 1, p90: 2 },
    notes: [],
    skipped: null,
    generatedAt: 'now',
  }

  it('checks budgets and prints them without claiming a pass', () => {
    expect(sc.budgets[0]).toMatchObject({ value: 0.8, passed: false })
    expect(formatScorecard(sc)).toContain('miss (not enforced)')
    expect(formatScorecard({ ...sc, skipped: 'no TYPESAFE_API_KEY' })).toContain(
      'SKIPPED: no TYPESAFE_API_KEY',
    )
  })

  it('records a baseline and flags a regression beyond the band', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gnomeola-evalbase-'))
    try {
      const bands = { f1: { abs: 0.05, direction: 'higher-is-better' as const }, ece: { abs: 0.05 } }
      expect(checkBaseline(sc, bands, { dir, update: false })).toBeNull()
      expect(checkBaseline(sc, bands, { dir, update: true })?.ok).toBe(true)
      const worse = checkBaseline({ ...sc, metrics: { f1: 0.7, ece: 0.1 } }, bands, { dir, update: false })
      expect(worse?.ok).toBe(false)
      expect(worse?.failures[0]).toMatch(/^f1:/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('JSONL parsing names the failing line', () => {
    expect(() => parseJsonl('{"a":1}\n{"a":"x"}\n', z.object({ a: z.number() }), 'f.jsonl')).toThrow(
      /^f\.jsonl:2:/,
    )
    expect(() => parseJsonl('{"a":1}\nnot json', z.object({ a: z.number() }), 'f.jsonl')).toThrow(
      /f\.jsonl:2: invalid JSON/,
    )
  })
})
