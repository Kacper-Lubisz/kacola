import { createRequire } from 'node:module'

// sherpa-onnx-node ships JavaScript with JSDoc only, so the slice of its API we use is typed here.
// Loaded lazily: importing @gnomeola/stt must not require the native addon (unit tests, the reconciler,
// and cloud providers never touch it).

export type Waveform = { samples: Float32Array; sampleRate: number }

export type OnlineResult = {
  text: string
  tokens: string[]
  /** Seconds, relative to the start of the current segment (see `start_time`). */
  timestamps: number[]
  ys_probs?: number[]
  segment: number
  start_time: number
  is_final: boolean
}

export type OfflineResult = {
  text: string
  tokens: string[]
  timestamps: number[]
  ys_log_probs: number[]
}

export interface OnlineStream {
  acceptWaveform(w: Waveform): void
  inputFinished(): void
}
export interface OnlineRecognizer {
  createStream(): OnlineStream
  isReady(s: OnlineStream): boolean
  decode(s: OnlineStream): void
  isEndpoint(s: OnlineStream): boolean
  reset(s: OnlineStream): void
  getResult(s: OnlineStream): OnlineResult
}
export interface OfflineStream {
  acceptWaveform(w: Waveform): void
}
export interface OfflineRecognizer {
  createStream(): OfflineStream
  decode(s: OfflineStream): void
  decodeAsync(s: OfflineStream): Promise<OfflineResult>
  getResult(s: OfflineStream): OfflineResult
}
export interface Vad {
  acceptWaveform(samples: Float32Array): void
  isEmpty(): boolean
  isDetected(): boolean
  pop(): void
  front(enableExternalBuffer?: boolean): { start: number; samples: Float32Array }
  reset(): void
  flush(): void
}
export interface OfflineTts {
  readonly sampleRate: number
  readonly numSpeakers: number
  generate(req: { text: string; sid: number; speed: number; enableExternalBuffer?: boolean }): Waveform
}

export interface SpeakerEmbeddingExtractor {
  readonly dim: number
  createStream(): OnlineStream
  isReady(s: OnlineStream): boolean
  compute(s: OnlineStream, enableExternalBuffer?: boolean): Float32Array
}
export type DiarizationSegment = { start: number; end: number; speaker: number }
export interface OfflineSpeakerDiarization {
  readonly sampleRate: number
  process(samples: Float32Array): DiarizationSegment[]
}

export type SherpaModule = {
  version: string
  gitSha1: string
  onnxruntimeVersion?: string
  OnlineRecognizer: new (config: Record<string, unknown>) => OnlineRecognizer
  OfflineRecognizer: {
    new (config: Record<string, unknown>): OfflineRecognizer
    createAsync(config: Record<string, unknown>): Promise<OfflineRecognizer>
  }
  Vad: new (config: Record<string, unknown>, bufferSizeInSeconds: number) => Vad
  OfflineTts: new (config: Record<string, unknown>) => OfflineTts
  SpeakerEmbeddingExtractor: new (config: Record<string, unknown>) => SpeakerEmbeddingExtractor
  OfflineSpeakerDiarization: new (config: Record<string, unknown>) => OfflineSpeakerDiarization
  readWave(path: string, enableExternalBuffer?: boolean): Waveform
  writeWave(path: string, w: Waveform): boolean
}

let cached: SherpaModule | null = null

export function sherpa(): SherpaModule {
  if (!cached) cached = createRequire(import.meta.url)('sherpa-onnx-node') as SherpaModule
  return cached
}
