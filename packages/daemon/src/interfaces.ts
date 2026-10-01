import type {
  AudioDevice,
  Citation,
  KeyedProvider,
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
  /** Voices remembered from earlier sessions (A-6); empty unless voiceprints are switched on. */
  voices?: KnownVoice[]
  /**
   * Resume a recording the previous daemon left mid-meeting (a restart): the session dir already holds
   * `offsetMs` of audio per track. Append to those files, fill `gapMs` (the time no daemon was
   * capturing) with silence reported as a `restart` gap on every track, and carry the timeline on from
   * `offsetMs + gapMs` — segment times continue where the earlier ones stopped. A pipeline that cannot
   * continue throws; the daemon then closes the session out.
   */
  continueAt?: { offsetMs: number; gapMs: number }
}

/** A person's voice as the diarizer needs it: an embedding from one model. */
export type KnownVoice = { id: string; model: string; embedding: number[] }

/** The voice of each far-end speaker of a recording, from the diarizer's clusters. */
export type SpeakerVoices = {
  model: string
  voices: { speakerId: string; embedding: number[]; weightMs: number }[]
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
  // ---- M3: attribution. Only far-end speech is ever diarized; the mic is `me` by construction.
  /**
   * A far-end speaker the diarizer found. `key` is stable for the recording (its cluster); the daemon
   * returns the speaker id to attribute with (the same id for the same key), or null if it could not
   * create one. `voiceprintId`: the remembered voice the diarizer recognised, if any.
   */
  speaker(e: { key: string; voiceprintId: string | null }): string | null
  /** Far-end segments now attributed to a speaker id from `speaker()` (online, or re-clustered). */
  attribute(e: { speakerId: string; segmentIds: string[] }): void
  /** End of recording: each far-end speaker's voice (the daemon decides whether to keep any of it). */
  voices(v: SpeakerVoices): void
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
  /** The far-end voices heard so far (for naming a speaker mid-meeting), if the pipeline diarizes. */
  voices?(): SpeakerVoices | null
}

/** Capture + live/final STT composed: one recording per session. */
export interface TranscriptionPipeline {
  /**
   * Whether start() honours `continueAt` (resuming a recording after a daemon restart). Without it the
   * daemon never tries: a recording left by the previous daemon is closed out instead.
   */
  readonly canContinue?: boolean
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
  /** The current provider's key, from its env var (ANTHROPIC_API_KEY / OPENAI_API_KEY) or the keyring. Never log it. */
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
/** Which provider a stored key belongs to. */
export type KeyAccount = KeyedProvider

export interface Keyring {
  get(account?: KeyAccount): Promise<string | null>
  set(key: string, account?: KeyAccount): Promise<void>
  clear(account?: KeyAccount): Promise<void>
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
