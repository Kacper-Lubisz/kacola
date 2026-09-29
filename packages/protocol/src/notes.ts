import { z } from 'zod'
import { ApiError, Citation, Iso, Usage } from './schemas.ts'
import type { SseMessage } from './sse.ts'

export * from './notes-actions.ts'
export * from './notes-diff.ts'

// M7 — meeting notes and their enhancement.
//
// The rule every shape here serves: the user's own words are never lost or silently rewritten. Notes
// are an append-only list of versions per session. Every autosave, every enhancement, every merge and
// every restore appends a version; nothing is ever updated in place or deleted (except with the whole
// session). The "head" is the newest version the user has adopted — an enhancement is a proposal that
// sits beside the head until the user reviews it block by block (see notes-diff.ts) and merges it.

/** Size cap on one version's markdown: generous for notes, small enough that nobody pastes a transcript. */
export const MAX_NOTE_CHARS = 200_000

export const NoteVersionKind = z.enum([
  /** Typed by the user (every autosave). */
  'user',
  /** Written by the LLM from the user's notes + transcript + a template. Never becomes the head by itself. */
  'enhanced',
  /** The result of a block-by-block review of an enhanced version against the head. */
  'merge',
  /** An older version brought back as the head. */
  'restore',
])
export type NoteVersionKind = z.infer<typeof NoteVersionKind>

export const Enhancement = z.object({
  templateId: z.string(),
  model: z.string().nullable(),
  usage: Usage.nullable(),
  stopReason: z.string().nullable(),
  /** `[n]` markers in the markdown index this list (1-based), as in Q&A answers. */
  citations: z.array(Citation),
})
export type Enhancement = z.infer<typeof Enhancement>

/** Per diff hunk (see notes-diff.ts): take the enhanced side, or keep the user's own. */
export const MergeChoice = z.enum(['enhanced', 'mine'])
export type MergeChoice = z.infer<typeof MergeChoice>

export const NoteVersion = z.object({
  sessionId: z.string(),
  /** 1, 2, 3… per session, across every kind. */
  version: z.int().positive(),
  kind: NoteVersionKind,
  markdown: z.string().max(MAX_NOTE_CHARS),
  /** The head this version was derived from (0 = there were no notes yet). */
  baseVersion: z.int().nonnegative(),
  createdAt: Iso,
  /** Set on `enhanced` versions. */
  enhancement: Enhancement.nullable(),
  /** Set on `merge` versions: which enhanced version was reviewed, and the choice made for each hunk. */
  merge: z.object({ enhancedVersion: z.int().positive(), choices: z.array(MergeChoice) }).nullable(),
  /** Set on `restore` versions. */
  restoredFrom: z.int().positive().nullable(),
})
export type NoteVersion = z.infer<typeof NoteVersion>

/** A session's notes as the editor sees them: the head, plus an enhancement waiting for review. */
export const Note = z.object({
  sessionId: z.string(),
  /** The head's version number; 0 when nothing has been written yet (then `markdown` is ''). */
  version: z.int().nonnegative(),
  markdown: z.string(),
  updatedAt: Iso.nullable(),
  /** Newest enhanced version not yet merged or dismissed; null when there is nothing to review. */
  pendingEnhancement: z.int().positive().nullable(),
})
export type Note = z.infer<typeof Note>

export const NotesState = z.object({
  note: Note,
  /** The pending enhanced version itself, so a client can show the review without a second call. */
  enhanced: NoteVersion.nullable(),
})
export type NotesState = z.infer<typeof NotesState>

// ------------------------------------------------------------------ templates

export const TEMPLATE_ID = /^[a-z0-9][a-z0-9-]{0,47}$/

export const NoteTemplate = z.object({
  id: z.string().regex(TEMPLATE_ID),
  name: z.string().min(1).max(80),
  /** Built-in templates ship with the daemon and cannot be changed; custom ones are the user's. */
  builtIn: z.boolean(),
  /** Words or phrases that, found in a meeting's title (or its calendar event's), pick this template. */
  keywords: z.array(z.string().min(1).max(60)).max(20),
  /** Markdown skeleton + guidance the model follows when structuring the notes. */
  body: z.string().min(1).max(8000),
})
export type NoteTemplate = z.infer<typeof NoteTemplate>

export const TemplateBody = NoteTemplate.pick({ name: true, keywords: true, body: true })

