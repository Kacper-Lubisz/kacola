import type { TimedWord } from '../types.ts'

// H-8 — cloud speech-to-text for full-offload mode. A cloud provider plugs in behind the SAME tier-2
// interface as the local models (`FinalTranscriber`, ../types.ts), and additionally offers what a
// hosted server needs and a laptop does not: whole-recording transcription with provider-side
// diarization (`BatchTranscriber`). Nothing here imports the sherpa native addon, so the hosted
// bundle can use it (`@gnomeola/stt/cloud`).

/** One utterance of a whole-recording transcript, on the recording's own timeline (ms from 0). */
export type DiarizedUtterance = {
  startMs: number
  endMs: number
  text: string
  /** 0-based speaker index from the provider's diarization; null when diarization was not asked. */
  speaker: number | null
  confidence: number | null
  words: TimedWord[]
}

export type BatchAudio = {
  /** 16-bit little-endian mono PCM. */
  pcm: Uint8Array
  sampleRate: number
}

export interface BatchTranscriber {
  readonly id: string
  transcribe(
    audio: BatchAudio,
    opts?: { diarize?: boolean; signal?: AbortSignal },
  ): Promise<DiarizedUtterance[]>
}

export class CloudSttError extends Error {
  readonly status: number | null
  readonly retryable: boolean
  constructor(message: string, status: number | null, retryable: boolean) {
    super(message)
    this.name = 'CloudSttError'
    this.status = status
    this.retryable = retryable
  }
}
