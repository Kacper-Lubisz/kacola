// Run the decision eval suites and print scorecards (also written to __artifacts__/evals):
//
//   node packages/evals/scripts/run-evals.ts [offline|fake|live]…     (default: offline)
//
// offline = the on-device provider (hashing, and MiniLM when installed); fake = hosted providers against
// local fakes (plumbing only); live = hosted providers whose keys are in the environment.

import { HashingEmbedder, OnnxEmbedder } from '@gnomeola/decisions'
import {
  findTextEmbedder,
  formatScorecard,
  loadDataset,
  type Scorecard,
  summaryTable,
  writeScorecard,
} from '@gnomeola/testkit/evals'
import {
  extractiveDraftRunner,
  extractiveRecapRunner,
  fakeProviders,
  liveProviders,
  offlineProviders,
  type ProviderSetup,
  runDecisionSuites,
  runDraftSuite,
  runRecapSuite,
} from '../src/index.ts'

const modes = process.argv.slice(2)
const want = modes.length ? modes : ['offline']
const setups: ProviderSetup[] = []
if (want.includes('offline')) setups.push(...(await offlineProviders()))
if (want.includes('fake')) setups.push(...(await fakeProviders()))
if (want.includes('live')) setups.push(...liveProviders())

const cards: Scorecard[] = []
for (const s of setups) {
  const t0 = performance.now()
  const cs = await runDecisionSuites(s)
  for (const c of cs) {
    console.log(formatScorecard(c))
    writeScorecard(c)
  }
  cards.push(...cs)
  console.log(`   (${s.label}: ${((performance.now() - t0) / 1000).toFixed(1)} s)\n`)
  await s.close?.()
}
if (want.includes('offline')) {
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
  summaryTable(cards, ['autoPrecision', 'autoRecall', 'latencyP90Ms', 'f1', 'top1', 'answerAccuracy', 'ece']),
)
