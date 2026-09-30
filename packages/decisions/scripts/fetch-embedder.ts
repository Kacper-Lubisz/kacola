// Install the on-device decision embedder (text-embedding-minilm-l6-v2-int8, 23 MB, sha256-verified by the
// model manager) into the test models dir, so the local provider's evals run with the real model:
//
//   node packages/decisions/scripts/fetch-embedder.ts [dir]      (default: ~/.cache/gnomeola/test-models)
import { ModelManager } from '@gnomeola/stt'
import { TEXT_EMBEDDER_ID, testModelsDir } from '@gnomeola/testkit/evals'

const dir = process.argv[2] ?? testModelsDir()
const models = new ModelManager({ dir })
const out = await models.ensure(TEXT_EMBEDDER_ID, {
  onProgress: (p) => p.phase !== 'download' && console.log(`${TEXT_EMBEDDER_ID}: ${p.phase}`),
})
console.log(`installed ${TEXT_EMBEDDER_ID} → ${out}`)
