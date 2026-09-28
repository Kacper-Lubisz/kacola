import { z } from 'zod'
import { Iso, ModelInfo, QaMessage, Segment, Session, StoredSettings, TrackKind } from './schemas.ts'

// Events come in two kinds, and the distinction is load-bearing:
//
//   durable   — persisted to the event log with a gap-free, strictly increasing `seq`. Replaying the
//               log from seq 0 reproduces the store exactly. Carried on SSE with an `id:` line, so a
//               reconnecting client resumes from its cursor with zero gaps and zero duplicates.
//   ephemeral — high-frequency, lossy by design (audio levels, in-progress partials, answer tokens).
//               Never persisted, never replayed, carry no seq.

export const DurableEventData = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session.upserted'), session: Session }),
  z.object({ type: z.literal('segment.upserted'), segment: Segment }),
  z.object({ type: z.literal('qa.message'), message: QaMessage }),
  /** The session and everything hanging off it (tracks, segments, Q&A) is gone. */
  z.object({ type: z.literal('session.deleted'), sessionId: z.string() }),
  /** Persisted settings changed. Never carries secrets (the API key lives in the keyring, not here). */
  z.object({ type: z.literal('settings.updated'), settings: StoredSettings }),
])
export type DurableEventData = z.infer<typeof DurableEventData>

export const DurableEvent = z.object({
  seq: z.int().positive(),
  at: Iso,
  sessionId: z.string().nullable(),
  data: DurableEventData,
})
export type DurableEvent = z.infer<typeof DurableEvent>

export const EphemeralEventData = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('audio.level'),
    track: TrackKind,
    /** 0..1, linear. */
    rms: z.number().min(0).max(1),
    peak: z.number().min(0).max(1),
    elapsedMs: z.int().nonnegative(),
  }),
  z.object({
    type: z.literal('transcript.partial'),
    track: TrackKind,
    speaker: z.string(),
    startMs: z.int().nonnegative(),
    text: z.string(),
  }),
  z.object({ type: z.literal('qa.delta'), requestId: z.string(), text: z.string() }),
  z.object({ type: z.literal('model.progress'), model: ModelInfo }),
  z.object({ type: z.literal('heartbeat'), lastSeq: z.int().nonnegative() }),
])
export type EphemeralEventData = z.infer<typeof EphemeralEventData>

export const EphemeralEvent = z.object({
  seq: z.null(),
  at: Iso,
  sessionId: z.string().nullable(),
  data: EphemeralEventData,
})
export type EphemeralEvent = z.infer<typeof EphemeralEvent>

export const AnyEvent = z.union([DurableEvent, EphemeralEvent])
export type AnyEvent = DurableEvent | EphemeralEvent

export const isDurable = (e: AnyEvent): e is DurableEvent => e.seq !== null
