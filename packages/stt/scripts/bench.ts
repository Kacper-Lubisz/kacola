// Model bake-off over the fixture meetings: WER and real-time factor for every live and final candidate
// in the catalog. This is how the defaults in DEFAULT_MODELS were chosen (numbers in docs/stt.md).
//
//   node packages/stt/scripts/bench.ts [--live] [--final] [--models id,id] [--threads 4] [--json out.json]
//
// Final models are measured on oracle segmentation (each ground-truth utterance, ±150 ms), so the
// number is the model's, not the VAD's. Live models stream each whole track in 100 ms chunks, as fast
// as they can decode, and are scored on the concatenation of their endpoints.

import { writeFileSync } from 'node:fs'
import type { TrackKind } from '@gnomeola/protocol'
import { listFixtures, loadFixture } from '@gnomeola/testkit/fixtures'
import { wer } from '@gnomeola/testkit/metrics'
import { CATALOG } from '../src/model-manager/catalog.ts'
import { ModelManager } from '../src/model-manager/manager.ts'
import { createFinalTranscriber, createLiveRecognizer } from '../src/sherpa/index.ts'
import { SAMPLE_RATE } from '../src/types.ts'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const opt = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const only = opt('--models')?.split(',')
const threads = Number(opt('--threads') ?? 4)
const doLive = flag('--live') || !flag('--final')
const doFinal = flag('--final') || !flag('--live')

type Row = {
  role: 'live' | 'final'
  model: string
  fixture: string
  track: TrackKind
  wer: number
  errors: number
  refWords: number
  audioS: number
  decodeS: number
  rtf: number
}
const rows: Row[] = []
const models = new ModelManager()
const fixtures = listFixtures().map(loadFixture)

const candidates = CATALOG.filter(
  (e) =>
    (only ? only.includes(e.id) : true) && ((e.role === 'live' && doLive) || (e.role === 'final' && doFinal)),
)

for (const e of candidates) {
  process.stdout.write(`ensure ${e.id}… `)
  await models.ensure(e.id)
  console.log('ok')
  if (e.role === 'final') {
    const t = await createFinalTranscriber(models, e.id, { numThreads: threads })
    await t.transcribe(new Float32Array(SAMPLE_RATE)) // warm-up
    for (const f of fixtures)
      for (const track of ['mic', 'system'] as const) {
        const pcm = f.pcm(track)
        const hyps: string[] = []
        let decode = 0
        let audio = 0
        for (const u of f.utterances(track)) {
          const a = Math.max(0, Math.round(((u.startMs - 150) * SAMPLE_RATE) / 1000))
          const b = Math.min(pcm.length, Math.round(((u.endMs + 150) * SAMPLE_RATE) / 1000))
          const t0 = performance.now()
          const r = await t.transcribe(pcm.subarray(a, b))
          decode += performance.now() - t0
          audio += ((b - a) * 1000) / SAMPLE_RATE
          hyps.push(r.text)
        }
        push('final', e.id, f.id, track, f.reference(track), hyps.join(' '), audio, decode)
      }
  } else {
    const rec = await createLiveRecognizer(models, e.id, { numThreads: 1 })
    for (const f of fixtures)
      for (const track of ['mic', 'system'] as const) {
        const texts: string[] = []
        const chunks = f.chunks(track, 100)
        let stream = rec.createStream({
          track,
          startMs: 0,
          onHypothesis: (h) => h.kind === 'endpoint' && texts.push(h.text),
        })
        let expected = 0
        const t0 = performance.now()
        for (const c of chunks) {
          if (c.atMs > expected + 1) {
            // a recorded gap: finish the stream and start a new one where audio resumes
            stream.flush()
            stream = rec.createStream({
              track,
              startMs: c.atMs,
              onHypothesis: (h) => h.kind === 'endpoint' && texts.push(h.text),
            })
          }
          stream.accept(c.samples)
          expected = c.atMs + (c.samples.length * 1000) / SAMPLE_RATE
        }
        stream.flush()
        const decode = performance.now() - t0
        const audio = chunks.reduce((a, c) => a + (c.samples.length * 1000) / SAMPLE_RATE, 0)
        push('live', e.id, f.id, track, f.reference(track), texts.join(' '), audio, decode)
      }
  }
}

function push(
  role: Row['role'],
  model: string,
  fixture: string,
  track: TrackKind,
  ref: string,
  hyp: string,
  audioMs: number,
  decodeMs: number,
) {
  const w = wer(ref, hyp)
  const row: Row = {
    role,
    model,
    fixture,
    track,
    wer: w.wer,
    errors: w.substitutions + w.deletions + w.insertions,
    refWords: w.refWords,
    audioS: audioMs / 1000,
    decodeS: decodeMs / 1000,
    rtf: decodeMs / audioMs,
  }
  rows.push(row)
  console.log(
    `${role.padEnd(5)} ${model.padEnd(40)} ${fixture.padEnd(22)} ${track.padEnd(6)} WER ${(w.wer * 100).toFixed(1).padStart(5)}%  RTF ${row.rtf.toFixed(3)}`,
  )
  if (process.env.BENCH_VERBOSE) console.log(`   REF: ${ref}\n   HYP: ${hyp}`)
}

// Summary: pooled WER (total errors / total reference words) and pooled RTF per model, split into
// synthetic (TTS) and real (LibriSpeech) speech.
console.log('\n| role | model | WER synthetic | WER LibriSpeech | WER all | RTF |')
console.log('| --- | --- | --- | --- | --- | --- |')
for (const model of [...new Set(rows.map((r) => r.model))]) {
  const rs = rows.filter((r) => r.model === model)
  const pooled = (xs: Row[]) =>
    xs.length
      ? `${((100 * xs.reduce((a, r) => a + r.errors, 0)) / xs.reduce((a, r) => a + r.refWords, 0)).toFixed(1)}%`
      : '–'
  const rtf = rs.reduce((a, r) => a + r.decodeS, 0) / rs.reduce((a, r) => a + r.audioS, 0)
  console.log(
    `| ${rs[0]!.role} | ${model} | ${pooled(rs.filter((r) => !r.fixture.startsWith('librispeech')))} | ${pooled(rs.filter((r) => r.fixture.startsWith('librispeech')))} | ${pooled(rs)} | ${rtf.toFixed(3)} |`,
  )
}
const out = opt('--json')
if (out) writeFileSync(out, JSON.stringify(rows, null, 2))
