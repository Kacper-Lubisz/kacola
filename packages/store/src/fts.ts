// Turning user (or agent) input into a safe FTS5 query. Raw input is never passed to MATCH: FTS5 query
// syntax has operators (NEAR, AND, OR, NOT, column filters, `^`, `*`, parentheses) and a stray one is a
// syntax error at best and a different query at worst. We keep exactly two affordances:
//   "a quoted phrase"  → an FTS5 phrase
//   word*              → a prefix match
// Everything else is split into tokens, each quoted, and ANDed.

const TOKEN = /[\p{L}\p{N}]+/gu

export function toFtsQuery(input: string): string | null {
  const parts: string[] = []
  for (const m of input.matchAll(/"([^"]*)"?|(\S+)/g)) {
    if (m[1] !== undefined) {
      const toks = m[1].match(TOKEN)
      if (toks?.length) parts.push(`"${toks.join(' ')}"`)
      continue
    }
    const word = m[2]!
    const toks = word.match(TOKEN)
    if (!toks?.length) continue
    const prefix = word.endsWith('*')
    toks.forEach((t, i) => {
      parts.push(prefix && i === toks.length - 1 ? `"${t}"*` : `"${t}"`)
    })
  }
  return parts.length ? parts.join(' ') : null
}

export const SNIPPET_MAX_CHARS = 240
export const SNIPPET_TOKENS = 16

/**
 * Hard character cap on a snippet (FTS5 caps it in tokens; a pathological token can still be long).
 * Keeps marks balanced if the cut lands inside one.
 */
export function capSnippet(s: string, max = SNIPPET_MAX_CHARS): string {
  if (s.length <= max) return s
  let cut = s.slice(0, max - 1)
  const open = cut.lastIndexOf('[')
  if (open > cut.lastIndexOf(']')) cut += ']'
  return `${cut}…`
}
