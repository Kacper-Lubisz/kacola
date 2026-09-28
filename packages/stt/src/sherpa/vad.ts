import type { CatalogEntry } from '../model-manager/catalog.ts'
import {
  SAMPLE_RATE,
  samplesToMs,
  type VadEvent,
  type VadStream,
  type VadStreamOptions,
  type VoiceActivityDetector,
} from '../types.ts'
import { sherpa, type Vad } from './native.ts'

// Silero VAD via sherpa-onnx. sherpa reports a speech segment only once it has ended (with its exact
// start sample), and exposes `isDetected()` for "speech right now". We turn that into start/end events:
// `start` fires as soon as speech is detected, with an estimated onset; `end` carries the exact bounds.

export type SileroOptions = {
  threshold?: number
  minSilenceS?: number
  minSpeechS?: number
  /** Long speech is split so a final-pass segment stays well inside Whisper's 30 s window. */
  maxSpeechS?: number
}

const WINDOW = 512

export class SileroVad implements VoiceActivityDetector {
  readonly modelId: string
  private readonly config: Record<string, unknown>
  private readonly minSpeechS: number

  constructor(entry: CatalogEntry, dir: string, opts: SileroOptions = {}) {
    if (entry.engine.kind !== 'silero-vad') throw new Error(`${entry.id} is not a Silero VAD`)
    this.modelId = entry.id
    this.minSpeechS = opts.minSpeechS ?? 0.25
    this.config = {
      sileroVad: {
        model: `${dir}/${entry.engine.model}`,
        threshold: opts.threshold ?? 0.5,
        minSilenceDuration: opts.minSilenceS ?? 0.5,
        minSpeechDuration: this.minSpeechS,
        windowSize: WINDOW,
        maxSpeechDuration: opts.maxSpeechS ?? 20,
      },
      sampleRate: SAMPLE_RATE,
      numThreads: 1,
      provider: 'cpu',
      debug: 0,
    }
  }

  createStream(opts: VadStreamOptions): VadStream {
    return new SileroStream(new (sherpa().Vad)(this.config, 60), opts, this.minSpeechS)
  }
}

class SileroStream implements VadStream {
  private readonly vad: Vad
  private readonly opts: VadStreamOptions
  private readonly onsetLagSamples: number
  private pending = new Float32Array(0)
  private fed = 0
  private inSpeech = false
  private lastEndSample = 0
  private onsetSample = 0
  private finished = false

  constructor(vad: Vad, opts: VadStreamOptions, minSpeechS: number) {
    this.vad = vad
    this.opts = opts
    this.onsetLagSamples = Math.round(minSpeechS * SAMPLE_RATE) + WINDOW
  }

  private ms(sample: number): number {
    return Math.round(this.opts.startMs + samplesToMs(sample))
  }

  private emit(e: VadEvent): void {
    this.opts.onEvent(e)
  }

  accept(samples: Float32Array): void {
    if (this.finished) throw new Error('vad stream already flushed')
    // Silero consumes fixed windows; buffer the remainder.
    const buf = new Float32Array(this.pending.length + samples.length)
    buf.set(this.pending)
    buf.set(samples, this.pending.length)
    let i = 0
    for (; i + WINDOW <= buf.length; i += WINDOW) {
      this.vad.acceptWaveform(buf.subarray(i, i + WINDOW))
      this.fed += WINDOW
      this.popSegments()
      if (this.vad.isDetected() && !this.inSpeech) {
        this.inSpeech = true
        this.onsetSample = Math.max(this.lastEndSample, this.fed - this.onsetLagSamples)
        this.emit({ kind: 'start', track: this.opts.track, atMs: this.ms(this.onsetSample) })
      }
    }
    this.pending = buf.slice(i)
  }

  flush(): void {
    if (this.finished) return
    if (this.pending.length) {
      const tail = new Float32Array(WINDOW)
      tail.set(this.pending)
      this.vad.acceptWaveform(tail)
      this.fed += this.pending.length
      this.pending = new Float32Array(0)
    }
    this.vad.flush()
    this.popSegments()
    if (this.inSpeech) {
      // Detected but too short to become a segment: close it where it is.
      this.inSpeech = false
      this.emit({
        kind: 'end',
        track: this.opts.track,
        startMs: this.ms(this.onsetSample),
        endMs: this.ms(this.fed),
      })
      this.lastEndSample = this.fed
    }
    this.finished = true
  }

  private popSegments(): void {
    while (!this.vad.isEmpty()) {
      const seg = this.vad.front(false)
      this.vad.pop()
      const start = Math.max(seg.start, this.lastEndSample)
      const end = Math.min(this.fed, seg.start + seg.samples.length)
      if (!this.inSpeech) this.emit({ kind: 'start', track: this.opts.track, atMs: this.ms(start) })
      this.emit({ kind: 'end', track: this.opts.track, startMs: this.ms(start), endMs: this.ms(end) })
      this.inSpeech = false
      this.lastEndSample = end
    }
  }
}
