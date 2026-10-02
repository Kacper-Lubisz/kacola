import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AGENDA_RULES, HashingEmbedder, LocalDecisionProvider } from '@gnomeola/decisions'
import { describe, expect, it } from 'vitest'
import type { ProviderSetup } from '../src/providers.ts'
import {
  listRealFixtures,
  livePublications,
  loadRealFixture,
  quantile,
  REAL_SAMPLE_FIXTURE,
  REAL_SUITE,
  type RealFixture,
  realFixtureSkipReason,
  replayOrder,
  replayReal,
  runRealCoverageSuite,
  runRealSuites,
  scoreReal,
} from '../src/real.ts'
import { decisionStatusRunner } from '../src/runners.ts'
import type { ReplayUtterance, StatusReport, StatusRunner } from '../src/types.ts'

// The real-meeting coverage suite on a tiny synthetic transcript (testkit fixtures/evals/real-sample: a
// made-up interview, no real data): loader checks, replay order, and hand-computed scores for a scripted
// runner.

const SAMPLE = REAL_SAMPLE_FIXTURE
const sample = (): RealFixture => loadRealFixture(SAMPLE)

/** Reports keyed by the segment index they come on. */
function scripted(plan: Record<number, StatusReport[]>, seen: ReplayUtterance[][] = []): StatusRunner {
  return {
    name: 'scripted',
    provider: 'none',
    model: 'script',
    mode: 'offline',
    start: () => ({
      async onSegment(u, history) {
        seen.push([...history])
        return {
          reports: plan[u.index] ?? [],
          usage: { usd: 0.001, inputTokens: 10, outputTokens: 2, calls: 1 },
        }
      },
    }),
  }
}
const r = (
  itemId: string,
  action: StatusReport['action'],
  extra: Partial<StatusReport> = {},
): StatusReport => ({
  itemId,
  pCovered: action === 'auto-covered' ? 0.9 : action === 'suggest-covered' ? 0.6 : 0.1,
  action,
  evidenceIndex: null,
  ...extra,
})

// culture (partial) and next-steps (before it came up) tick on s1; team-size on s2; remote is only
// suggested on s5; how-decide ticks on s6, 9 s after its answer (s4); salary (never said) ticks on s7
const PLAN: Record<number, StatusReport[]> = {
  1: [
    r('culture', 'auto-covered', { evidenceIndex: 1 }),
    r('next-steps', 'auto-covered', { evidenceIndex: 1 }),
  ],
  2: [r('team-size', 'auto-covered', { evidenceIndex: 2, answer: 'twelve engineers' })],
  5: [r('remote', 'suggest-covered')],
  6: [r('how-decide', 'auto-covered', { evidenceIndex: 4 })],
  7: [r('salary', 'auto-covered', { evidenceIndex: 7, answer: '100k' })],
}

describe('loader', () => {
  it('loads the sample and checks labels against the transcript', () => {
    const fx = sample()
    expect(fx.name).toBe('real-sample')
    expect(fx.transcript.segments).toHaveLength(8)
    expect(fx.labels.items.map((i) => i.coverage)).toEqual([
      'full',
      'full',
      'full',
      'partial',
      'none',
      'none',
    ])
  })

  const broken = (
    mutate: (labels: Record<string, unknown> & { items: Record<string, unknown>[] }) => void,
  ) => {
    const dir = mkdtempSync(join(tmpdir(), 'real-'))
    cpSync(SAMPLE, dir, { recursive: true })
    const labels = JSON.parse(readFileSync(join(dir, 'labels.json'), 'utf8'))
    mutate(labels)
    writeFileSync(join(dir, 'labels.json'), JSON.stringify(labels))
    return () => loadRealFixture(dir)
  }

  it('rejects unknown segment ids, contradictory coverage, bad kinds and duplicates', () => {
    expect(broken((l) => (l.items[0]!.answeredAt = 'nope'))).toThrow(/unknown segment id nope/)
    expect(broken((l) => (l.items[4]!.answeredAt = 's1'))).toThrow(/coverage none but answeredAt/)
    expect(broken((l) => (l.items[0]!.answeredAt = null))).toThrow(/covered but no answeredAt/)
    expect(broken((l) => (l.items[0]!.kind = 'gossip'))).toThrow(/unknown kind/)
    expect(broken((l) => (l.items[1]!.id = 'team-size'))).toThrow(/duplicate item id/)
  })

  it('skips with a reason when there is no private fixture, and finds one when there is', () => {
    const root = mkdtempSync(join(tmpdir(), 'private-'))
    expect(listRealFixtures(join(root, 'missing'))).toEqual([])
    expect(realFixtureSkipReason(root)).toMatch(/no private real-meeting fixture.*export-real\.ts/)
    mkdirSync(join(root, 'half'))
    writeFileSync(join(root, 'half', 'transcript.json'), '{}')
    expect(realFixtureSkipReason(root)).not.toBeNull()
    cpSync(SAMPLE, join(root, 'one'), { recursive: true })
    expect(listRealFixtures(root)).toEqual([join(root, 'one')])
    expect(realFixtureSkipReason(root)).toBeNull()
  })
})

