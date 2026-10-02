import { z } from 'zod'
import { Iso } from './schemas.ts'

// Full-text search as the window's home box needs it: *moments* over titles, notes and transcripts —
// meeting · date · speaker · line — each opening at its segment. The CLI's `/search` (transcripts only,
// private hidden unless asked) stays as it is; this is the same FTS5 index plus the titles and notes.
//
// Search is local, so a caller that shows private meetings (the window) passes includePrivate and gets
// them, each moment flagged `private`. The CLI and the skill never pass it.

export const MomentKind = z.enum(['title', 'notes', 'transcript'])
export type MomentKind = z.infer<typeof MomentKind>

export const Moment = z.object({
  kind: MomentKind,
  sessionId: z.string(),
  sessionTitle: z.string(),
  /** When the meeting happened: its start, or when it was created if it never started. */
  date: Iso,
  /** The meeting is private (only returned with includePrivate). */
  private: z.boolean(),
  /** Transcript moments: who said it. Null for titles and notes. */
  speaker: z.string().nullable(),
  /** Transcript moments: the segment to open at. Null for titles and notes. */
  segmentId: z.string().nullable(),
  startMs: z.int().nonnegative().nullable(),
  endMs: z.int().nonnegative().nullable(),
  /** The matching line with the match marked [like this]; capped in length. */
  snippet: z.string(),
  /** Higher is better. Titles rank above notes, notes above transcript lines of equal relevance. */
  score: z.number(),
})
export type Moment = z.infer<typeof Moment>

const flag = z.union([z.boolean(), z.stringbool()]).optional()

export const SearchMomentsQuery = z.object({
  /** Words (all must match), "a quoted phrase", word* for a prefix. */
  q: z.string().min(1).max(500),
  /** Only meetings since (ISO or a duration like `30d`). */
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(30),
  includePrivate: flag,
})

export const SearchMomentsResult = z.object({
  moments: z.array(Moment),
  /** Every match, before the limit. */
  total: z.int().nonnegative(),
})
export type SearchMomentsResult = z.infer<typeof SearchMomentsResult>

export const searchRoutes = {
  /** Moments over titles, notes and transcripts, best first (the home search box). */
  searchMoments: {
    method: 'GET',
    path: '/search/moments',
    query: SearchMomentsQuery,
    response: SearchMomentsResult,
  },
} as const
