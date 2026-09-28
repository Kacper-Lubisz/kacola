import { formatOffset, type SearchHit } from '@gnomeola/protocol'
import type { Ctx } from '../context.ts'
import { usage } from '../errors.ts'
import { renderJson, truncate } from '../output.ts'
import { mapApiError } from '../sessions.ts'
import { BUDGET, countTokens } from '../tokens.ts'

export type SearchOpts = { since?: string; speaker?: string; session?: string; limit?: number }

function hitJson(h: SearchHit) {
  return {
    sessionId: h.sessionId,
    session: h.sessionTitle,
    segmentId: h.segmentId,
    t: formatOffset(h.startMs),
    speaker: h.speaker,
    snippet: truncate(h.snippet, BUDGET.snippetChars),
  }
}

/**
 * Ranked snippets plus the ids needed to fetch a window around each — the cheap first step of
 * search → window → cite. The rendered output is held under a counted token ceiling by dropping the
 * lowest-ranked hits, and says so when it does.
 */
export async function search(ctx: Ctx, query: string | undefined, o: SearchOpts) {
  if (!query?.trim()) throw usage('a search query is required', 'e.g. gnomeola search "retry budget"')
  const res = await ctx.client
    .call('search', {
      query: { q: query, since: o.since, speaker: o.speaker, sessionId: o.session, limit: o.limit ?? 20 },
    })
    .catch(mapApiError)

  const hits = res.hits.map(hitJson)
  const build = (n: number) => {
    const shown = hits.slice(0, n)
    if (ctx.format === 'json') {
      const first = shown[0]
      return renderJson(
        {
          query,
          total: res.total,
          returned: shown.length,
          truncated: shown.length < res.hits.length,
          hits: shown,
          ...(first ? { next: `gnomeola transcript ${first.sessionId} --around ${first.segmentId}` } : {}),
        },
        ctx.io,
      )
    }
    if (!shown.length) return `no matches for ${JSON.stringify(query)}\n`
    const lines = shown.map(
      (h) => `${h.session} · ${h.t} · ${h.speaker}: ${h.snippet}\n    ${h.sessionId} ${h.segmentId}`,
    )
    const more =
      res.total > shown.length ? `\n(${res.total - shown.length} more — refine the query or use --limit)` : ''
    return `${lines.join('\n')}${more}\n`
  }

  // Largest prefix of the ranked hits whose rendering fits the budget (binary search: tokenising is
  // the expensive step, so don't do it once per dropped hit).
  let out = build(hits.length)
  if (countTokens(out) > BUDGET.search) {
    let lo = 1
    let hi = hits.length - 1
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (countTokens(build(mid)) <= BUDGET.search) lo = mid
      else hi = mid - 1
    }
    out = build(lo)
  }
  ctx.io.stdout(out)
}