describe('replay', () => {
  it('feeds segments in the order they close, each with everything heard so far', async () => {
    const fx = sample()
    // make two segments overlap: s3 now ends after s4
    fx.transcript.segments[3] = { ...fx.transcript.segments[3]!, endMs: 27_500 }
    expect(replayOrder(fx.transcript).map((u) => u.index)).toEqual([0, 1, 2, 4, 3, 5, 6, 7])
    const seen: ReplayUtterance[][] = []
    const { segments, meter } = await replayReal(scripted({}, seen), fx)
    expect(segments).toBe(8)
    expect(seen.map((h) => h.length)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(seen[3]!.at(-1)!.index).toBe(4)
    expect(meter.calls).toBe(8)
  })

  it('live publication: a segment grows every chunk while spoken and closes final with its whole text', async () => {
    const fx = sample()
    fx.transcript.segments = [
      {
        id: 'a',
        speaker: 'Speaker 1',
        startMs: 0,
        endMs: 10_000,
        text: 'one two three four five six seven eight nine ten',
      },
      { id: 'b', speaker: 'me', startMs: 4_000, endMs: 5_000, text: 'short question here?' },
    ]
    const pubs = livePublications(fx.transcript, 3_000)
    expect(pubs.map((u) => [u.index, u.endMs, u.quality, u.text.split(' ').length])).toEqual([
      [0, 3_000, 'live', 3],
      [1, 5_000, 'final', 3],
      [0, 6_000, 'live', 6],
      [0, 9_000, 'live', 9],
      [0, 10_000, 'final', 10],
    ])
    // the replay hands each publication to the runner; the scorecard still counts segments
    const seen: ReplayUtterance[][] = []
    const { segments } = await replayReal(scripted({}, seen), fx, { liveChunkMs: 3_000 })
    expect(segments).toBe(2)
    expect(seen).toHaveLength(5)
  })

  it('keeps the first tick, the first suggestion and the highest P per item (forward-only)', async () => {
    const fx = sample()
    const plan = {
      2: [r('team-size', 'suggest-covered')],
      3: [r('team-size', 'auto-covered', { evidenceIndex: 2 })],
      6: [r('team-size', 'auto-covered', { evidenceIndex: 6, pCovered: 0.95 })],
    }
    const { outcomes } = await replayReal(scripted(plan), fx)
    const o = outcomes.find((x) => x.itemId === 'team-size')!
    expect(o.tickSegment).toBe(3)
    expect(o.tickEvidence).toBe(2)
    expect(o.tickAtMs).toBeGreaterThanOrEqual(20_000)
    expect(o.suggestAtMs).toBeGreaterThanOrEqual(15_000)
    expect(o.maxP).toBe(0.95)
  })

  it('rejects reports about items that are not on the agenda', async () => {
    await expect(replayReal(scripted({ 0: [r('ghost', 'none')] }), sample())).rejects.toThrow(
      /unknown item ghost/,
    )
  })
})

describe('scoring', () => {
  it('hand-computed: precision, recall, negatives, partial, premature, suggestions, lag, answers', async () => {
    const fx = sample()
    const { outcomes } = await replayReal(scripted(PLAN), fx)
    const { metrics, items } = scoreReal(fx, outcomes)
    const v = Object.fromEntries(items.map((i) => [i.itemId, i.verdict]))
    expect(v).toEqual({
      'team-size': 'hit',
      'how-decide': 'hit',
      'next-steps': 'premature-tick',
      culture: 'partial-tick',
      salary: 'false-tick',
      remote: 'quiet',
    })
    expect(metrics).toMatchObject({
      items: 6,
      fullItems: 3,
      partialItems: 1,
      negativeItems: 2,
      autoCheckoffs: 5,
      autoPrecision: 0.4,
      autoPrecisionLenient: 0.6,
      autoRecall: 0.667,
      falseTicksOnNegatives: 1,
      falseTickRateOnNegatives: 0.5,
      prematureTicks: 1,
      partialTicks: 1,
      looksCoveredRecall: 0.667,
      looksCoveredOnNegatives: 2,
      tickLagMedianS: 0,
      tickLagP90S: 9,
      tickLagMaxS: 9,
      ticksBeforeAnswer: 0,
      evidenceHitRate: 1,
      answerAccuracy: 0.667,
      answerHallucinated: 1,
    })
    expect(items.find((i) => i.itemId === 'how-decide')!.lagS).toBe(9)
  })

  it('a tick between the topic coming up and the answer has a negative lag', async () => {
    const fx = sample()
    const { outcomes } = await replayReal(
      scripted({ 3: [r('how-decide', 'auto-covered', { evidenceIndex: 3 })] }),
      fx,
    )
    const { metrics, items } = scoreReal(fx, outcomes)
    expect(items.find((i) => i.itemId === 'how-decide')).toMatchObject({
      verdict: 'hit',
      lagS: -7,
      evidenceHit: true,
    })
    expect(metrics.ticksBeforeAnswer).toBe(1)
  })

  it('nothing ticked: no precision, zero recall, no lag', async () => {
    const fx = sample()
    const { outcomes } = await replayReal(scripted({}), fx)
    const { metrics } = scoreReal(fx, outcomes)
    expect(metrics).toMatchObject({
      autoCheckoffs: 0,
      autoPrecision: null,
      autoRecall: 0,
      tickLagMedianS: null,
    })
  })

  it('quantile', () => {
    expect(quantile([], 0.5)).toBeNull()
    expect(quantile([5], 0.9)).toBe(5)
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2)
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9)
  })
})

