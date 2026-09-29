import type { KnownVoice } from './clustering.ts'

// A-1 — provider-agnostic diarization interfaces. Only the far-end track is diarized: the microphone is
// the user by construction and never passes through here. The sherpa-onnx implementation (pyannote
// segmentation + a speaker-embedding model) lives in ../sherpa/diarize.ts; a cloud provider with its
// own diarization (H-8) implements DiarizerProvider directly.
//
// All PCM is 16 kHz mono float32; all times are session milliseconds, like the rest of @gnomeola/stt.

/** Maps a stretch of speech to a fixed-length voice embedding (unit length not required). */
export interface SpeakerEmbedder {
  readonly modelId: string
  embed(samples: Float32Array): Promise<Float32Array>
  close?(): void
}

/** A local speaker turn inside one stretch of audio; times are ms from its first sample. */
export type LocalTurn = { startMs: number; endMs: number; speaker: number }

/** Finds who-spoke-when inside a short stretch of audio (pyannote segmentation 3.0). */
export interface TurnDetector {
  readonly modelId: string
  turns(samples: Float32Array): Promise<LocalTurn[]>
  close?(): void
}

export type SegmentSpan = { segmentId: string; startMs: number; endMs: number }

export type ClusterInfo = {
  cluster: number
  /** Unit-length centroid; what a voiceprint is made from. */
  centroid: Float32Array
  weightMs: number
  segments: number
  /** The known voice (A-6) this cluster was recognised as. */
  voiceprintId: string | null
}

export type SpeakerAttribution = { segmentId: string; cluster: number }

/** One session's worth of far-end diarization. Calls are made in segment-close order. */
export interface DiarizationSession {
  /** The embedding model: voiceprints from any other model are never compared. */
  readonly embeddingModel: string
  /**
   * Speaker changes inside a closed far-end segment, as session times to split it at before tier 2.
   * Empty when it is one speaker (or too short to tell).
   */
  changes(span: { startMs: number; endMs: number }, samples: Float32Array): Promise<number[]>
  /** Attribute a closed segment to a speaker cluster (online). Cluster ids never change once issued. */
  assign(span: SegmentSpan, samples: Float32Array): Promise<{ cluster: number; created: boolean }>
  /** End of session: re-cluster everything seen, keeping ids where they agree; returns what changed. */
  finish(): Promise<SpeakerAttribution[]>
  clusters(): ClusterInfo[]
}

export type DiarizationSessionOptions = {
  /** Voices of people named in earlier sessions (only with voiceprints on). */
  voices?: readonly KnownVoice[]
}

export interface DiarizerProvider {
  readonly id: string
  readonly embeddingModel: string
  createSession(opts?: DiarizationSessionOptions): DiarizationSession
  close?(): void
}
