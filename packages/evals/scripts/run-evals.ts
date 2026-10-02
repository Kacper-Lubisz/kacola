// Run the decision eval suites and print scorecards (also written to __artifacts__/evals):
//
//   node packages/evals/scripts/run-evals.ts [offline|fake|live]… [--real-only]     (default: offline)
//
// offline = the on-device provider (hashing, and MiniLM when installed); fake = hosted providers against
// local fakes (plumbing only); live = hosted providers whose keys are in the environment.
//
// Offline and live runs also replay each private real-meeting fixture (fixtures/evals/private/<name>/,
// see docs/decisions.md) through the live tracker's own code path (the daemon's
// trackerStatusRunner); skipped with the reason when there is none. --real-only runs just that suite.
// Per-item results are written next to the fixture (private) for its review page.

import { HashingEmbedder, OnnxEmbedder } from '@gnomeola/decisions'
import {
  findTextEmbedder,
  formatScorecard,
  loadDataset,
  type Scorecard,
  summaryTable,
  writeScorecard,
} from '@gnomeola/testkit/evals'
import { trackerStatusRunner } from '../../daemon/src/agendas/tracker-eval.ts'
import {
  extractiveDraftRunner,
  extractiveRecapRunner,
  fakeProviders,
  liveProviders,
  offlineProviders,
  type ProviderSetup,
  runDecisionSuites,
  runDraftSuite,
  runRealSuites,
  runRecapSuite,
  writeRealResults,
} from '../src/index.ts'

const args = process.argv.slice(2)
const realOnly = args.includes('--real-only')
const modes = args.filter((a) => !a.startsWith('--'))
const want = modes.length ? modes : ['offline']
const setups: ProviderSetup[] = []
if (want.includes('offline')) setups.push(...(await offlineProviders()))
if (want.includes('fake')) setups.push(...(await fakeProviders()))
if (want.includes('live')) setups.push(...liveProviders())

const cards: Scorecard[] = []
for (const s of setups) {
  const t0 = performance.now()
  const cs = realOnly ? [] : await runDecisionSuites(s)
  if (s.mode !== 'fake') {
    const dead = cs.find((c) => c.skipped)?.skipped
    cs.push(
      ...(await runRealSuites(
        dead ? { ...s, skip: dead } : s,
        (p, mode) => trackerStatusRunner(p, { mode }),
        {
          onRun: (fx, r) => console.log(`   per-item results (private): ${writeRealResults(fx, r, s.label)}`),
        },
      )),
    )
  }
  for (const c of cs) {
    console.log(formatScorecard(c))
    writeScorecard(c)
  }
  cards.push(...cs)
  console.log(`   (${s.label}: ${((performance.now() - t0) / 1000).toFixed(1)} s)\n`)
  await s.close?.()
}
if (want.includes('offline') && !realOnly) {
  const dir = findTextEmbedder()
  const embedder = dir ? await OnnxEmbedder.create(dir) : new HashingEmbedder()
  for (const c of [
    await runDraftSuite(extractiveDraftRunner(), loadDataset('agenda-drafting')),
    await runRecapSuite(extractiveRecapRunner(embedder), loadDataset('recap')),
  ]) {
    console.log(formatScorecard(c))
    writeScorecard(c)
    cards.push(c)
  }
}
console.log(
  summaryTable(cards, [
    'autoPrecision',
    'autoRecall',
    'falseTicksOnNegatives',
    'tickLagMedianS',
    'tickLagP90S',
    'latencyP90Ms',
    'f1',
    'top1',
    'answerAccuracy',
    'ece',
  ]),
)
