import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ModelInfo } from '@gnomeola/protocol'
import { loadFixture } from '@gnomeola/testkit/fixtures'
import { afterAll, describe, expect, it } from 'vitest'
import { CATALOG, catalogEntry, DEFAULT_MODELS } from '../src/model-manager/catalog.ts'
import { ModelManager, type ModelProgress, sha256File } from '../src/model-manager/manager.ts'
import { createVad, sherpaVersion } from '../src/sherpa/index.ts'
import type { VadEvent } from '../src/types.ts'

// Real network, real release artefact: the smallest model (Silero VAD, 0.6 MB) downloaded from the
// sherpa-onnx GitHub release into a throwaway models dir, verified against its pinned sha256, and then
// actually run.

const dir = mkdtempSync(join(tmpdir(), 'gnomeola-models-e2e-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('model manager against the real release', () => {
  it('sherpa-onnx-node loads on this Node', () => {
    const v = sherpaVersion()
    console.log(`sherpa-onnx ${v.version} (${v.gitSha1}) on node ${process.version}`)
    expect(v.version).toMatch(/^1\.\d+\.\d+$/)
  })

  it('downloads the smallest model, verifies its pinned sha256, and runs it', async () => {
    const smallest = [...CATALOG].sort((a, b) => a.sizeBytes - b.sizeBytes)[0]!
    expect(smallest.id).toBe(DEFAULT_MODELS.vad)
    const mm = new ModelManager({ dir, progressIntervalMs: 0 })
    expect((await mm.status(smallest.id)).state).toBe('missing')
    const progress: ModelProgress[] = []
    const path = await mm.ensure(smallest.id, { onProgress: (p) => progress.push(p) })
    const status = await mm.status(smallest.id)
    expect(ModelInfo.parse(ModelManager.toModelInfo(status)).state).toBe('ready')
    expect(await sha256File(join(path, 'silero_vad.onnx'))).toBe(catalogEntry(smallest.id).sha256)
    expect(progress.at(-1)?.phase).toBe('extract')
    expect(progress.some((p) => p.phase === 'download' && p.fraction === 1)).toBe(true)
    expect((await mm.verify(smallest.id)).state).toBe('ready')

    // and it works: Silero finds the speech in a fixture where the ground truth says it is
    const vad = await createVad(mm, smallest.id)
    const f = loadFixture('standup-2p')
    const events: VadEvent[] = []
    const s = vad.createStream({ track: 'system', startMs: 0, onEvent: (e) => events.push(e) })
    for (const c of f.chunks('system', 100)) s.accept(c.samples)
    s.flush()
    const ends = events.filter((e) => e.kind === 'end')
    const utts = f.utterances('system')
    const found = utts.filter((u) =>
      ends.some((e) => e.kind === 'end' && e.startMs < u.endMs && u.startMs < e.endMs),
    ).length
    expect(found).toBe(utts.length)
    // onsets are accurate to a few hundred ms
    for (const u of utts) {
      const e = ends.find((x) => x.kind === 'end' && x.startMs < u.endMs && u.startMs < x.endMs)!
      if (e.kind === 'end') expect(Math.abs(e.startMs - u.startMs)).toBeLessThan(400)
    }
  })

  it('a tampered real model is caught by verify() and repaired by ensure()', async () => {
    const mm = new ModelManager({ dir })
    const p = join(mm.path(DEFAULT_MODELS.vad), 'silero_vad.onnx')
    const orig = Buffer.from(await import('node:fs').then((fs) => fs.readFileSync(p)))
    const bad = Buffer.from(orig)
    bad[bad.length - 1] = bad[bad.length - 1]! ^ 0xff
    writeFileSync(p, bad)
    expect((await mm.verify(DEFAULT_MODELS.vad)).state).toBe('corrupt')
    await expect(createVad(mm, DEFAULT_MODELS.vad)).rejects.toThrow(/corrupt/)
    await mm.ensure(DEFAULT_MODELS.vad)
    expect((await mm.verify(DEFAULT_MODELS.vad)).state).toBe('ready')
  })
})