describe('suite', () => {
  it('scorecard carries ids and numbers only, plus cost and calls', async () => {
    const { card } = await runRealCoverageSuite(scripted(PLAN), sample())
    expect(card.suite).toBe(REAL_SUITE)
    expect(card.dataset).toEqual({ name: 'private:real-sample', n: 6 })
    expect(card.metrics.decisionCalls).toBe(8)
    expect(card.metrics.costUsd).toBeCloseTo(0.008, 6)
    expect(card.notes).toContain('labels: test-author, reviewed')
    const text = JSON.stringify(card)
    for (const s of sample().transcript.segments) expect(text).not.toContain(s.text)
  })

  const local = (): ProviderSetup => ({
    label: 'local-hashing',
    mode: 'offline',
    provider: new LocalDecisionProvider({ embedder: new HashingEmbedder(), rules: AGENDA_RULES }),
    skip: null,
  })

  it('runRealSuites: skipped with the reason when there is no fixture or no provider', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'private-'))
    const [a] = await runRealSuites(local(), (p, mode) => decisionStatusRunner(p, { mode }), { root: empty })
    expect(a!.skipped).toMatch(/no private real-meeting fixture/)
    const [b] = await runRealSuites(
      { label: 'jev', mode: 'live', provider: null, skip: 'no TYPESAFE_API_KEY in the environment' },
      (p, mode) => decisionStatusRunner(p, { mode }),
      { root: empty },
    )
    expect(b!.skipped).toBe('no TYPESAFE_API_KEY in the environment')
  })

  it('runRealSuites: the on-device provider end to end over a fixture root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'private-'))
    cpSync(SAMPLE, join(root, 'real-sample'), { recursive: true })
    const runs: string[] = []
    const cards = await runRealSuites(local(), (p, mode) => decisionStatusRunner(p, { mode }), {
      root,
      onRun: (fx) => runs.push(fx.name),
    })
    expect(runs).toEqual(['real-sample'])
    expect(cards).toHaveLength(1)
    expect(cards[0]!.skipped).toBeNull()
    expect(cards[0]!.metrics.items).toBe(6)
    expect(cards[0]!.cost.usd).toBe(0)
  })
})
