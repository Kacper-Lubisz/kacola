import { NoteStore, Store } from '@gnomeola/store'
import { describe, expect, it } from 'vitest'
import { markSnippet, matchText, queryParts, searchMoments } from '../src/moments.ts'

// The home search box: moments over titles, notes and transcripts. The old desktop search matched titles
// only and said "No matching sessions" for words that were in a transcript twice.

function rig() {
  let t = Date.parse('2026-09-01T09:00:00.000Z')
  const tick = () => {
    t += 60_000
    return new Date(t)
  }
  const store = Store.open(':memory:', { now: tick })
  const notes = new NoteStore(store)
  const meeting = (
    title: string,
    o: { private?: boolean; notes?: string; lines?: [string, string][] } = {},
  ) => {
    const s = store.createSession({ title, private: o.private ?? false })
    if (o.notes) notes.put(s.id, o.notes, 0)
    for (const [n, [speaker, text]] of (o.lines ?? []).entries())
      store.upsertSegment({
        id: `${s.id}_seg${n}`,
        sessionId: s.id,
        track: speaker === 'me' ? 'mic' : 'system',
        speaker,
        startMs: n * 5000,
        endMs: n * 5000 + 4000,
        text,
        quality: 'final',
        confidence: null,
      })
    return s
  }
  return { store, meeting }
}

describe('search moments', () => {
  it('finds a phrase in a transcript, notes and a title, as moments that open at the line', () => {
    const { store, meeting } = rig()
    const standup = meeting('Platform standup', {
      notes: '## Decisions\n- **Retry budget** is three attempts\n- Ana owns the dashboard\n',
      lines: [
        ['me', 'Can we settle the retry budget today?'],
        ['Ana', 'Yes, the retry budget is three attempts, then the dead-letter queue.'],
        ['Ben', 'Unrelated line.'],
      ],
    })
    const planning = meeting('Retry budget planning')
    const r = searchMoments(store, { q: 'retry budget', limit: 20 })
    expect(r.total).toBe(4)
    // the title first, then the notes line, then the transcript lines
    expect(r.moments.map((m) => m.kind)).toEqual(['title', 'notes', 'transcript', 'transcript'])
    expect(r.moments[0]).toMatchObject({
      sessionId: planning.id,
      snippet: '[Retry budget] planning',
      segmentId: null,
      private: false,
    })
    expect(r.moments[1]).toMatchObject({ sessionId: standup.id, snippet: '[Retry budget] is three attempts' })
    const lines = r.moments.filter((m) => m.kind === 'transcript')
    for (const m of lines) {
      expect(m).toMatchObject({ sessionId: standup.id, sessionTitle: 'Platform standup' })
      expect(m.segmentId).toMatch(/_seg[01]$/)
      expect(m.startMs).not.toBeNull()
      expect(m.snippet).toMatch(/\[retry\] \[budget\]|\[retry budget\]/i)
    }
    expect(new Set(lines.map((m) => m.speaker))).toEqual(new Set(['me', 'Ana']))
    expect(r.moments.every((m) => m.date === standup.createdAt || m.date === planning.createdAt)).toBe(true)
  })

  it('private meetings only with includePrivate, and flagged', () => {
    const { store, meeting } = rig()
    meeting('Public sync', { lines: [['Ana', 'the salary bands are public']] })
    const hr = meeting('HR 1:1', {
      private: true,
      notes: '- salary review in March\n',
      lines: [['Ana', 'my salary']],
    })
    expect(searchMoments(store, { q: 'salary', limit: 20 }).moments.every((m) => !m.private)).toBe(true)
    const all = searchMoments(store, { q: 'salary', limit: 20, includePrivate: true })
    expect(all.moments.filter((m) => m.sessionId === hr.id).map((m) => [m.kind, m.private])).toEqual([
      ['notes', true],
      ['transcript', true],
    ])
  })

  it('folds case and diacritics; a prefix with *; nothing for a missing word', () => {
    const { store, meeting } = rig()
    meeting('Café roadmap', { notes: '- Zoë presents the ROADMAP\n' })
    expect(searchMoments(store, { q: 'cafe', limit: 5 }).moments.map((m) => m.snippet)).toEqual([
      '[Café] roadmap',
    ])
    expect(searchMoments(store, { q: 'zoe roadmap', limit: 5 }).moments[0]?.snippet).toBe(
      '[Zoë] presents the [ROADMAP]',
    )
    expect(searchMoments(store, { q: 'road*', limit: 5 }).total).toBe(2)
    expect(searchMoments(store, { q: 'roadmap missing', limit: 5 })).toEqual({ moments: [], total: 0 })
    expect(searchMoments(store, { q: '***', limit: 5 })).toEqual({ moments: [], total: 0 })
  })

  it('query parsing and marking match the FTS5 rules', () => {
    expect(queryParts('"dead letter" queue retr*')).toEqual([
      { tokens: ['dead', 'letter'], prefix: false },
      { tokens: ['queue'], prefix: false },
      { tokens: ['retr'], prefix: true },
    ])
    const text = 'then the dead letter queue, retrying later'
    const r = matchText(text, queryParts('"dead letter" retr*'))!
    expect(markSnippet(text, r)).toBe('then the [dead letter] queue, [retrying] later')
    expect(matchText('dead, the letter', queryParts('"dead letter"'))).toBeNull()
    const long = `${'word '.repeat(60)}needle at the end`
    expect(markSnippet(long, matchText(long, queryParts('needle'))!)).toMatch(/^….*\[needle\] at the end$/)
  })
})
