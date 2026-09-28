import { TrackKind } from '@gnomeola/protocol'
import { z } from 'zod'

// Ground truth for a fixture meeting. Times are ms on the session timeline — the same timeline the
// recorder uses, including recorded gaps (audio files are silent across a gap; a feeder skips it).

export const Utterance = z.object({
  track: TrackKind,
  /** A person's name (the mic track's speaker is the user). */
  speaker: z.string(),
  startMs: z.int().nonnegative(),
  endMs: z.int().nonnegative(),
  text: z.string().min(1),
  /** Where the audio came from: TTS voice id, or a LibriSpeech utterance id. */
  source: z.string(),
})
export type Utterance = z.infer<typeof Utterance>

export const Gap = z.object({
  atMs: z.int().nonnegative(),
  durationMs: z.int().positive(),
  reason: z.string(),
  tracks: z.array(TrackKind),
})
export type Gap = z.infer<typeof Gap>

export const Fact = z.object({
  /** Stable key other test suites query by, e.g. `retry-budget`. */
  key: z.string(),
  /** The sentence as spoken. */
  text: z.string(),
  utterance: z.int().nonnegative(),
})

export const GroundTruth = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  sampleRate: z.literal(16000),
  durationMs: z.int().positive(),
  tracks: z.object({ mic: z.string(), system: z.string() }),
  speakers: z.array(z.object({ name: z.string(), track: TrackKind, source: z.string() })),
  utterances: z.array(Utterance),
  gaps: z.array(Gap),
  silences: z.array(z.object({ startMs: z.int().nonnegative(), endMs: z.int().nonnegative() })),
  facts: z.array(Fact),
  /** Indices of utterances that attempt prompt injection (used by agent-surface security tests). */
  injections: z.array(z.int().nonnegative()),
  license: z.string(),
  generator: z.object({ script: z.string(), sherpaOnnx: z.string(), generatedAt: z.string() }),
})
export type GroundTruth = z.infer<typeof GroundTruth>
