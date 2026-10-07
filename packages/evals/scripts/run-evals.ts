// Run the decision eval suites and print scorecards (also written to __artifacts__/evals):
//
//   node packages/evals/scripts/run-evals.ts [offline|fake|live]… [--real-only] [--synthetic]
//                                            [--tracker='<TrackerOptions json>'] [--label=<name>]
//   (default: offline)
//
// offline = the on-device provider (hashing, and MiniLM when installed); fake = hosted providers against
// local fakes (plumbing only); live = hosted providers whose keys are in the environment.
//
// Offline and live runs also replay each private real-meeting fixture (fixtures/evals/private/<name>/,
// see docs/decisions.md) through the live tracker's own code path (the daemon's
// trackerStatusRunner); skipped with the reason when there is none. --real-only runs just that suite.
// Per-item results are written next to the fixture (private) for its review page.

import { HashingEmbedder, OnnxEmbedder } from '@kacola/decisions'
import {
  findTextEmbedder,
  formatScorecard,
  loadDataset,
  type Scorecard,
  summaryTable,
  writeScorecard,
} from '@kacola/testkit/evals'
import type { TrackerOptions } from '../../daemon/src/agendas/tracker.ts'
import { trackerStatusRunner } from '../../daemon/src/agendas/tracker-eval.ts'
import {
  agendaFixtures,
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
  runStatusSuite,
  writeRealResults,
} from '../src/index.ts'

const args = process.argv.slice(2)
const realOnly = args.includes('--real-only')
// --tracker='<json>': TrackerOptions for the real-meeting replay (cadence / window experiments)
const trackerOpts = JSON.parse(
  args.find((a) => a.startsWith('--tracker='))?.slice('--tracker='.length) ?? '{}',
) as TrackerOptions
// --synthetic: also replay the synthetic agenda meetings through the tracker (its status suite)
const synthetic = args.includes('--synthetic')
// --live-publish[=ms]: publish the real meeting's segments as the live pipeline does (growing while
// spoken, every ms, default 3000) instead of once each when complete
const pub = args.find((a) => a.startsWith('--live-publish'))
const liveChunkMs = pub ? Number(pub.split('=')[1] ?? 3000) : null
// --label=<name>: the per-item results file's suffix (results-<label>.json), default the provider label
const label = args.find((a) => a.startsWith('--label='))?.slice('--label='.length)
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
  if (synthetic && s.provider && !s.skip)
    cs.push(
      (
        await runStatusSuite(
          trackerStatusRunner(s.provider, { mode: s.mode, name: 'tracker', options: trackerOpts }),
          agendaFixtures(),
        )
      ).card,
    )
  if (s.mode !== 'fake') {
    const dead = cs.find((c) => c.skipped)?.skipped
    cs.push(
      ...(await runRealSuites(
        dead ? { ...s, skip: dead } : s,
        (p, mode) => trackerStatusRunner(p, { mode, options: trackerOpts }),
        {
          replay: { liveChunkMs },
          onRun: (fx, r) =>
            console.log(`   per-item results (private): ${writeRealResults(fx, r, label ?? s.label)}`),
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
