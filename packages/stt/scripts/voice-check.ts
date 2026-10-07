// Intelligibility check for fixture TTS voices: synthesize every scripted line with a voice and score
// a strong offline recognizer on it. A voice that mispronounces words makes a fixture measure the TTS,
// not the recognizer — so fixture voices are only accepted when this WER is low.
//
//   node packages/stt/scripts/voice-check.ts [voice-id …]

import { execFileSync } from 'node:child_process'
import { FIXTURE_SCRIPTS as FIXTURES } from '@kacola/testkit/fixtures'
import { wer } from '@kacola/testkit/metrics'
import { CATALOG } from '../src/model-manager/catalog.ts'
import { ModelManager } from '../src/model-manager/manager.ts'
import { createFinalTranscriber, createTts } from '../src/sherpa/index.ts'

const models = new ModelManager()
const judge = 'final-parakeet-tdt-0.6b-v2-en-int8'
await models.ensure(judge)
const asr = await createFinalTranscriber(models, judge)
const lines = FIXTURES.flatMap((f) => f.script.flatMap((i) => ('text' in i && i.text ? [i.text] : [])))
const voices = process.argv.slice(2).length
  ? process.argv.slice(2)
  : CATALOG.filter((e) => e.role === 'tts').map((e) => e.id)

for (const v of voices) {
  await models.ensure(v)
  const tts = await createTts(models, v)
  const hyps: string[] = []
  for (const text of lines) {
    const a = tts.synthesize(text)
    const pcm = execFileSync(
      'ffmpeg',
      [
        '-v',
        'error',
        '-f',
        'f32le',
        '-ar',
        String(a.sampleRate),
        '-ac',
        '1',
        '-i',
        '-',
        '-f',
        'f32le',
        '-ar',
        '16000',
        '-',
      ],
      { input: Buffer.from(a.samples.buffer) },
    )
    const r = await asr.transcribe(new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4))
    hyps.push(r.text)
  }
  const w = wer(lines, hyps)
  console.log(
    `${v.padEnd(48)} WER ${(w.wer * 100).toFixed(1)}% (${w.substitutions}S ${w.deletions}D ${w.insertions}I / ${w.refWords})`,
  )
}
