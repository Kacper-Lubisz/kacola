// The eval harness in its deterministic offline mode (part of `pnpm check`):
//   - every suite on the on-device provider (hashing embedder always; MiniLM when installed), compared to
//     committed baselines (record with GNOMEOLA_UPDATE_BASELINES=1) — these are the honest offline numbers;
//   - every decision suite end to end through each hosted provider's real HTTP client against local fakes
//     (plumbing: request building, parsing, retries, accounting — the numbers mean nothing about quality);
//   - record → replay of decisions through cassettes, including a committed cassette replayed with no server.
import { join } from 'node:path'
import {
  HashingEmbedder,
  loadCassette,
  OnnxEmbedder,
  RecordingDecisionProvider,
  ReplayDecisionProvider,
  saveCassette,
} from '@gnomeola/decisions'
import {
  checkBaseline,
  findTextEmbedder,
  formatScorecard,
  loadDataset,
  NO_EMBEDDER_REASON,
  type Scorecard,
  writeScorecard,
} from '@gnomeola/testkit/evals'
import { afterAll, describe, expect, it } from 'vitest'
import { bandsFor } from '../src/baselines.ts'
import { fakeProviders, offlineProviders, type ProviderSetup } from '../src/providers.ts'
import { agendaFixtures, DECISION_SUITES, runDecisionSuites } from '../src/run.ts'
import { decisionInjectionRunner, extractiveDraftRunner, extractiveRecapRunner } from '../src/runners.ts'
import { runDraftSuite, runInjectionSuite, runRecapSuite } from '../src/suites.ts'

const printed: string[] = []
function report(c: Scorecard) {
  printed.push(formatScorecard(c))
  writeScorecard(c)
}
afterAll(() => console.log(printed.join('\n')))

function expectBaseline(c: Scorecard) {
  const cmp = checkBaseline(c, bandsFor(c))
  expect(
    cmp,
    `no committed baseline for ${c.suite} (${c.provider}/${c.model}); record with GNOMEOLA_UPDATE_BASELINES=1`,
  ).not.toBeNull()
  expect(cmp!.failures, `${c.suite} ${c.model}`).toEqual([])
}

const setups = await offlineProviders()

describe.each(setups.map((s) => [s.label, s] as const))('offline: %s', (_label, setup: ProviderSetup) => {
  it.skipIf(!!setup.skip)(
    `every decision suite, against its committed baseline${setup.skip ? ` (skipped: ${setup.skip})` : ''}`,
    async () => {
      const cards = await runDecisionSuites(setup)
      expect(cards.map((c) => c.suite)).toEqual([...DECISION_SUITES])
      for (const c of cards) {
        report(c)
        expect(c.skipped).toBeNull()
        expect(c.dataset.n).toBeGreaterThan(0)
        expectBaseline(c)
      }
      const status = cards[0]!
      // the budgets are measured and printed, but offline they are baselines, not targets
      expect(status.budgets.every((b) => !b.enforced)).toBe(true)
      expect(status.cost.usd).toBe(0)
    },
  )
})

describe('offline: text behaviours (extractive floor)', () => {
  it('agenda drafting and recap, against committed baselines', async () => {
    const draft = await runDraftSuite(extractiveDraftRunner(), loadDataset('agenda-drafting'))
    report(draft)
    expectBaseline(draft)
    // the extractive drafter uses only goals and explicit carry-overs: it can never leak private context
    expect(draft.metrics.privateLeaks).toBe(0)
    const dir = findTextEmbedder()
    const recap = await runRecapSuite(extractiveRecapRunner(new HashingEmbedder()), loadDataset('recap'))
    report(recap)
    expectBaseline(recap)
    if (dir) {
      const r2 = await runRecapSuite(
        extractiveRecapRunner(await OnnxEmbedder.create(dir)),
        loadDataset('recap'),
      )
      report(r2)
      expectBaseline(r2)
    } else printed.push(`recap with MiniLM skipped: ${NO_EMBEDDER_REASON}\n`)
  })
})

describe('fake: hosted providers end to end against local fakes (plumbing, not quality)', () => {
  it('runs every decision suite through jev, OpenAI, Anthropic and Ollama clients', async () => {
    const fakes = await fakeProviders()
    const fixtures = agendaFixtures().filter((f) => f.id === 'standup-recurring')
    try {
      for (const setup of fakes) {
        const cards = await runDecisionSuites(setup, { limit: 6, fixtures })
        for (const c of cards) {
          report(c)
          expect(c.skipped, `${setup.label} ${c.suite}`).toBeNull()
          expect(c.mode).toBe('fake')
          expect(c.cost.calls).toBeGreaterThan(0)
          expect(c.cost.inputTokens).toBeGreaterThan(0)
        }
        const status = cards[0]!
        expect(status.metrics.items).toBe(fixtures[0]!.truth.agenda!.items.length)
        // priced providers report a cost; Ollama has no per-token price (null, not zero)
        if (setup.label === 'ollama-fake') expect(status.cost.usd).toBeNull()
        else expect(status.cost.usd).toBeGreaterThan(0)
      }
    } finally {
      for (const f of fakes) await f.close?.()
    }
  })
})

describe('cassettes: record once, replay without a server', () => {
  const COMMITTED = join(import.meta.dirname, '..', 'cassettes', 'jev-fake-injection.json')

  it('a replayed run gives the recorded run’s exact scorecard; a committed cassette replays with no server', async () => {
    const [jev, ...rest] = await fakeProviders()
    for (const r of rest) await r.close?.()
    const cases = loadDataset('injection-guardrail')
    try {
      const rec = new RecordingDecisionProvider(jev!.provider!)
      const live = await runInjectionSuite(decisionInjectionRunner(rec, 'fake'), cases)
      const replayed = await runInjectionSuite(
        decisionInjectionRunner(new ReplayDecisionProvider(rec.cassette), 'offline'),
        cases,
      )
      expect(replayed.metrics).toEqual(live.metrics)
      if (process.env.GNOMEOLA_UPDATE_CASSETTES === '1') saveCassette(COMMITTED, rec.cassette)
      const committed = loadCassette(COMMITTED)
      expect(committed, 'record with GNOMEOLA_UPDATE_CASSETTES=1').not.toBeNull()
      const fromDisk = await runInjectionSuite(
        decisionInjectionRunner(new ReplayDecisionProvider(committed!), 'offline'),
        cases,
      )
      expect(fromDisk.metrics).toEqual(live.metrics)
      report(fromDisk)
      // a request the cassette has not seen fails loudly instead of guessing
      await expect(
        new ReplayDecisionProvider(committed!).decide({
          state: 'new',
          questions: [{ id: 'x', kind: 'yesno', instructions: 'unseen?' }],
        }),
      ).rejects.toMatchObject({ code: 'not_found' })
    } finally {
      await jev!.close?.()
    }
  })
})
