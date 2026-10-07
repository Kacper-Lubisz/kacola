import type { TrackKind } from '@kacola/protocol'

// T-2 — provider-agnostic speech interfaces. The sherpa-onnx implementations live in ./sherpa; a cloud
// provider (Deepgram, AssemblyAI, …) implements the same shapes. Everything is on the *session
// timeline*: the caller tells a stream where its first sample sits (`startMs`) and every time that comes
// back out is already an offset into the session, so gaps and pauses never skew timestamps.

/** All PCM crossing these interfaces is 16 kHz mono float32 in [-1, 1]. */
export const SAMPLE_RATE = 16_000

export const samplesToMs = (n: number): number => (n * 1000) / SAMPLE_RATE
export const msToSamples = (ms: number): number => Math.round((ms * SAMPLE_RATE) / 1000)

export type TimedWord = { text: string; startMs: number; endMs: number }

/**
 * A tier-1 hypothesis. `partial` is the current, still-changing guess for the utterance in progress;
 * `endpoint` means the recognizer has committed that text and started a fresh utterance. `words` carry
 * per-word session times (used to attach text to VAD segments); `text` is the display form.
 */
export type LiveHypothesis = {
  kind: 'partial' | 'endpoint'
  track: TrackKind
  text: string
  words: TimedWord[]
  startMs: number
  endMs: number
}

export type LiveStreamOptions = {
  track: TrackKind
  /** Session offset of the first sample this stream will receive. */
  startMs: number
  onHypothesis: (h: LiveHypothesis) => void
}

export interface LiveStream {
  /** Contiguous PCM for this track. May emit hypotheses synchronously or later. */
  accept(samples: Float32Array): void | Promise<void>
  /** End of input: emit any trailing text as an endpoint. The stream is unusable afterwards. */
  flush(): void | Promise<void>
}

export interface LiveRecognizer {
  readonly modelId: string
  createStream(opts: LiveStreamOptions): LiveStream
  close?(): void
}

export type FinalResult = {
  text: string
  /** Mean token probability when the model exposes it, else null. */
  confidence: number | null
}

export interface FinalTranscriber {
  readonly modelId: string
  /** Transcribe one closed segment. Must not block the event loop for long (use worker threads). */
  transcribe(samples: Float32Array, opts?: { signal?: AbortSignal }): Promise<FinalResult>
  close?(): void
}

export type VadEvent =
  | { kind: 'start'; track: TrackKind; atMs: number }
  | { kind: 'end'; track: TrackKind; startMs: number; endMs: number }

export type VadStreamOptions = {
  track: TrackKind
  startMs: number
  onEvent: (e: VadEvent) => void
}

export interface VadStream {
  accept(samples: Float32Array): void
  /** Close any speech in progress (emits its `end`). The stream is unusable afterwards. */
  flush(): void
}

export interface VoiceActivityDetector {
  readonly modelId: string
  createStream(opts: VadStreamOptions): VadStream
}
