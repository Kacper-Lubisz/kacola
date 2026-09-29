// Diarization bake-off over the fixture meetings (A-7): far-end DER for each embedding model and
// clustering setting, online and after re-clustering. This is how DEFAULT_MODELS.embedding and the
// DIARIZATION_DEFAULTS thresholds were chosen (numbers in docs/stt.md).
//
//   node packages/stt/scripts/diarize-bench.ts [--models id,id] [--threshold 0.5,0.6] [--recluster 0.5,off]
//
// It runs what the pipeline runs on the far-end track — Silero VAD segments, pyannote turn splitting,
// embeddings, online clustering, re-clustering — without speech recognition, so a sweep takes seconds.

import { listFixtures, loadFixture } from '@gnomeola/testkit/fixtures'
import { der } from '@gnomeola/testkit/metrics'
import { DIARIZATION_DEFAULTS } from '../src/diarize/session.ts'
import { CATALOG, DEFAULT_MODELS } from '../src/model-manager/catalog.ts'
import { ModelManager } from '../src/model-manager/manager.ts'
import { createDiarizer, createVad } from '../src/sherpa/index.ts'
import { msToSamples } from '../src/types.ts'

const args = process.argv.slice(2)
const opt = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const embeddings =
  opt('--models')?.split(',') ?? CATALOG.filter((e) => e.role === 'embedding').map((e) => e.id)
const thresholds = (opt('--threshold') ?? String(DIARIZATION_DEFAULTS.threshold)).split(',').map(Number)
const reclusters = (opt('--recluster') ?? String(DIARIZATION_DEFAULTS.reclusterThreshold))
  .split(',')
  .map((x) => (x === 'off' ? null : Number(x)))

const models = new ModelManager()
const vad = await createVad(models, DEFAULT_MODELS.vad)
const fixtures = listFixtures()
  .map(loadFixture)
  .filter(
    (f) => new Set(f.truth.utterances.filter((u) => u.track === 'system').map((u) => u.speaker)).size >= 1,
  )

// VAD segments per fixture, once
const vadSegs = new Map<string, { startMs: number; endMs: number }[]>()
for (const f of fixtures) {
  const segs: { startMs: number; endMs: number }[] = []
  const st = vad.createStream({
    track: 'system',
    startMs: 0,
    onEvent: (e) => {
      if (e.kind === 'end') segs.push({ startMs: e.startMs, endMs: e.endMs })
    },
  })
  const pcm = f.pcm('system')
  for (let i = 0; i < pcm.length; i += 1600) st.accept(pcm.subarray(i, i + 1600))
  st.flush()
  vadSegs.set(f.id, segs)
}

for (const emb of embeddings) {
  await models.ensure(emb)
  await models.ensure(DEFAULT_MODELS.segmentation)
  for (const threshold of thresholds)
    for (const recluster of reclusters) {
      const d = await createDiarizer(
        models,
        { embedding: emb, segmentation: DEFAULT_MODELS.segmentation },
        { threshold, reclusterThreshold: recluster },
      )
      const rows: string[] = []
      let sum = 0
      let sumOnline = 0
      for (const f of fixtures) {
        const pcm = f.pcm('system')
        const cut = (a: number, b: number) => pcm.subarray(msToSamples(a), msToSamples(b))
        const s = d.createSession()
        const pieces: { id: string; startMs: number; endMs: number }[] = []
        const online = new Map<string, number>()
        let n = 0
        for (const seg of vadSegs.get(f.id)!) {
          const cuts = await s.changes(seg, cut(seg.startMs, seg.endMs))
          const bounds = [seg.startMs, ...cuts, seg.endMs]
          for (let k = 0; k + 1 < bounds.length; k++) {
            const p = { id: `p${n++}`, startMs: bounds[k]!, endMs: bounds[k + 1]! }
            pieces.push(p)
            const a = await s.assign({ segmentId: p.id, ...p }, cut(p.startMs, p.endMs))
            online.set(p.id, a.cluster)
          }
        }
        const final = new Map(online)
        for (const c of await s.finish()) final.set(c.segmentId, c.cluster)
        const ref = f
          .utterances('system')
          .map((u) => ({ speaker: u.speaker, startMs: u.startMs, endMs: u.endMs }))
        const hyp = (m: Map<string, number>) => pieces.map((p) => ({ speaker: `c${m.get(p.id)}`, ...p }))
        const on = der(ref, hyp(online), { collarMs: 250 })
        const fin = der(ref, hyp(final), { collarMs: 250 })
        sum += fin.der
        sumOnline += on.der
        const found = new Set(final.values()).size
        const present = new Set(ref.map((r) => r.speaker)).size
        rows.push(
          `${f.id.padEnd(22)} online ${(on.der * 100).toFixed(1).padStart(5)}%  final ${(fin.der * 100).toFixed(1).padStart(5)}% (conf ${((fin.confusionMs / fin.scoredMs) * 100).toFixed(1)}%)  speakers ${found}/${present}`,
        )
      }
      d.close()
      console.log(
        `\n${emb} threshold=${threshold} recluster=${recluster ?? 'off'}: mean DER online ${((sumOnline / fixtures.length) * 100).toFixed(1)}%, final ${((sum / fixtures.length) * 100).toFixed(1)}%`,
      )
      for (const r of rows) console.log(`  ${r}`)
    }
}
process.exit(0)
