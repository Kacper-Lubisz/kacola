import { z } from 'zod'

// Ground truth for fixture meetings that carry an agenda (fixtures/agenda/<id>/truth.json `agenda`).
// Agenda items are plain data here on purpose: the eval layer must not depend on the protocol's agenda
// model, so the tracker can change shape without the datasets moving.

export const ItemKind = z.enum(['topic', 'question', 'must-cover', 'decision', 'info-to-get', 'competency'])
export type ItemKind = z.infer<typeof ItemKind>

export const AgendaItemInput = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: ItemKind,
  /** `me`, `them`, or a person's name. */
  owner: z.string().optional(),
  timeboxMin: z.number().positive().optional(),
})
export type AgendaItemInput = z.infer<typeof AgendaItemInput>

export const ItemStatus = z.enum(['not_started', 'in_progress', 'covered'])
export type ItemStatus = z.infer<typeof ItemStatus>

export const AgendaItemTruth = AgendaItemInput.extend({
  expected: z.object({
    /** Status at the end of the meeting. */
    status: ItemStatus,
    /** Session ms at which the item was settled (end of the settling utterance); null if never settled. */
    settledAtMs: z.int().nonnegative().nullable(),
    /** Session ms at which the item was first raised (start of the first utterance about it). */
    startedAtMs: z.int().nonnegative().nullable(),
    /** Utterance indices (into truth.utterances) that are evidence for this item. */
    evidence: z.array(z.int().nonnegative()),
    /** The utterance index that settled it, or null. */
    settledBy: z.int().nonnegative().nullable(),
    /** What was agreed / concluded, in plain words; null when nothing was. */
    outcome: z.string().nullable(),
    /** For info-to-get items: the answer heard (short, canonical form), or null when not answered. */
    answer: z.string().nullable(),
    /** Other acceptable spellings of the answer (fuzzy match also applies). */
    answerAliases: z.array(z.string()),
    /** Settled without anyone saying "done"/"agreed" (tests implicit settlement). */
    implicit: z.boolean(),
  }),
})
export type AgendaItemTruth = z.infer<typeof AgendaItemTruth>

export const AgendaTruth = z.object({
  meeting: z.object({
    kind: z.enum(['one-on-one', 'interview', 'standup', 'planning']),
    /** The user's side, where it matters (interview: candidate or interviewer). */
    userRole: z.string().optional(),
    /** Calendar end on the session timeline (drives time pressure and the T-5 min nudge). */
    scheduledEndMs: z.int().positive(),
  }),
  goals: z.array(z.string()),
  items: z.array(AgendaItemTruth).min(1),
  /** Utterance indices that are off-agenda tangents (relevance pre-check negatives). */
  tangents: z.array(z.int().nonnegative()),
})
export type AgendaTruth = z.infer<typeof AgendaTruth>
