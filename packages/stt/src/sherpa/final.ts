import type { CatalogEntry } from '../model-manager/catalog.ts'
import { type FinalResult, type FinalTranscriber, SAMPLE_RATE } from '../types.ts'
import { type OfflineRecognizer, type OfflineResult, sherpa } from './native.ts'

// T-4 — tier 2: a sherpa-onnx offline recognizer run once per closed segment. `decodeAsync` runs on the
// libuv thread pool, so a final pass never stalls tier 1 on the event loop.

export type SherpaFinalOptions = { numThreads?: number }

export function offlineModelConfig(entry: CatalogEntry, dir: string): Record<string, unknown> {
  const e = entry.engine
  const p = (f: string) => `${dir}/${f}`
  switch (e.kind) {
    case 'offline-whisper':
      return {
        whisper: { encoder: p(e.encoder), decoder: p(e.decoder), language: 'en', task: 'transcribe' },
        tokens: p(e.tokens),
      }
    case 'offline-moonshine-v2':
      return { moonshine: { encoder: p(e.encoder), mergedDecoder: p(e.mergedDecoder) }, tokens: p(e.tokens) }
    case 'offline-nemo-transducer':
      return {
        transducer: { encoder: p(e.encoder), decoder: p(e.decoder), joiner: p(e.joiner) },
        tokens: p(e.tokens),
        modelType: 'nemo_transducer',
      }
    default:
      throw new Error(`${entry.id} is not an offline recognizer (${e.kind})`)
  }
}

export class SherpaFinalTranscriber implements FinalTranscriber {
  readonly modelId: string
  private readonly rec: OfflineRecognizer

  private constructor(modelId: string, rec: OfflineRecognizer) {
    this.modelId = modelId
    this.rec = rec
  }

  static async create(entry: CatalogEntry, dir: string, opts: SherpaFinalOptions = {}) {
    const rec = await sherpa().OfflineRecognizer.createAsync({
      featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
      modelConfig: {
        ...offlineModelConfig(entry, dir),
        numThreads: opts.numThreads ?? 4,
        provider: 'cpu',
        debug: 0,
      },
    })
    return new SherpaFinalTranscriber(entry.id, rec)
  }

  async transcribe(samples: Float32Array, opts: { signal?: AbortSignal } = {}): Promise<FinalResult> {
    opts.signal?.throwIfAborted()
    if (samples.length < SAMPLE_RATE / 10) return { text: '', confidence: null }
    const stream = this.rec.createStream()
    // Copy: the caller's buffer may be a view into a ring buffer that is about to be reused.
    stream.acceptWaveform({ samples: Float32Array.from(samples), sampleRate: SAMPLE_RATE })
    const r = await this.rec.decodeAsync(stream)
    opts.signal?.throwIfAborted()
    return { text: cleanFinalText(r.text), confidence: confidenceOf(r) }
  }
}

function confidenceOf(r: OfflineResult): number | null {
  const lp = r.ys_log_probs ?? []
  if (!lp.length) return null
  const mean = lp.reduce((a, b) => a + Math.exp(b), 0) / lp.length
  return Math.max(0, Math.min(1, mean))
}

/** Drop non-speech annotations some models emit ("[BLANK_AUDIO]", "(music)") and tidy whitespace. */
export function cleanFinalText(text: string): string {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)|<\|[^|]*\|>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
