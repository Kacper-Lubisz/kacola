import type { DecisionProvider } from '@gnomeola/decisions'
import { type EvalMode, listAgendaFixtures, loadDataset, type Scorecard } from '@gnomeola/testkit/evals'
import { loadAgendaFixture } from '@gnomeola/testkit/fixtures'
import { liveSkipReason, type ProviderSetup } from './providers.ts'
import {
  decisionInjectionRunner,
  decisionInterviewRunner,
  decisionNextPointRunner,
  decisionRelevanceRunner,
  decisionStatusRunner,
} from './runners.ts'
import {
  runInjectionSuite,
  runInterviewSuite,
  runNextPointSuite,
  runRelevanceSuite,
  runStatusSuite,
  type StatusFixture,
  skippedCard,
} from './suites.ts'

// One call to run every decision suite for one provider setup (offline, fake or live), turning "cannot run
// here" (no key, quota, unreachable) into a skipped scorecard with the reason — never into numbers.

export const DECISION_SUITES = [
  'item-status',
  'relevance-precheck',
  'injection-guardrail',
  'next-point',
  'interview-extraction',
] as const
export type DecisionSuite = (typeof DECISION_SUITES)[number]

export function agendaFixtures(): StatusFixture[] {
  return listAgendaFixtures().map((id) => ({ id, truth: loadAgendaFixture(id).truth }))
}

export async function runDecisionSuites(
  setup: ProviderSetup,
  opts: { suites?: readonly DecisionSuite[]; fixtures?: StatusFixture[]; limit?: number } = {},
): Promise<Scorecard[]> {
  const suites = opts.suites ?? DECISION_SUITES
  const meta = {
    provider: setup.provider?.id ?? setup.label,
    model: setup.provider?.model ?? '',
    mode: setup.mode,
  }
  if (!setup.provider || setup.skip)
    return suites.map((s) =>
      skippedCard(s, { ...meta, provider: setup.label }, s, setup.skip ?? 'no provider'),
    )
  const p: DecisionProvider = setup.provider
  const mode: EvalMode = setup.mode
  const cap = <T>(xs: T[]) => (opts.limit ? xs.slice(0, opts.limit) : xs)
  const run: Record<DecisionSuite, () => Promise<Scorecard>> = {
    'item-status': async () =>
      (await runStatusSuite(decisionStatusRunner(p, { mode }), opts.fixtures ?? agendaFixtures())).card,
    'relevance-precheck': () =>
      runRelevanceSuite(decisionRelevanceRunner(p, mode), cap(loadDataset('relevance-precheck'))),
    'injection-guardrail': () =>
      runInjectionSuite(decisionInjectionRunner(p, mode), cap(loadDataset('injection-guardrail'))),
    'next-point': () => runNextPointSuite(decisionNextPointRunner(p, mode), cap(loadDataset('next-point'))),
    'interview-extraction': () =>
      runInterviewSuite(decisionInterviewRunner(p, mode), cap(loadDataset('interview-extraction'))),
  }
  const cards: Scorecard[] = []
  let dead: string | null = null
  for (const s of suites) {
    if (dead) {
      cards.push(skippedCard(s, meta, s, dead))
      continue
    }
    try {
      cards.push(await run[s]())
    } catch (err) {
      const reason = mode === 'live' ? liveSkipReason(err) : null
      if (!reason) throw err
      dead = reason
      cards.push(skippedCard(s, meta, s, reason))
    }
  }
  return cards
}
