import type { CatalogEntry } from '../model-manager/catalog.ts'
import { sherpa } from './native.ts'

// Piper/VITS text-to-speech — used only to synthesize test fixtures with exact ground truth.

export type SynthOptions = {
  /** 1 = the voice's natural pace. */
  speed?: number
}

export class SherpaTts {
  readonly modelId: string
  readonly sampleRate: number
  private readonly tts: import('./native.ts').OfflineTts

  constructor(entry: CatalogEntry, dir: string) {
    const e = entry.engine
    if (e.kind !== 'vits') throw new Error(`${entry.id} is not a VITS voice`)
    this.modelId = entry.id
    this.tts = new (sherpa().OfflineTts)({
      model: {
        vits: {
          model: `${dir}/${e.model}`,
          tokens: `${dir}/${e.tokens}`,
          dataDir: `${dir}/${e.dataDir}`,
          // Zero noise makes synthesis deterministic: the same script always yields the same audio.
          noiseScale: 0,
          noiseScaleW: 0,
          lengthScale: 1,
        },
      },
      numThreads: 2,
      provider: 'cpu',
      maxNumSentences: 1,
    })
    this.sampleRate = this.tts.sampleRate
  }

  synthesize(text: string, opts: SynthOptions = {}): { samples: Float32Array; sampleRate: number } {
    const out = this.tts.generate({ text, sid: 0, speed: opts.speed ?? 1, enableExternalBuffer: false })
    return { samples: Float32Array.from(out.samples), sampleRate: out.sampleRate }
  }
}
