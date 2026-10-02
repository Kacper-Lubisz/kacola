import { formatOffset, type SearchHit, type Session } from '@gnomeola/protocol'
import { displayTitle } from '@gnomeola/ui-core/format'
import { _ } from '@gnomeola/ui-core/i18n'
import { speakerName } from '../transcript/rows.ts'
import { dayLabel } from './day.ts'

// Home's search (unit-tested in test/day.test.ts): what was typed, matched against meeting titles here
// and against every transcript by the daemon's full-text search, as one list of *moments* — meeting ·
// day · time · speaker · the line — each of which opens the meeting at that line.

export type SnippetPart = { text: string; mark: boolean }

/**
 * The daemon marks matches `[like this]`; split them out so the screen can highlight them. Marks
 * separated only by spaces ("[retry] [budget]") read as one.
 */
export function snippetParts(snippet: string): SnippetPart[] {
  return mergeMarks(rawParts(snippet))
}

function mergeMarks(parts: SnippetPart[]): SnippetPart[] {
  const out: SnippetPart[] = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!
    const prev = out.at(-1)
    const next = parts[i + 1]
    if (!p.mark && /^\s+$/.test(p.text) && prev?.mark && next?.mark) {
      prev.text += p.text + next.text
      i++
      continue
    }
    out.push({ ...p })
  }
  return out
}

function rawParts(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = []
  const re = /\[([^\]]*)\]/g
  let last = 0
  for (let m = re.exec(snippet); m; m = re.exec(snippet)) {
    if (m.index > last) parts.push({ text: snippet.slice(last, m.index), mark: false })
    if (m[1]) parts.push({ text: m[1], mark: true })
    last = m.index + m[0].length
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), mark: false })
  return parts
}

/** Mark `query` (case-insensitively) inside a plain string, the way the daemon marks its snippets. */
export function markText(text: string, query: string): SnippetPart[] {
  const q = query.trim().toLowerCase()
  const i = q ? text.toLowerCase().indexOf(q) : -1
  if (i === -1) return [{ text, mark: false }]
  return [
    ...(i > 0 ? [{ text: text.slice(0, i), mark: false }] : []),
    { text: text.slice(i, i + q.length), mark: true },
    ...(i + q.length < text.length ? [{ text: text.slice(i + q.length), mark: false }] : []),
  ]
}

export type Moment = {
  key: string
  sessionId: string
  title: string
  /** "Today", "Yesterday", "Tuesday", "3 March". */
  day: string
  /** Where in the meeting ("4:12"), for a transcript line. */
  at: string | null
  speaker: string | null
  parts: SnippetPart[]
  /** Open the meeting here. */
  segmentId: string | null
  startMs: number | null
  private: boolean
}

export function toMoments(
  query: string,
  sessions: readonly Session[],
  hits: readonly SearchHit[],
  now: number,
): Moment[] {
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const when = (s: Session | undefined) => (s ? dayLabel(Date.parse(s.startedAt ?? s.createdAt), now) : '')
  const q = query.trim().toLowerCase()
  const titled: Moment[] = q
    ? sessions
        .filter((s) => displayTitle(s).toLowerCase().includes(q))
        .map((s) => ({
          key: `t:${s.id}`,
          sessionId: s.id,
          title: displayTitle(s),
          day: when(s),
          at: null,
          speaker: null,
          parts: markText(displayTitle(s), query),
          segmentId: null,
          startMs: null,
          private: s.private,
        }))
    : []
  const lines: Moment[] = hits.map((h) => {
    const s = byId.get(h.sessionId)
    return {
      key: `h:${h.sessionId}:${h.segmentId}`,
      sessionId: h.sessionId,
      title: s ? displayTitle(s) : h.sessionTitle || _('Untitled session'),
      day: when(s),
      at: formatOffset(h.startMs),
      speaker: speakerName(h.speaker),
      parts: snippetParts(h.snippet),
      segmentId: h.segmentId,
      startMs: h.startMs,
      private: s?.private ?? false,
    }
  })
  return [...titled, ...lines]
}

/** Does the query read as a question (so Enter asks instead of only searching)? */
export const looksLikeQuestion = (q: string): boolean =>
  /\?\s*$/.test(q) ||
  /^(what|who|when|where|why|how|did|do|does|is|are|was|were|which|can|could|should|will|would)\b/i.test(
    q.trim(),
  )

const STOP = new Set(
  (
    'a an and are as at be but by did do does for from had has have how i in is it its me my of on or our ' +
    'should so that the their them they this to was we were what when where which who whom why will with ' +
    'would you your about can could decide decided say said tell told'
  ).split(' '),
)

/**
 * What to search for: a question's content words ("what did we decide about the retry budget?" →
 * "retry budget"); anything else as typed.
 */
export function searchTerms(q: string): string {
  const t = q.trim()
  if (!looksLikeQuestion(t)) return t
  const words = t
    .replace(/[?!.,;:"“”'‘’()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()))
  return words.join(' ') || t
}
