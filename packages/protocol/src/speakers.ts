import { z } from 'zod'
import { Iso, ME, THEM, TrackKind } from './schemas.ts'

// M3 — attribution. Who said what.
//
// Track A (the microphone) is the user, by construction: its segments are `me` and carry no speaker id.
// The far-end track is diarized into speakers that belong to one session and keep their id for its
// whole life. A segment's `speaker` stays the display label every existing client already prints and
// filters on ("me", "Speaker 2", "Ana"); `speakerId` says which far-end speaker it is. Renames, merges
// and splits are durable events, so the label on every segment follows them and a replay reproduces
// them exactly.

/** Colours are a palette index; the UI owns the palette. Assigned in creation order, never reused. */
export const SPEAKER_COLOURS = 8

/** Labels a far-end speaker can never take: they would make `--speaker me` lie. */
export const RESERVED_SPEAKER_LABELS: readonly string[] = [ME, THEM]
export const isReservedLabel = (label: string): boolean =>
  RESERVED_SPEAKER_LABELS.includes(label.trim().toLowerCase())

export const SpeakerLabel = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((s) => !isReservedLabel(s), { message: `"me" and "them" are reserved speaker labels` })

export const Speaker = z.object({
  id: z.string(),
  sessionId: z.string(),
  /** Display name: "Speaker 2" until someone (or a voiceprint) names them. */
  label: z.string().min(1),
  /** True once a person named this speaker, or a voiceprint recognised them. */
  named: z.boolean(),
  colour: z.int().nonnegative(),
  /** The cross-session voiceprint this speaker is linked to (A-6), if any. */
  voiceprintId: z.string().nullable(),
  /** Set when merged into another speaker: it has no segments any more and is hidden from listings. */
  mergedInto: z.string().nullable(),
  createdAt: Iso,
})
export type Speaker = z.infer<typeof Speaker>

/** A speaker as it appears in one transcript, with how much they said. `me`/`them` are pseudo-speakers. */
export const SpeakerSummary = z.object({
  /** A speaker id, or `me` (the mic track) / `them` (far-end speech not yet attributed). */
  id: z.string(),
  label: z.string(),
  track: TrackKind,
  named: z.boolean(),
  colour: z.int().nonnegative().nullable(),
  voiceprintId: z.string().nullable(),
  segments: z.int().nonnegative(),
  talkMs: z.int().nonnegative(),
})
export type SpeakerSummary = z.infer<typeof SpeakerSummary>

/**
 * A person's voice, remembered across sessions (A-6). Opt-in, local only: the embedding never leaves the
 * daemon's database and is not part of any wire response.
 */
export const Voiceprint = z.object({
  id: z.string(),
  name: z.string().min(1),
  /** The embedding model that produced it; a print from another model is never compared. */
  model: z.string(),
  embedding: z.array(z.number()),
  /** How many sessions have contributed to the running mean. */
  samples: z.int().positive(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type Voiceprint = z.infer<typeof Voiceprint>

export const VoiceprintSummary = Voiceprint.omit({ embedding: true })
export type VoiceprintSummary = z.infer<typeof VoiceprintSummary>

/** Who changed an attribution. A person's decision is never overridden by the diarizer. */
export const AttributionSource = z.enum(['auto', 'user'])
export type AttributionSource = z.infer<typeof AttributionSource>

// ------------------------------------------------------------------------------------ durable events

export const SpeakerEvents = [
  /** Created, renamed, or linked to a voiceprint. A label change relabels every segment of theirs. */
  z.object({ type: z.literal('speaker.upserted'), speaker: Speaker }),
  /** `fromId` is folded into `intoId`: its segments move, and it stays behind as a tombstone. */
  z.object({
    type: z.literal('speaker.merged'),
    sessionId: z.string(),
    fromId: z.string(),
    intoId: z.string(),
  }),
  /** These far-end segments are now attributed to `speakerId` (online clustering, re-clustering, split). */
  z.object({
    type: z.literal('segments.attributed'),
    sessionId: z.string(),
    speakerId: z.string(),
    segmentIds: z.array(z.string()),
    by: AttributionSource,
  }),
  z.object({ type: z.literal('voiceprint.upserted'), voiceprint: Voiceprint }),
  z.object({ type: z.literal('voiceprint.deleted'), voiceprintId: z.string() }),
] as const

// ------------------------------------------------------------------------------------------- routes

export const RenameSpeakerBody = z.object({ label: SpeakerLabel })
export const MergeSpeakerBody = z.object({ into: z.string().min(1) })
export const SplitSpeakerBody = z.object({ segmentIds: z.array(z.string().min(1)).min(1).max(10_000) })
export const SpeakersResponse = z.object({ speakers: z.array(SpeakerSummary) })
export const VoiceprintsResponse = z.object({ voiceprints: z.array(VoiceprintSummary) })
