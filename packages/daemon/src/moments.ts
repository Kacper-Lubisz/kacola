import type { Moment, SearchMomentsResult, Session } from '@kacola/protocol'
import { capSnippet, NoteStore, type Store } from '@kacola/store'

// GET /search/moments — the window's home search: titles, notes and transcripts as moments (meeting ·
// date · speaker · line). Transcript lines come from the store's FTS5 index (the CLI's `/search`, bm25);
// titles and notes are matched here with the same query language and tokenising (letters and digits,
// case- and diacritic-folded; "a phrase"; word* as a prefix), because they are short and few — a laptop's
// meeting list, not a corpus. Titles rank first, then notes, then transcript lines.

/** How many meetings' titles and notes are scanned (newest first). */
export const MAX_SCANNED_SESSIONS = 2_000

const TOKEN = /[\p{L}\p{N}]+/gu
const fold = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()

type Part = { tokens: string[]; prefix: boolean }

/** The query as FTS5 sees it (store/fts.ts toFtsQuery): phrases and words, all required. */
export function queryParts(q: string): Part[] {
  const parts: Part[] = []
  for (const m of q.matchAll(/"([^"]*)"?|(\S+)/g)) {
    if (m[1] !== undefined) {
      const toks = m[1].match(TOKEN)
      if (toks?.length) parts.push({ tokens: toks.map(fold), prefix: false })
      continue
    }
    const word = m[2]!
    const toks = word.match(TOKEN)
    if (!toks?.length) continue
    const prefix = word.endsWith('*')
    toks.forEach((t, i) => {
      parts.push({ tokens: [fold(t)], prefix: prefix && i === toks.length - 1 })
    })
  }
  return parts
}

/** Where every part matches in `text` (character ranges), or null when one does not. */
export function matchText(text: string, parts: readonly Part[]): [number, number][] | null {
  if (!parts.length) return null
  const toks = [...text.matchAll(TOKEN)].map((m) => ({
    t: fold(m[0]),
    start: m.index,
    end: m.index + m[0].length,
  }))
  const ranges: [number, number][] = []
  for (const p of parts) {
    const n = p.tokens.length
    let found = -1
    for (let i = 0; i + n <= toks.length && found < 0; i++) {
      let ok = true
      for (let j = 0; j < n && ok; j++) {
        const want = p.tokens[j]!
        const have = toks[i + j]!.t
        ok = p.prefix && j === n - 1 ? have.startsWith(want) : have === want
      }
      if (ok) found = i
    }
    if (found < 0) return null
    ranges.push([toks[found]!.start, toks[found + n - 1]!.end])
  }
  return ranges
}

/** `text` with the ranges marked [like this], windowed around the first match and capped. */
export function markSnippet(text: string, ranges: [number, number][], window = 90): string {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of sorted) {
    const last = merged.at(-1)
    // adjacent words read as one mark: "[retry budget]", not "[retry] [budget]"
    if (last && (r[0] <= last[1] || !text.slice(last[1], r[0]).trim())) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  const from = Math.max(0, merged[0]![0] - window)
  let out = ''
  let at = from
  for (const [a, b] of merged) {
    if (a < from) continue
    out += `${text.slice(at, a)}[${text.slice(a, b)}]`
    at = b
  }
  out += text.slice(at)
  return capSnippet(`${from > 0 ? '…' : ''}${out.trim()}`)
}

/** A notes line without its markdown furniture (headings, bullets, checkboxes, quotes). */
const plainLine = (line: string) =>
  line
    .replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')
    .replace(/\*\*|__|`/g, '')
    .trim()

const dateOf = (s: Session) => s.startedAt ?? s.createdAt

export function searchMoments(
  store: Store,
  o: { q: string; since?: Date; limit: number; includePrivate?: boolean },
): SearchMomentsResult {
  const parts = queryParts(o.q)
  if (!parts.length) return { moments: [], total: 0 }
  const includePrivate = o.includePrivate ?? false
  const sessions = store.listSessions({ since: o.since, includePrivate, limit: MAX_SCANNED_SESSIONS })
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const notes = new NoteStore(store)
  const base = (s: Session) => ({
    sessionId: s.id,
    sessionTitle: s.title,
    date: dateOf(s),
    private: s.private,
  })

  const found: Moment[] = []
  for (const s of sessions) {
    const t = matchText(s.title, parts)
    if (t)
      found.push({
        kind: 'title',
        ...base(s),
        speaker: null,
        segmentId: null,
        startMs: null,
        endMs: null,
        snippet: markSnippet(s.title, t),
        score: 3000,
      })
    const md = notes.get(s.id).markdown
    if (!md.trim()) continue
    for (const raw of md.split('\n')) {
      const line = plainLine(raw)
      if (!line) continue
      const r = matchText(line, parts)
      if (!r) continue
      found.push({
        kind: 'notes',
        ...base(s),
        speaker: null,
        segmentId: null,
        startMs: null,
        endMs: null,
        snippet: markSnippet(line, r),
        // shorter lines that are mostly the match rank higher
        score: 2000 + Math.min(999, Math.round((1000 * o.q.length) / Math.max(line.length, o.q.length))),
      })
    }
  }

  // transcript lines: the FTS5 index (bm25), with the same since / private filter
  const titlesAndNotes = found.length
  const fts = store.search({ q: o.q, since: o.since, includePrivate, limit: Math.min(500, o.limit * 5) })
  for (const h of fts.hits) {
    const s = byId.get(h.sessionId) ?? store.getSession(h.sessionId)
    if (!s) continue
    found.push({
      kind: 'transcript',
      ...base(s),
      speaker: h.speaker,
      segmentId: h.segmentId,
      startMs: h.startMs,
      endMs: h.endMs,
      snippet: h.snippet,
      score: Math.min(1999, Math.max(0, h.score * 100)),
    })
  }

  found.sort(
    (a, b) =>
      b.score - a.score ||
      b.date.localeCompare(a.date) ||
      (a.startMs ?? 0) - (b.startMs ?? 0) ||
      a.sessionId.localeCompare(b.sessionId),
  )
  return { moments: found.slice(0, o.limit), total: titlesAndNotes + fts.total }
}
