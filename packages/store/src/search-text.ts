import { capSnippet, SNIPPET_TOKENS } from './fts.ts'

// The FTS5 → Postgres full-text mapping. The SQLite build gets tokenising, diacritic folding, bm25 and
// snippets from FTS5 (`unicode61 remove_diacritics 2`). Postgres has different parsers ('simple' still
// splits on hyphens and recognises URLs, e-mails, versions…) and no unaccent without an extension, so
// the Postgres build does the language-sensitive part here, in one place, identically on every server:
//
//   index    segments.search_text = the normalised token stream (NFKD, marks stripped, lower-cased,
//            split exactly like FTS5's unicode61 — runs of letters/digits). to_tsvector('simple', …)
//            over a string that is already just `tok tok tok` yields exactly those tokens.
//   query    the SAME two affordances as toFtsQuery: "quoted phrase" (tsquery <->) and word* (:*),
//            everything else a quoted literal, ANDed. Raw input never reaches to_tsquery.
//   snippet  computed here from the original text (FTS5-style: the best window of SNIPPET_TOKENS
//            tokens, matches in [brackets], … where cut), so both dialects mark the same words.
//
// Ranking differs by construction (bm25 vs ts_rank with length normalisation); both rank a dense short
// match above a passing mention, which is the property the contract suite pins.

const TOKEN = /[\p{L}\p{N}]+/gu

export const fold = (s: string): string => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()

/** The normalised token stream stored in segments.search_text. */
export function searchText(text: string): string {
  return (fold(text).match(TOKEN) ?? []).join(' ')
}

export type QueryTerm = { token: string; prefix: boolean }
/** An AND of groups; a group of more than one term is a phrase. */
export type ParsedQuery = QueryTerm[][]

export function parseQuery(input: string): ParsedQuery {
  const groups: ParsedQuery = []
  for (const m of input.matchAll(/"([^"]*)"?|(\S+)/g)) {
    if (m[1] !== undefined) {
      const toks = fold(m[1]).match(TOKEN)
      if (toks?.length) groups.push(toks.map((token) => ({ token, prefix: false })))
      continue
    }
    const word = m[2]!
    const toks = fold(word).match(TOKEN)
    if (!toks?.length) continue
    const prefix = word.endsWith('*')
    toks.forEach((token, i) => {
      groups.push([{ token, prefix: prefix && i === toks.length - 1 }])
    })
  }
  return groups
}

/** A to_tsquery('simple', …) string. Tokens are pure letters/digits, quoted anyway. null = no terms. */
export function toTsQuery(input: string): string | null {
  const groups = parseQuery(input)
  if (!groups.length) return null
  const lit = (t: QueryTerm) => `'${t.token.replace(/'/g, "''")}'${t.prefix ? ':*' : ''}`
  return groups.map((g) => (g.length === 1 ? lit(g[0]!) : `(${g.map(lit).join(' <-> ')})`)).join(' & ')
}

/**
 * FTS5-like snippet: the window of SNIPPET_TOKENS tokens containing the most matched tokens (earliest
 * wins ties), matched tokens wrapped in [ ], an ellipsis where the text was cut, then the same hard
 * character cap the SQLite build applies.
 */
export function snippet(text: string, query: ParsedQuery, tokens = SNIPPET_TOKENS): string {
  const terms = query.flat()
  const spans = [...text.matchAll(TOKEN)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    t: fold(m[0]),
  }))
  if (!spans.length) return capSnippet(text)
  const hit = spans.map((s) => terms.some((q) => (q.prefix ? s.t.startsWith(q.token) : s.t === q.token)))
  const n = Math.min(tokens, spans.length)
  let best = 0
  let bestScore = -1
  let score = hit.slice(0, n).filter(Boolean).length
  for (let i = 0; i + n <= spans.length; i++) {
    if (i > 0) score += (hit[i + n - 1] ? 1 : 0) - (hit[i - 1] ? 1 : 0)
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  let out = ''
  const from = spans[best]!.start
  const last = best + n - 1
  let at = from
  for (let i = best; i <= last; i++) {
    const s = spans[i]!
    out += text.slice(at, s.start)
    out += hit[i] ? `[${text.slice(s.start, s.end)}]` : text.slice(s.start, s.end)
    at = s.end
  }
  const head = best > 0 ? '…' : ''
  const tail = last < spans.length - 1 ? '…' : text.slice(at)
  return capSnippet(`${head}${out}${tail}`)
}
