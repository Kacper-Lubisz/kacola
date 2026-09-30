import { z } from 'zod'
import { AgendaEphemeralEvents, AgendaEvents } from './agendas.ts'
import { CalendarStatus, Meeting } from './calendar.ts'
import { NoteTemplate, NoteVersion } from './notes.ts'
import { Iso, ModelInfo, QaMessage, Segment, Session, StoredSettings, TrackKind } from './schemas.ts'
import { SpeakerEvents } from './speakers.ts'

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
  // ---- M7: notes + enhancement
  /** A notes version was appended (autosave, enhancement, merge or restore). Versions are never changed. */
  z.object({ type: z.literal('note.version'), version: NoteVersion }),
  /** A custom notes template was created or changed. */
  z.object({ type: z.literal('template.upserted'), template: NoteTemplate }),
  z.object({ type: z.literal('template.deleted'), id: z.string() }),
  // ---- M3: attribution (speakers, attributions, voiceprints)
  ...SpeakerEvents,
  // ---- kacola phases 1–2: agendas (schemas in ./agendas.ts)
  ...AgendaEvents,
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
  // ---- M4: calendar
  /** The meetings changed (or the provider's state did): refetch /meetings. */
  z.object({ type: z.literal('calendar.updated'), calendar: CalendarStatus }),
  /** A timed meeting is about to start (sent once per occurrence, shortly before its start). */
  z.object({ type: z.literal('meeting.starting'), meeting: Meeting }),
  // ---- kacola phases 1–2: agent presence on the live channel (./agendas.ts)
  ...AgendaEphemeralEvents,
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
