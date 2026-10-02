// The AI evals through the live tracker's real code path (agendas wave 2), deterministic, in `pnpm check`:
//   - item-status: the fixture meetings replayed segment by segment into a real AgendaTracker over an
//     in-memory store (gate → guard → batched status round → policy → store rules), heartbeat every 30 s
//     of fixture time;
//   - relevance / injection / next point / interview: the tracker's gate, SpeechGuard, ranking and
//     interview path on their datasets.
// Local provider (hashing embedder always; MiniLM when installed), compared to committed baselines in
// test/fixtures/baselines/tracker-evals (record with GNOMEOLA_UPDATE_BASELINES=1). The numbers are honest
// measurements, not targets: nothing is tuned against them. Budgets are printed, enforced only live.
import { join } from 'node:path'
import {
  agendaFixtures,
  bandsFor,
  loadRealFixture,
  offlineProviders,
  REAL_SAMPLE_FIXTURE,
  runInjectionSuite,
  runInterviewSuite,
  runNextPointSuite,
  runRealCoverageSuite,
  runRelevanceSuite,
  runStatusSuite,
} from '@gnomeola/evals'
import {
  checkBaseline,
  formatScorecard,
  loadDataset,
  type Scorecard,
  writeScorecard,
} from '@gnomeola/testkit/evals'
import { afterAll, describe, expect, it } from 'vitest'
import {
  trackerInjectionRunner,
  trackerInterviewRunner,
  trackerNextPointRunner,
  trackerRelevanceRunner,
  trackerStatusRunner,
} from '../src/agendas/tracker-eval.ts'

export const TRACKER_BASELINES = join(import.meta.dirname, 'fixtures', 'baselines', 'tracker-evals')

const printed: string[] = []
afterAll(() => console.log(printed.join('\n')))

function report(c: Scorecard) {
  printed.push(formatScorecard(c))
  writeScorecard({ ...c, suite: `tracker-${c.suite}` })
  const cmp = checkBaseline(c, bandsFor(c), { dir: TRACKER_BASELINES })
  expect(
    cmp,
    `no tracker baseline for ${c.suite} ${c.model}; record with GNOMEOLA_UPDATE_BASELINES=1`,
  ).not.toBeNull()
  expect(cmp!.failures, `${c.suite} ${c.model}`).toEqual([])
}

const setups = await offlineProviders()

describe.each(setups.map((s) => [s.label, s] as const))('tracker evals, offline: %s', (_l, setup) => {
  it.skipIf(!!setup.skip)(
    `every decision suite through the tracker${setup.skip ? ` (skipped: ${setup.skip})` : ''}`,
    async () => {
      const p = setup.provider!
      const { card, outcomes } = await runStatusSuite(
        trackerStatusRunner(p, { mode: 'offline' }),
        agendaFixtures(),
      )
      report(card)
      expect(card.notes[0]).toBe('runner: tracker')
      expect(card.metrics.items).toBe(outcomes.length)
      expect(card.cost.usd).toBe(0)
      expect(card.budgets.every((b) => !b.enforced)).toBe(true)
      // the gate keeps calls down: fewer decision calls than 3 per segment (gate + guard + status each time)
      const segments = Number(/(\d+) segments/.exec(card.notes[1]!)![1])
      expect(card.cost.calls).toBeLessThan(3 * segments)
      report(await runRelevanceSuite(trackerRelevanceRunner(p, 'offline'), loadDataset('relevance-precheck')))
      report(
        await runInjectionSuite(trackerInjectionRunner(p, 'offline'), loadDataset('injection-guardrail')),
      )
      report(await runNextPointSuite(trackerNextPointRunner(p, 'offline'), loadDataset('next-point')))
      report(
        await runInterviewSuite(trackerInterviewRunner(p, 'offline'), loadDataset('interview-extraction')),
      )
    },
  )
})

// The real-meeting coverage suite's plumbing through the real tracker, on the synthetic sample (the real,
// private fixtures run in run-evals.ts and the live eval tier; they are not on every machine).
it('real-meeting coverage replays through the tracker (synthetic sample)', async () => {
  const setup = setups[0]!
  const fx = loadRealFixture(REAL_SAMPLE_FIXTURE)
  const { card, outcomes } = await runRealCoverageSuite(
    trackerStatusRunner(setup.provider!, { mode: 'offline' }),
    fx,
  )
  expect(card.skipped).toBeNull()
  expect(card.notes[0]).toBe('runner: tracker')
  expect(outcomes.map((o) => o.itemId)).toEqual(fx.labels.items.map((i) => i.id))
  expect(card.metrics.items).toBe(6)
  expect(card.metrics.negativeItems).toBe(2)
  // decisions were actually asked (gate, guard, status round, interview items)
  expect(card.metrics.decisionCalls).toBeGreaterThan(fx.transcript.segments.length)
})
