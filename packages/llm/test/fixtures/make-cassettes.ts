// Regenerate the hand-authored cassettes:  node packages/llm/test/fixtures/make-cassettes.ts
// (Recorded cassettes come from the eval/record path instead — see docs/llm.md.)
import { saveCassette } from '@gnomeola/testkit/cassettes'
import { buildCassette, cassettePath } from './cassette-builder.ts'
import { ENHANCE_SCENARIOS } from './enhance-scenarios.ts'
import { SCENARIOS } from './scenarios.ts'

for (const s of [...SCENARIOS, ...ENHANCE_SCENARIOS]) {
  const c = await buildCassette(s)
  saveCassette(cassettePath(s.name), c)
  console.log(`wrote ${cassettePath(s.name)} (${c.interactions.length} interaction(s))`)
}
