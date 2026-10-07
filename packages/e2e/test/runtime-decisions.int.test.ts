import { join } from 'node:path'
import { startDaemon } from '@kacola/testkit/daemon'
import { findTextEmbedder, NO_EMBEDDER_REASON, testModelsDir } from '@kacola/testkit/evals'
import { describe, expect, it } from 'vitest'
import { AS_NODE, electronBinary, testRuntime } from '../src/runtime.ts'

// Agendas wave 1B: the release runtime (esbuild bundle on Electron 44's Node) carries the decision layer's
// natives. With the on-device embedder installed, the bundled daemon loads onnxruntime-node and the
// committed WordPiece vocabulary (staged by scripts/build-runtime.ts) and reports MiniLM in /health.

describe.skipIf(!findTextEmbedder())(
  `bundled daemon: on-device decisions${findTextEmbedder() ? '' : ` — skipped: ${NO_EMBEDDER_REASON}`}`,
  () => {
    it('loads onnxruntime-node + the vocabulary and answers with the MiniLM provider', async () => {
      const runtime = (await testRuntime()).outDir
      const d = await startDaemon({
        execPath: electronBinary(),
        entry: join(runtime, 'daemon.mjs'),
        fake: false,
        env: { ...AS_NODE, KACOLA_MODELS_DIR: testModelsDir() },
      })
      try {
        const h = await d.client.call('health')
        expect(h.decisions).toEqual({
          provider: 'local',
          model: 'text-embedding-minilm-l6-v2-int8',
          ready: true,
          detail: null,
        })
        expect(h.models.find((m) => m.role === 'text-embedding')).toMatchObject({ state: 'ready' })
      } finally {
        await d.stop()
      }
    }, 120_000)
  },
)
