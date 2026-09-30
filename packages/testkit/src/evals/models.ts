import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Where tests find the on-device text embedder (text-embedding-minilm-l6-v2-int8). Tests never download
// into the user's real data dir: `node packages/decisions/scripts/fetch-embedder.ts` installs it (checksum-
// verified, through the model manager) into a test cache; an app-installed copy is used read-only.

export const TEXT_EMBEDDER_ID = 'text-embedding-minilm-l6-v2-int8'

export function testModelsDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GNOMEOLA_TEST_MODELS_DIR) return env.GNOMEOLA_TEST_MODELS_DIR
  return join(env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'gnomeola', 'test-models')
}

/** The installed embedder's directory (manifest present = verified install), or null. */
export function findTextEmbedder(env: NodeJS.ProcessEnv = process.env): string | null {
  const roots = [
    testModelsDir(env),
    env.GNOMEOLA_MODELS_DIR,
    join(env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'gnomeola', 'models'),
  ]
  for (const root of roots) {
    if (!root) continue
    const dir = join(root, TEXT_EMBEDDER_ID)
    if (existsSync(join(dir, 'model_quantized.onnx')) && existsSync(join(dir, '.gnomeola-model.json')))
      return dir
  }
  return null
}

export const NO_EMBEDDER_REASON =
  'the on-device embedder is not installed (run `node packages/decisions/scripts/fetch-embedder.ts`)'
