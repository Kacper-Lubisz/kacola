// Sanity check for the on-device embedder against a model directory:
//   node packages/decisions/scripts/embed-check.ts <model-dir>
import { cosine, OnnxEmbedder, WordPieceTokenizer } from '../src/index.ts'

const dir = process.argv[2]
if (!dir) throw new Error('usage: embed-check.ts <model-dir>')
const tok = WordPieceTokenizer.fromFile()
console.log('ids', tok.encode("Hello world! Unaffable naïve café, don't.").ids.join(' '))
const e = await OnnxEmbedder.create(dir)
const texts = [
  'The retry budget is three attempts, then dead-letter.',
  'We agreed to retry three times before sending the message to the dead letter queue.',
  'My weekend was lovely, we went hiking in the hills.',
  'What salary range are you offering for this role?',
  'The band for this position is 120 to 140 thousand.',
]
const t0 = performance.now()
const v = await e.embed(texts)
console.log(`embedded ${texts.length} in ${(performance.now() - t0).toFixed(0)} ms, dim ${v[0]!.length}`)
for (let i = 0; i < texts.length; i++) console.log(i, v.map((w) => cosine(v[i]!, w).toFixed(2)).join(' '))
