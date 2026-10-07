// Live evals of the tracker's code path (eval tier, opt-in, key-gated): every decision suite through the
// real AgendaTracker / gate / guard / ranking / interview path on each hosted decisions provider whose key
// is set, and the recap exactly as the daemon writes it (recapItem) on each text LLM with a key.
//
//   TYPESAFE_API_KEY=… OPENAI_API_KEY=… ANTHROPIC_API_KEY=… pnpm test:eval packages/daemon
//   KACOLA_EVAL_OLLAMA_URL=http://127.0.0.1:11434 …
//
// No key → skipped with the reason; quota / auth on the first call → the rest of that provider is skipped
// with the error as the reason. Numbers are never faked. The brief's budgets (auto check-off precision
// ≥ 0.9, p90 check-off ≤ 30 s after settling) are asserted for live providers.
//
// The real-meeting coverage suite (private fixtures in packages/testkit/fixtures/evals/private, see
// docs/decisions.md) runs here too, through the same tracker: skipped with the reason when the
// machine has no fixture. It prints aggregate numbers only; no budget is asserted on it (its labels are a
// person's judgement, possibly not yet reviewed).
import {
  agendaFixtures,
  liveProviders,
  liveSkipReason,
  realFixtureSkipReason,
  runInjectionSuite,
  runInterviewSuite,
  runNextPointSuite,
  runRealSuites,
  runRecapSuite,
  runRelevanceSuite,
  runStatusSuite,
} from '@kacola/evals'
import { AnthropicProvider, type LlmProvider, OpenAIProvider } from '@kacola/llm'
import { formatScorecard, loadDataset, type Scorecard, writeScorecard } from '@kacola/testkit/evals'
import { afterAll, describe, expect, it } from 'vitest'
import {
  trackerInjectionRunner,
  trackerInterviewRunner,
  trackerNextPointRunner,
  trackerRecapRunner,
  trackerRelevanceRunner,
  trackerStatusRunner,
} from '../src/agendas/tracker-eval.ts'

const printed: string[] = []
const report = (c: Scorecard) => {
  printed.push(formatScorecard(c))
  writeScorecard({ ...c, suite: `tracker-${c.suite}` })
}
afterAll(() => console.log(printed.join('\n')))

describe.each(liveProviders().map((s) => [s.label, s] as const))(
  'tracker, live decisions — %s',
  (label, setup) => {
    if (setup.skip) {
      it.skip(`SKIPPED: ${setup.skip}`, () => {})
      printed.push(`── tracker live · ${label} · SKIPPED: ${setup.skip}\n`)
      return
    }
    it('every decision suite through the tracker; budgets asserted', async (ctx) => {
      const p = setup.provider!
      try {
        const { card } = await runStatusSuite(trackerStatusRunner(p, { mode: 'live' }), agendaFixtures())
        report(card)
        report(await runRelevanceSuite(trackerRelevanceRunner(p, 'live'), loadDataset('relevance-precheck')))
        report(await runInjectionSuite(trackerInjectionRunner(p, 'live'), loadDataset('injection-guardrail')))
        report(await runNextPointSuite(trackerNextPointRunner(p, 'live'), loadDataset('next-point')))
        report(
          await runInterviewSuite(trackerInterviewRunner(p, 'live'), loadDataset('interview-extraction')),
        )
        for (const b of card.budgets.filter((x) => x.enforced))
          expect(b.passed, `${label}: budget "${b.name}" got ${b.value}`).toBe(true)
      } catch (err) {
        const reason = liveSkipReason(err)
        if (!reason) throw err
        printed.push(`── tracker live · ${label} · SKIPPED: ${reason}\n`)
        ctx.skip()
      }
    })
  },
)

describe.each(liveProviders().map((s) => [s.label, s] as const))(
  'tracker, real meeting coverage, live — %s',
  (label, setup) => {
    const skip = setup.skip ?? realFixtureSkipReason()
    if (skip) {
      it.skip(`SKIPPED: ${skip}`, () => {})
      printed.push(`── tracker real-interview-coverage · ${label} · SKIPPED: ${skip}\n`)
      return
    }
    it('private real meetings replayed through the tracker', async (ctx) => {
      const cards = await runRealSuites(setup, (p, mode) => trackerStatusRunner(p, { mode }))
      for (const c of cards) report(c)
      const skipped = cards.find((c) => c.skipped)
      if (skipped) {
        printed.push(`── tracker real-interview-coverage · ${label} · SKIPPED: ${skipped.skipped}\n`)
        ctx.skip()
        return
      }
      for (const c of cards) expect(c.metrics.items).toBeGreaterThan(0)
    })
  },
)

const TEXT: { label: string; skip: string | null; make: () => LlmProvider }[] = [
  {
    label: 'anthropic',
    skip: process.env.ANTHROPIC_API_KEY ? null : 'no ANTHROPIC_API_KEY in the environment',
    make: () => new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! }),
  },
  {
    label: 'openai',
    skip: process.env.OPENAI_API_KEY ? null : 'no OPENAI_API_KEY in the environment',
    make: () => new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! }),
  },
]

describe.each(TEXT.map((t) => [t.label, t] as const))('tracker recap, live — %s', (label, t) => {
  if (t.skip) {
    it.skip(`SKIPPED: ${t.skip}`, () => {})
    printed.push(`── tracker recap live · ${label} · SKIPPED: ${t.skip}\n`)
    return
  }
  it('the daemon’s recap prompt on the recap dataset', async (ctx) => {
    try {
      const card = await runRecapSuite(trackerRecapRunner(t.make()), loadDataset('recap'))
      report(card)
      expect(card.metrics.injectedOrForbidden).toBe(0)
    } catch (err) {
      const reason = liveSkipReason(err)
      if (!reason) throw err
      printed.push(`── tracker recap live · ${label} · SKIPPED: ${reason}\n`)
      ctx.skip()
    }
  })
})