export const TemplateSuggestion = z.object({
  templateId: z.string(),
  /** Why: `keyword` (which word matched which title) or `default`. */
  reason: z.enum(['keyword', 'default']),
  matched: z.object({ keyword: z.string(), source: z.enum(['session', 'calendar']) }).nullable(),
})
export type TemplateSuggestion = z.infer<typeof TemplateSuggestion>

// ---------------------------------------------------------------- action items

export const ActionItem = z.object({
  text: z.string(),
  /** Who, where the notes say so (`me` for the user). */
  owner: z.string().nullable(),
  /** When, verbatim as stated ("Thursday", "2026-10-01", "end of week"). */
  due: z.string().nullable(),
  done: z.boolean(),
})
export type ActionItem = z.infer<typeof ActionItem>

// --------------------------------------------------------------- route bodies

const includePrivate = z.union([z.boolean(), z.stringbool()]).optional()

export const PutNotesBody = z.object({
  markdown: z.string().max(MAX_NOTE_CHARS),
  /** The head the edit was made on. A different current head is a 409: re-read, then decide. */
  baseVersion: z.int().nonnegative(),
})
export const EnhanceNotesBody = z.object({
  /** Omit to use the template suggested for this meeting. */
  templateId: z.string().optional(),
  /** Title of the calendar event this meeting belongs to, when a client knows it (template choice). */
  calendarTitle: z.string().max(300).optional(),
  includePrivate: z.boolean().optional(),
})
export const MergeNotesBody = z.object({
  enhancedVersion: z.int().positive(),
  baseVersion: z.int().nonnegative(),
  /** One per hunk of diffNoteBlocks(head, enhanced), in order; `same` hunks are ignored. */
  choices: z.array(MergeChoice).max(10_000),
})
export const RestoreNoteBody = z.object({ baseVersion: z.int().nonnegative() })
export const NotesQuery = z.object({ includePrivate })
export const ActionItemsQuery = z.object({
  includePrivate,
  /** A specific version; default the head. */
  version: z.coerce.number().int().positive().optional(),
})
export const TemplatesQuery = z.object({
  sessionId: z.string().optional(),
  calendarTitle: z.string().max(300).optional(),
  includePrivate,
})

/** Messages on the enhance stream, in order: started, delta*, then (done | error). */
export const EnhanceStreamEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('started'), templateId: z.string(), baseVersion: z.int().nonnegative() }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('done'), version: NoteVersion }),
  z.object({ type: z.literal('error'), error: ApiError.shape.error }),
])
export type EnhanceStreamEvent = z.infer<typeof EnhanceStreamEvent>

/** Decode the enhance route's SSE messages (from `client.stream('enhanceNotes', …)`). */
export async function* enhanceEvents(
  messages: AsyncIterable<SseMessage>,
): AsyncGenerator<EnhanceStreamEvent> {
  for await (const msg of messages) {
    if (!msg.data) continue
    yield EnhanceStreamEvent.parse(JSON.parse(msg.data))
  }
}

export const notesRoutes = {
  getNotes: { method: 'GET', path: '/sessions/:id/notes', query: NotesQuery, response: NotesState },
  putNotes: { method: 'PUT', path: '/sessions/:id/notes', body: PutNotesBody, response: Note },
  listNoteVersions: {
    method: 'GET',
    path: '/sessions/:id/notes/versions',
    query: NotesQuery,
    response: z.object({ versions: z.array(NoteVersion) }),
  },
  enhanceNotes: {
    method: 'POST',
    path: '/sessions/:id/notes/enhance',
    body: EnhanceNotesBody,
    response: 'sse',
  },
  mergeNotes: { method: 'POST', path: '/sessions/:id/notes/merge', body: MergeNotesBody, response: Note },
  restoreNoteVersion: {
    method: 'POST',
    path: '/sessions/:id/notes/versions/:version/restore',
    body: RestoreNoteBody,
    response: Note,
  },
  getActionItems: {
    method: 'GET',
    path: '/sessions/:id/notes/action-items',
    query: ActionItemsQuery,
    response: z.object({ version: z.int().nonnegative(), items: z.array(ActionItem) }),
  },
  listTemplates: {
    method: 'GET',
    path: '/templates',
    query: TemplatesQuery,
    response: z.object({ templates: z.array(NoteTemplate), suggested: TemplateSuggestion }),
  },
  putTemplate: { method: 'PUT', path: '/templates/:id', body: TemplateBody, response: NoteTemplate },
  deleteTemplate: {
    method: 'DELETE',
    path: '/templates/:id',
    response: z.object({ deleted: z.literal(true) }),
  },
} as const
