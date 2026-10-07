import type { TrackKind } from '@kacola/protocol'
import type { CatalogEntry } from '../model-manager/catalog.ts'
import {
  type LiveHypothesis,
  type LiveRecognizer,
  type LiveStream,
  type LiveStreamOptions,
  SAMPLE_RATE,
  samplesToMs,
  type TimedWord,
} from '../types.ts'
import { type OnlineRecognizer, type OnlineResult, type OnlineStream, sherpa } from './native.ts'

// T-3 — tier 1: sherpa-onnx streaming transducer. One native recognizer serves every track; each track
// gets its own stream. Decoding is synchronous but cheap (a few ms per 100 ms chunk on one thread).

export type SherpaLiveOptions = {
  numThreads?: number
  /** Trailing silence (s) after speech that ends an utterance. */
  endpointSilenceS?: number
  /** Hard cap on one utterance (s). */
  maxUtteranceS?: number
}

export class SherpaLiveRecognizer implements LiveRecognizer {
  readonly modelId: string
  private readonly rec: OnlineRecognizer

  constructor(entry: CatalogEntry, dir: string, opts: SherpaLiveOptions = {}) {
    const e = entry.engine
    if (e.kind !== 'online-transducer') throw new Error(`${entry.id} is not a streaming model (${e.kind})`)
    this.modelId = entry.id
    const p = (f: string) => `${dir}/${f}`
    this.rec = new (sherpa().OnlineRecognizer)({
      featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
      modelConfig: {
        transducer: { encoder: p(e.encoder), decoder: p(e.decoder), joiner: p(e.joiner) },
        tokens: p(e.tokens),
        numThreads: opts.numThreads ?? 1,
        provider: 'cpu',
        debug: 0,
      },
      decodingMethod: 'greedy_search',
      enableEndpoint: 1,
      rule1MinTrailingSilence: 2.4,
      rule2MinTrailingSilence: opts.endpointSilenceS ?? 0.8,
      rule3MinUtteranceLength: opts.maxUtteranceS ?? 20,
    })
  }

  createStream(opts: LiveStreamOptions): LiveStream {
    return new SherpaLiveStream(this.rec, opts)
  }
}

class SherpaLiveStream implements LiveStream {
  private readonly stream: OnlineStream
  private fed = 0
  private lastText = ''
  private finished = false
  private readonly rec: OnlineRecognizer
  private readonly opts: LiveStreamOptions

  constructor(rec: OnlineRecognizer, opts: LiveStreamOptions) {
    this.rec = rec
    this.opts = opts
    this.stream = rec.createStream()
  }

  accept(samples: Float32Array): void {
    if (this.finished) throw new Error('live stream already flushed')
    this.stream.acceptWaveform({ samples, sampleRate: SAMPLE_RATE })
    this.fed += samples.length
    this.drain()
  }

  flush(): void {
    if (this.finished) return
    // Right-context padding so the last word is decoded, then end of input.
    this.stream.acceptWaveform({ samples: new Float32Array(SAMPLE_RATE * 0.6), sampleRate: SAMPLE_RATE })
    this.stream.inputFinished()
    while (this.rec.isReady(this.stream)) this.rec.decode(this.stream)
    this.finished = true
    const r = this.rec.getResult(this.stream)
    if (r.text.trim()) this.emit('endpoint', r)
    this.lastText = ''
  }

  private drain(): void {
    while (this.rec.isReady(this.stream)) this.rec.decode(this.stream)
    const r = this.rec.getResult(this.stream)
    if (this.rec.isEndpoint(this.stream)) {
      if (r.text.trim()) this.emit('endpoint', r)
      else if (this.lastText) this.emit('partial', r) // a partial that evaporated: clear it
      this.rec.reset(this.stream)
      this.lastText = ''
      return
    }
    if (r.text !== this.lastText) {
      this.emit('partial', r)
      this.lastText = r.text
    }
  }

  private emit(kind: LiveHypothesis['kind'], r: OnlineResult): void {
    const nowMs = this.opts.startMs + samplesToMs(this.fed)
    const words = wordsFromTokens(r, this.opts.startMs, nowMs)
    this.opts.onHypothesis({
      kind,
      track: this.opts.track as TrackKind,
      text: displayText(r.text),
      words,
      startMs: Math.min(nowMs, this.opts.startMs + Math.round(r.start_time * 1000)),
      endMs: nowMs,
    })
  }
}

/**
 * BPE tokens → timed words. A token starting with a space (or SentencePiece's ▁) begins a word.
 * Token times are seconds relative to the segment's `start_time`.
 */
export function wordsFromTokens(r: OnlineResult, streamStartMs: number, nowMs: number): TimedWord[] {
  const words: { text: string; t: number }[] = []
  for (let i = 0; i < r.tokens.length; i++) {
    const tok = r.tokens[i]!
    const t = streamStartMs + Math.round(((r.start_time ?? 0) + (r.timestamps[i] ?? 0)) * 1000)
    const begins = /^[\s▁]/.test(tok) || words.length === 0
    const clean = tok.replace(/▁/g, ' ')
    if (begins) words.push({ text: clean.trim(), t })
    else words[words.length - 1]!.text += clean.trim()
  }
  const out: TimedWord[] = []
  const nonEmpty = words.filter((w) => w.text)
  for (let i = 0; i < nonEmpty.length; i++) {
    const w = nonEmpty[i]!
    const next = nonEmpty[i + 1]
    const startMs = Math.min(w.t, nowMs)
    out.push({
      text: displayWord(w.text),
      startMs,
      endMs: Math.max(startMs, Math.min(next ? next.t : nowMs, nowMs)),
    })
  }
  return out
}

/** Streaming English models emit ALL CAPS; present them as lower case with a capital `I`. */
function displayWord(w: string): string {
  if (w !== w.toUpperCase() || !/[A-Z]/.test(w)) return w
  const lower = w.toLowerCase()
  return lower === 'i' || lower.startsWith("i'") ? `I${lower.slice(1)}` : lower
}

export function displayText(text: string): string {
  return text.trim().split(/\s+/).filter(Boolean).map(displayWord).join(' ')
}
