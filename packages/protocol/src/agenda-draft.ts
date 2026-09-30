import { z } from 'zod'
import { AgendaItemKind, ItemOwner, ItemText, MAX_TIMEBOX_MIN } from './agendas.ts'
import { ApiError } from './schemas.ts'
import type { SseMessage } from './sse.ts'

// "Plan with Claude" (kacola wave 2): the daemon drafts agenda items from the agenda's goals, what is
// already on it, its context cards and past meetings with the same people, and streams them as
// proposals. The route never writes the agenda: the window adds the items the user accepts with
// addAgendaItems. Nothing durable happens.

export const DraftAgendaBody = z.object({
  /** Default: the agenda's goals. */
  goals: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  /** The user's extra ask ("keep it to 30 min"). */
  instructions: z.string().trim().max(2000).optional(),
  /** Stop after this many items. Default 12. */
  maxItems: z.int().min(1).max(30).optional(),
  includePrivate: z.boolean().optional(),
})
export type DraftAgendaBody = z.input<typeof DraftAgendaBody>

/** One proposed item: the shape NewAgendaItem accepts, without a status. */
export const DraftedItem = z.object({
  text: ItemText,
  kind: AgendaItemKind,
  owner: ItemOwner.nullable(),
  timeboxMin: z.int().min(1).max(MAX_TIMEBOX_MIN).nullable(),
})
export type DraftedItem = z.infer<typeof DraftedItem>

/** Messages on the draft stream, in order: started, item*, then (done | error). */
export const AgendaDraftEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('started'),
    agendaId: z.string(),
    /** What the draft was built from (counts only). */
    basedOn: z.object({
      goals: z.int().nonnegative(),
      pastMeetings: z.int().nonnegative(),
      existingItems: z.int().nonnegative(),
    }),
  }),
  /** One per complete line the model writes that parses as an item. */
  z.object({ type: z.literal('item'), item: DraftedItem }),
  z.object({
    type: z.literal('done'),
    items: z.int().nonnegative(),
    model: z.string(),
    usage: z.object({ inputTokens: z.int().nonnegative(), outputTokens: z.int().nonnegative() }),
  }),
  z.object({ type: z.literal('error'), error: ApiError.shape.error }),
])
export type AgendaDraftEvent = z.infer<typeof AgendaDraftEvent>

/** Decode the draft route's SSE messages (from `client.stream('draftAgenda', …)`). */
export async function* draftEvents(messages: AsyncIterable<SseMessage>): AsyncGenerator<AgendaDraftEvent> {
  for await (const msg of messages) {
    if (!msg.data) continue
    yield AgendaDraftEvent.parse(JSON.parse(msg.data))
  }
}
