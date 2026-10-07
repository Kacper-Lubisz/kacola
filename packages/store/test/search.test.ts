import { newId, SearchHit } from '@kacola/protocol'
import { describe, expect, it } from 'vitest'
import { capSnippet, SNIPPET_MAX_CHARS, Store, toFtsQuery } from '../src/index.ts'

function world() {
  let t = Date.parse('2026-09-01T09:00:00.000Z')
  const s = Store.open(':memory:', {
    now: () => {
      t += 60_000
      return new Date(t)
    },
  })
  const standup = s.createSession({ title: 'Platform standup' })
  const secret = s.createSession({ title: 'Salary review', private: true })
  const later = s.createSession({ title: 'Roadmap sync' })
  let at = 0
  const add = (sessionId: string, text: string, track: 'mic' | 'system' = 'system', speaker = 'Ana') => {
    const startMs = at
    at += 1000
    return s.upsertSegment({
      id: newId('seg'),
      sessionId,
      track,
      speaker: track === 'mic' ? 'me' : speaker,
      startMs,
      endMs: startMs + 900,
      text,
      quality: 'final',
      confidence: 0.9,
    })
  }
  const segs = {
    dense: add(standup.id, 'retry budget retry budget retry budget'),
    once: add(
      standup.id,
      'we talked about a lot of things today including the dashboard the migration the on-call rota and somewhere in there the retry budget came up once',
    ),
    me: add(standup.id, 'I think the retry budget should be three attempts', 'mic'),
    priv: add(secret.id, 'the retry budget for salaries is confidential'),
    later: add(later.id, 'retry budget revisited after the incident', 'system', 'Ben'),
    accents: add(later.id, 'Le café était naïve'),
  }
  return { s, standup, secret, later, segs }
}

describe('search', () => {
  it('ranks by bm25: dense short matches before a passing mention; scores descend', () => {
    const { s, segs } = world()
    const r = s.search({ q: 'retry budget' })
    expect(r.total).toBe(4)
    expect(r.hits[0]!.segmentId).toBe(segs.dense.id)
    expect(r.hits.at(-1)!.segmentId).toBe(segs.once.id)
    const scores = r.hits.map((h) => h.score)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    for (const h of r.hits) SearchHit.parse(h)
  })

  it('marks matches with [ ] and caps long snippets', () => {
    const { s, segs, standup } = world()
    const hit = s.search({ q: 'dashboard' }).hits[0]!
    expect(hit.segmentId).toBe(segs.once.id)
    expect(hit.snippet).toContain('[dashboard]')
    expect(hit.snippet.length).toBeLessThan(segs.once.text.length)
    expect(hit.snippet).toMatch(/…/)
    expect(hit).toMatchObject({ sessionId: standup.id, sessionTitle: 'Platform standup', speaker: 'Ana' })
    const long = `${'x'.repeat(300)} [needle] y`
    const capped = capSnippet(long)
    expect(capped.length).toBeLessThanOrEqual(SNIPPET_MAX_CHARS + 1)
    expect(capSnippet(`${'a '.repeat(118)}[${'b'.repeat(50)}]`)).toMatch(/\[b+]…$/)
  })

  it('excludes private sessions unless includePrivate', () => {
    const { s, secret } = world()
    expect(s.search({ q: 'salaries' }).hits).toEqual([])
    expect(s.search({ q: 'salaries' }).total).toBe(0)
    expect(s.search({ q: 'salaries', includePrivate: true }).hits.map((h) => h.sessionId)).toEqual([
      secret.id,
    ])
    expect(s.search({ q: 'retry', includePrivate: true }).total).toBe(5)
  })

  it('filters by sessionId, speaker (case-insensitive) and since; limit caps hits but not total', () => {
    const { s, later, segs } = world()
    expect(s.search({ q: 'retry', sessionId: later.id }).hits.map((h) => h.segmentId)).toEqual([
      segs.later.id,
    ])
    expect(s.search({ q: 'retry', speaker: 'ME' }).hits.map((h) => h.segmentId)).toEqual([segs.me.id])
    expect(s.search({ q: 'retry', since: new Date(later.createdAt) }).hits.map((h) => h.segmentId)).toEqual([
      segs.later.id,
    ])
    const limited = s.search({ q: 'retry', limit: 2 })
    expect(limited.hits).toHaveLength(2)
    expect(limited.total).toBe(4)
  })

  it('matches without diacritics, by prefix, and by quoted phrase', () => {
    const { s, segs } = world()
    expect(s.search({ q: 'cafe naive' }).hits.map((h) => h.segmentId)).toEqual([segs.accents.id])
    expect(s.search({ q: 'dash*' }).hits.map((h) => h.segmentId)).toEqual([segs.once.id])
    expect(s.search({ q: 'dash' }).hits).toEqual([])
    expect(s.search({ q: '"budget retry"' }).hits.map((h) => h.segmentId)).toEqual([segs.dense.id])
  })

  it('never passes FTS5 syntax through: hostile input neither throws nor changes meaning', () => {
    const { s } = world()
    for (const q of [
      'NEAR(retry budget)',
      'retry OR salaries',
      '"',
      '***',
      '-retry',
      'text:retry',
      '(',
      'AND',
      '^retry',
      "'; DROP TABLE segments; --",
    ]) {
      expect(() => s.search({ q }), q).not.toThrow()
    }
    // OR is a literal word here, not an operator: nothing says "or", so nothing matches
    expect(s.search({ q: 'retry OR salaries', includePrivate: true }).total).toBe(0)
    expect(s.search({ q: '***' })).toEqual({ hits: [], total: 0 })
    expect(s.segments(world().standup.id)).toBeDefined()
  })

  it('stays in sync as segments are revised and deleted', () => {
    const { s, segs, standup } = world()
    s.upsertSegment({ ...segs.dense, text: 'completely different words' })
    expect(s.search({ q: 'completely' }).hits.map((h) => h.segmentId)).toEqual([segs.dense.id])
    expect(s.search({ q: 'retry' }).hits.map((h) => h.segmentId)).not.toContain(segs.dense.id)
    s.deleteSession(standup.id)
    expect(s.search({ q: 'completely' }).total).toBe(0)
    s.checkFts()
  })
})

describe('toFtsQuery', () => {
  it('quotes every token and keeps phrases and prefixes', () => {
    expect(toFtsQuery('retry budget')).toBe('"retry" "budget"')
    expect(toFtsQuery('"retry budget" dash*')).toBe('"retry budget" "dash"*')
    expect(toFtsQuery('on-call')).toBe('"on" "call"')
    expect(toFtsQuery('  ')).toBeNull()
    expect(toFtsQuery('"unterminated phrase')).toBe('"unterminated phrase"')
  })
})
