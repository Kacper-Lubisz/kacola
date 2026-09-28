import type {
  AudioDevice,
  Citation,
  ModelInfo,
  QaMessage,
  Segment,
  Session,
  StoredSettings,
  Track,
  TrackKind,
  Usage,
} from '@gnomeola/protocol'

// The seams where real subsystems plug into the daemon. Each is small on purpose: the daemon owns
// sessions, persistence, the event log and HTTP; everything behind these interfaces owns audio, models
// and LLM calls. Fakes for every one live in ./fakes and drive the whole daemon in tests.
//
// Errors: throw a `DaemonError` (./errors.ts) with an ApiError code to control the HTTP status a failure
// maps to (e.g. `unavailable` → 503). Anything else becomes a 500 with the details only in the log.

// ------------------------------------------------------------ capture + STT

/** One track the daemon wants recorded. `device` is a PipeWire node name, or 'default'. */
export type TrackRequest = { kind: TrackKind; device: string }

export type PipelineStartOptions = {
  sessionId: string
  /** A directory owned by this session (already created). Audio files belong here. */
  sessionDir: string
  tracks: TrackRequest[]
  settings: StoredSettings
}

/**
 * A segment as the pipeline reports it. The daemon adds `sessionId` and the store assigns `revision`
 * (previous + 1). Re-emit the same `id` to revise a segment (e.g. live → final); the store rejects an
 * upsert that regresses final → live, changes track, attributes the mic to anyone but `me`, or
 * attributes the far end to `me`.
 */
export type SegmentUpsert = Omit<Segment, 'revision' | 'sessionId'>

/**
 * Where a running recording reports what happens. Methods may be called from any callback; they are
 * synchronous and never throw. Calls made after `RecordingHandle.stop()` resolves are dropped.
 */
export interface PipelineSink {
  /** Audio level meter (ephemeral, lossy). 0..1 linear. `elapsedMs` = audio time on this track. */
  level(e: { track: TrackKind; rms: number; peak: number; elapsedMs: number }): void
  /** An in-progress hypothesis for the open segment on a track (ephemeral, lossy). */
  partial(e: { track: TrackKind; speaker: string; startMs: number; text: string }): void
  /** A closed segment, or a revision of one (durable). */
  segment(s: SegmentUpsert): void
  /** A recorded gap in the audio (device switch, suspend). Stored on the session's track. */
  gap(e: { track: TrackKind; atMs: number; durationMs: number; reason: string }): void
  /** `fatal: true` means the recording cannot continue: the daemon stops it and marks it failed. */
  error(e: { message: string; fatal: boolean }): void
}

export interface RecordingHandle {
  /** Tracks as actually opened: resolved device names, sample rate, audio path. */
  readonly tracks: Track[]
  pause(): Promise<void>
  resume(): Promise<void>
  /**
   * Stop capture, flush audio to disk, and finish transcribing what was captured (emitting any last
   * segments / finals through the sink) before resolving.
   */
  stop(): Promise<void>
}

/** Capture + live/final STT composed: one recording per session. */
export interface TranscriptionPipeline {
  health(): Promise<{ available: boolean; backend: string; detail: string | null }>
  start(opts: PipelineStartOptions, sink: PipelineSink): Promise<RecordingHandle>
}

// -------------------------------------------------------------------- Q&A

export type QaTranscript = { session: Session; segments: Segment[] }

export type QaRequest = {
  requestId: string
  question: string
  effort: 'low' | 'medium' | 'high'
  /** One entry for a single-session question, several for a cross-session one. Private sessions are
   *  only present when the caller explicitly asked for them. */
  transcripts: QaTranscript[]
  /** Earlier Q&A in this session (oldest first), excluding the question being asked. */
  history: QaMessage[]
  settings: StoredSettings['llm']
  /** From ANTHROPIC_API_KEY or the keyring. Never log it. */
  apiKey: string | null
  signal: AbortSignal
}

export type QaChunk =
  | { type: 'delta'; text: string }
  | {
      type: 'final'
      text: string
      citations: Citation[]
      model: string | null
      usage: Usage | null
      stopReason: string | null
    }

export interface QaEngine {
  /** Whether a question could be answered right now (provider configured, key present, …). */
  ready(ctx: { settings: StoredSettings['llm']; apiKeyConfigured: boolean }): boolean
  /** Stream deltas, then exactly one `final`. Throw a DaemonError to fail with a specific code. */
  ask(req: QaRequest): AsyncIterable<QaChunk>
}

// ---------------------------------------------------------------- secrets

/** Where the Anthropic API key lives. The daemon never writes it anywhere else. */
export interface Keyring {
  get(): Promise<string | null>
  set(key: string): Promise<void>
  clear(): Promise<void>
}

// -------------------------------------------------------- devices + models

export interface DeviceProvider {
  list(): Promise<AudioDevice[]>
}

export interface ModelProvider {
  list(): Promise<ModelInfo[]>
  /**
   * Begin downloading (or verifying) a model and resolve with its state right after starting —
   * typically `downloading`, or `ready` if already present. Report progress through `onProgress`
   * until it settles in `ready` or `corrupt`. Reject with DaemonError('not_found') for an unknown id.
   */
  startDownload(id: string, onProgress: (m: ModelInfo) => void): Promise<ModelInfo>
}
