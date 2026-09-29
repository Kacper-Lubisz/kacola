import { z } from 'zod'
import { DurableEventData } from './events.ts'
import { Iso, TrackKind } from './schemas.ts'

// M8 — the parts of the protocol that only exist because the backend can live somewhere else:
//
//   sync     hybrid mode. A local daemon (capture + STT stay on the laptop) pushes its durable events
//            to a hosted server. Items keep the pushing device's own seq, so a push is idempotent and
//            resumable: the server remembers a cursor per device and skips anything at or below it.
//   pairing  a device-code flow (RFC 8628 shaped) that ends in a signed bearer token. Loopback stays
//            anonymous; every remote request needs a token.
//   audio    full-offload mode. A capture-agent uploads PCM in chunks keyed by (sessionId, chunkSeq),
//            each PUT idempotent, so an interrupted upload resumes by asking what already arrived.

// ------------------------------------------------------------------------------------------ sync

/** One durable event as the pushing device logged it. `seq` is the DEVICE's seq, not the server's. */
export const SyncItem = z.object({ seq: z.int().positive(), data: DurableEventData })
export type SyncItem = z.infer<typeof SyncItem>

export const SYNC_MAX_ITEMS = 500

export const SyncPushBody = z.object({
  /** Only used when the server runs without auth (loopback tests); a token's device always wins. */
  deviceId: z.string().min(1).max(100).optional(),
  /** Non-decreasing seq. Several items may share a seq (a snapshot expanded from one event). */
  items: z.array(SyncItem).max(SYNC_MAX_ITEMS),
  /**
   * The last seq's group continues in the next push (a snapshot too big for one request): apply these
   * items but do not count that seq as done, so the rest of its group is not skipped as already seen.
   */
  partial: z.boolean().optional(),
})
export type SyncPushBody = z.infer<typeof SyncPushBody>

/** An item the server would not apply, and why. The cursor still moves past it (see docs/hosting.md). */
export const SyncRejection = z.object({ seq: z.int().positive(), type: z.string(), reason: z.string() })
export type SyncRejection = z.infer<typeof SyncRejection>

export const SyncPushResult = z.object({
  deviceId: z.string(),
  /** The highest device seq the server has now accounted for. Resume pushing after it. */
  cursor: z.int().nonnegative(),
  /** Items that changed server state (each is one server-side durable event). */
  applied: z.int().nonnegative(),
  /** Items already covered by the cursor, or no-ops (stale revisions, device-local settings). */
  skipped: z.int().nonnegative(),
  rejected: z.array(SyncRejection),
})
export type SyncPushResult = z.infer<typeof SyncPushResult>

export const SyncCursor = z.object({ deviceId: z.string(), cursor: z.int().nonnegative() })
export type SyncCursor = z.infer<typeof SyncCursor>

// --------------------------------------------------------------------------------------- pairing

export const PairStartBody = z.object({ name: z.string().trim().min(1).max(100) })
export const PairStart = z.object({
  /** Secret; only the requesting device ever sees it. Exchanged for the token once approved. */
  deviceCode: z.string(),
  /** Short, human-typable; shown to the user, typed on a device that is already trusted. */
  userCode: z.string(),
  expiresAt: Iso,
  /** How often to poll /pair/token. */
  intervalMs: z.int().positive(),
  /** Where a browser can approve (the web viewer's pairing page). */
  verificationPath: z.string(),
})
export type PairStart = z.infer<typeof PairStart>

export const PairApproveBody = z.object({ userCode: z.string().trim().min(1).max(20) })
export const PairApprove = z.object({ approved: z.literal(true), deviceId: z.string(), name: z.string() })
export type PairApprove = z.infer<typeof PairApprove>

export const PairTokenBody = z.object({ deviceCode: z.string().min(1).max(200) })
export const PairToken = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }),
  z.object({ status: z.literal('approved'), token: z.string(), deviceId: z.string() }),
])
export type PairToken = z.infer<typeof PairToken>

/** Format of a user code: two groups of four unambiguous consonants, e.g. `BDFG-HJKL`. */
export const USER_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ'
export const normalizeUserCode = (s: string): string => s.toUpperCase().replace(/[^A-Z]/g, '')

// ----------------------------------------------------------------------------------------- audio

/** 5 s of 16 kHz s16le mono: small enough for any function body limit, big enough to be cheap. */
export const AUDIO_CHUNK_BYTES = 160_000

export const AudioChunkBody = z.object({
  track: TrackKind,
  sampleRate: z.int().positive(),
  format: z.literal('s16le'),
  /** Raw PCM, base64. */
  data: z.base64(),
  /** Lower-case hex SHA-256 of the decoded bytes: a replay must be byte-identical to count as one. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
})
export type AudioChunkBody = z.infer<typeof AudioChunkBody>

export const AudioChunkResult = z.object({
  chunkSeq: z.int().nonnegative(),
  /** false: this exact chunk had already arrived (an idempotent retry). */
  stored: z.boolean(),
  bytes: z.int().nonnegative(),
})
export type AudioChunkResult = z.infer<typeof AudioChunkResult>

export const AudioChunkInfo = z.object({
  chunkSeq: z.int().nonnegative(),
  track: TrackKind,
  bytes: z.int().nonnegative(),
  sha256: z.string(),
})
export type AudioChunkInfo = z.infer<typeof AudioChunkInfo>

export const AudioStatus = z.object({
  sessionId: z.string(),
  chunks: z.array(AudioChunkInfo),
})
export type AudioStatus = z.infer<typeof AudioStatus>

export const FinalizeAudioBody = z.object({
  /** How many chunks of each track the agent sent; the server refuses to finalize with any missing. */
  chunks: z.object({ mic: z.int().nonnegative(), system: z.int().nonnegative() }),
  durationMs: z.int().nonnegative(),
})
export type FinalizeAudioBody = z.infer<typeof FinalizeAudioBody>

/**
 * Chunk numbering is deterministic, so an agent that restarted can recompute it from its local WAVs:
 * the k-th AUDIO_CHUNK_BYTES of a track's PCM is chunk `2k` (mic) or `2k + 1` (system).
 */
export const chunkSeqFor = (track: TrackKind, index: number): number => index * 2 + (track === 'mic' ? 0 : 1)
export const chunkIndexOf = (chunkSeq: number): { track: TrackKind; index: number } => ({
  track: chunkSeq % 2 === 0 ? 'mic' : 'system',
  index: Math.floor(chunkSeq / 2),
})
