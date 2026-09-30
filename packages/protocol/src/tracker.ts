import { z } from 'zod'
import { Iso } from './schemas.ts'

// Agendas wave 2 — the live tracker's status. What it DOES is ordinary agenda events (agenda.item.status
// by `tracker`, agenda.suggestion.upserted, agenda.context.upserted, agenda.item.upserted for recap
// outcomes); this is only how it is doing: which decision provider answers, whether it had to fall back
// to the on-device one, how many rounds / calls / dropped triggers, and the recap's state. Ephemeral
// (`agenda.tracker` on /events) plus a read route for a window that opens mid-meeting.

export const TrackerState = z.enum([
  /** Following the recording with the selected decisions provider. */
  'running',
  /** The selected provider failed (quota, auth, network, …): the on-device provider answers for now. */
  'degraded',
  /** The recording stopped. */
  'stopped',
])
export type TrackerState = z.infer<typeof TrackerState>

export const RecapState = z.enum([
  /** Not started (the recording is still going). */
  'pending',
  'running',
  'done',
  /** No text LLM configured, or it cannot run (no key): outcomes stay as the tracker left them. */
  'unavailable',
  /** The LLM failed or refused on every item. */
  'failed',
])
export type RecapState = z.infer<typeof RecapState>

export const TrackerStatus = z.object({
  sessionId: z.string(),
  agendaId: z.string(),
  state: TrackerState,
  /** The decisions provider the settings select (`jev`, `openai`, `anthropic`, `ollama`, `local`). */
  selected: z.string(),
  /** The provider that answered the last round (`local` while degraded). */
  provider: z.string(),
  model: z.string(),
  /** Why it is degraded, or null. */
  detail: z.string().nullable(),
  /** Segments seen / waved through by the relevance pre-check / status rounds run. */
  segments: z.int().nonnegative(),
  relevant: z.int().nonnegative(),
  rounds: z.int().nonnegative(),
  decisionCalls: z.int().nonnegative(),
  /** Triggers dropped because the queue was full (oldest first); the next round still reads their text. */
  dropped: z.int().nonnegative(),
  errors: z.int().nonnegative(),
  /** Sum of the decision calls' cost; null when a provider has no price. */
  costUsd: z.number().nonnegative().nullable(),
  lastRoundAt: Iso.nullable(),
  recap: z.object({
    state: RecapState,
    detail: z.string().nullable(),
    /** Items whose outcome the recap wrote. */
    items: z.int().nonnegative(),
  }),
})
export type TrackerStatus = z.infer<typeof TrackerStatus>

/** Appended to EphemeralEventData. */
export const TrackerEphemeralEvents = [
  z.object({ type: z.literal('agenda.tracker'), status: TrackerStatus }),
] as const

export const trackerRoutes = {
  /** The tracker's status for an agenda's recording (the latest one), or null when it never ran. */
  getAgendaTracker: {
    method: 'GET',
    path: '/agendas/:id/tracker',
    response: z.object({ tracker: TrackerStatus.nullable() }),
  },
} as const
