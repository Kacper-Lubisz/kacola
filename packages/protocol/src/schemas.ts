import { z } from 'zod'

// ---------------------------------------------------------------- primitives

export const Iso = z.iso.datetime({ offset: true })

/** Which physical stream a piece of audio came from. `mic` is the user, by construction. */
export const TrackKind = z.enum(['mic', 'system'])
export type TrackKind = z.infer<typeof TrackKind>

/** `live` = tier-1 streaming hypothesis; `final` = tier-2 re-transcription. Transitions once, never back. */
export const Quality = z.enum(['live', 'final'])
export type Quality = z.infer<typeof Quality>

/**
 * `recovered` marks a session that was `recording` when the daemon died; on restart its audio is
 * intact up to the last flush and it is closed out rather than silently truncated.
 */
export const SessionStatus = z.enum(['idle', 'recording', 'paused', 'stopped', 'recovered', 'failed'])
export type SessionStatus = z.infer<typeof SessionStatus>

/** Speaker labels. Track A is always `me`. Without diarization (M3) the far end is `them`. */
export const ME = 'me'
export const THEM = 'them'
export const speakerForTrack = (t: TrackKind): string => (t === 'mic' ? ME : THEM)

// ------------------------------------------------------------------- domain

export const Track = z.object({
  kind: TrackKind,
  /** PipeWire node name (or `file:<path>` for the file-backed source). */
  device: z.string(),
  sampleRate: z.int().positive(),
  /** WAV captured during the session; null once retention has removed it. */
  audioPath: z.string().nullable(),
  /** Compressed archive (Opus), if encoded. */
  archivePath: z.string().nullable(),
  /** Recorded gaps (device switches, suspend) — reported, never papered over. */
  gaps: z.array(
    z.object({ atMs: z.int().nonnegative(), durationMs: z.int().nonnegative(), reason: z.string() }),
  ),
})
export type Track = z.infer<typeof Track>

export const Session = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: Iso,
  startedAt: Iso.nullable(),
  endedAt: Iso.nullable(),
  status: SessionStatus,
  /** Private sessions are invisible to the CLI and skill, visible in the window. */
  private: z.boolean(),
  durationMs: z.int().nonnegative(),
  tracks: z.array(Track),
  error: z.string().nullable(),
})
export type Session = z.infer<typeof Session>

export const Segment = z.object({
  id: z.string(),
  sessionId: z.string(),
  track: TrackKind,
  speaker: z.string(),
  startMs: z.int().nonnegative(),
  endMs: z.int().nonnegative(),
  text: z.string(),
  quality: Quality,
  /** Monotonic per segment id; every upsert increments it. */
  revision: z.int().positive(),
  confidence: z.number().min(0).max(1).nullable(),
})
export type Segment = z.infer<typeof Segment>

export const SearchHit = z.object({
  sessionId: z.string(),
  sessionTitle: z.string(),
  segmentId: z.string(),
  speaker: z.string(),
  startMs: z.int().nonnegative(),
  endMs: z.int().nonnegative(),
  /** Short excerpt with the match marked [like this]. Never the whole segment if it is long. */
  snippet: z.string(),
  score: z.number(),
})
export type SearchHit = z.infer<typeof SearchHit>

export const Citation = z.object({
  sessionId: z.string(),
  segmentId: z.string(),
  startMs: z.int().nonnegative(),
  endMs: z.int().nonnegative(),
  speaker: z.string(),
})
export type Citation = z.infer<typeof Citation>

export const Usage = z.object({
  inputTokens: z.int().nonnegative(),
  outputTokens: z.int().nonnegative(),
  cacheReadTokens: z.int().nonnegative(),
  cacheWriteTokens: z.int().nonnegative(),
})
export type Usage = z.infer<typeof Usage>

export const QaMessage = z.object({
  id: z.string(),
  /** null for cross-session questions. */
  sessionId: z.string().nullable(),
  /** Groups a question with its answer. */
  requestId: z.string(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  citations: z.array(Citation),
  model: z.string().nullable(),
  usage: Usage.nullable(),
  stopReason: z.string().nullable(),
  createdAt: Iso,
})
export type QaMessage = z.infer<typeof QaMessage>

export const AudioDevice = z.object({
  /** PipeWire node.name — stable across reboots, unlike numeric ids. */
  name: z.string(),
  description: z.string(),
  kind: z.enum(['source', 'sink']),
  isDefault: z.boolean(),
})
export type AudioDevice = z.infer<typeof AudioDevice>

export const ModelInfo = z.object({
  id: z.string(),
  role: z.enum(['live', 'final', 'vad']),
  title: z.string(),
  sizeBytes: z.int().nonnegative(),
  state: z.enum(['missing', 'downloading', 'ready', 'corrupt']),
  progress: z.number().min(0).max(1).nullable(),
})
export type ModelInfo = z.infer<typeof ModelInfo>

export const Settings = z.object({
  llm: z.object({
    provider: z.enum(['anthropic', 'ollama', 'none']),
    model: z.string(),
    ollamaUrl: z.string(),
    /** Read-only: whether a key is present in the keyring / env. The key itself never crosses the wire. */
    apiKeyConfigured: z.boolean(),
  }),
  stt: z.object({
    liveModel: z.string(),
    finalModel: z.string(),
    /** `after` defers tier 2 to end-of-session when CPU is tight. */
    finalPass: z.enum(['during', 'after', 'off']),
  }),
  capture: z.object({ micDevice: z.string(), systemDevice: z.string() }),
  retention: z.object({
    audio: z.enum(['keep', 'delete-after-transcription', 'delete-after-days']),
    days: z.int().positive(),
    archive: z.boolean(),
  }),
})
export type Settings = z.infer<typeof Settings>

/** Settings as persisted: everything except the derived, read-only `apiKeyConfigured`. */
export const StoredSettings = Settings.extend({ llm: Settings.shape.llm.omit({ apiKeyConfigured: true }) })
export type StoredSettings = z.infer<typeof StoredSettings>

export const SettingsPatch = z.object({
  llm: Settings.shape.llm.omit({ apiKeyConfigured: true }).partial().optional(),
  stt: Settings.shape.stt.partial().optional(),
  capture: Settings.shape.capture.partial().optional(),
  retention: Settings.shape.retention.partial().optional(),
})
export type SettingsPatch = z.infer<typeof SettingsPatch>

export const Health = z.object({
  ok: z.boolean(),
  version: z.string(),
  uptimeMs: z.int().nonnegative(),
  lastSeq: z.int().nonnegative(),
  capture: z.object({ available: z.boolean(), backend: z.string(), detail: z.string().nullable() }),
  models: z.array(ModelInfo),
  llm: z.object({ provider: z.string(), ready: z.boolean() }),
})
export type Health = z.infer<typeof Health>

export const ApiError = z.object({
  error: z.object({
    code: z.enum(['bad_request', 'not_found', 'conflict', 'unavailable', 'internal', 'unauthorized']),
    message: z.string(),
  }),
})
export type ApiError = z.infer<typeof ApiError>
