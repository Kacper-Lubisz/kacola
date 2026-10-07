import { type AnyEvent, type DurableEvent, Session } from '@kacola/protocol'
import { describe, expect, it } from 'vitest'
import {
  activeSession,
  applyEvent,
  compareSessions,
  emptySessions,
  filterSessions,
  fromSnapshot,
} from '../src/sessions.ts'

const mk = (id: string, createdAt: string, over: Partial<Session> = {}): Session =>
  Session.parse({
    id,
    title: id,
    createdAt,
    startedAt: createdAt,
    endedAt: null,
    status: 'stopped',
    private: false,
    durationMs: 0,
    tracks: [],
    error: null,
    ...over,
  })

const upsert = (seq: number, s: Session): DurableEvent => ({
  seq,
  at: '2026-09-28T12:00:00.000Z',
  sessionId: s.id,
  data: { type: 'session.upserted', session: s },
})

const a = mk('ses_a', '2026-09-28T09:00:00.000Z')
const b = mk('ses_b', '2026-09-28T10:00:00.000Z')
const c = mk('ses_c', '2026-09-28T11:00:00.000Z')

describe('ordering', () => {
  it('is newest first with an id tie-break', () => {
    const tie = mk('ses_z', b.createdAt)
    expect([a, tie, c, b].sort(compareSessions).map((s) => s.id)).toEqual([
      'ses_c',
      'ses_z',
      'ses_b',
      'ses_a',
    ])
  })

  it('a snapshot comes out ordered regardless of input order', () => {
    const st = fromSnapshot([a, c, b], 7)
    expect(st.ordered.map((s) => s.id)).toEqual(['ses_c', 'ses_b', 'ses_a'])
    expect(st.seq).toBe(7)
    expect(st.byId.get('ses_b')).toBe(b)
  })
})

describe('applyEvent', () => {
  it('inserts new sessions in order and replaces existing ones', () => {
    let st = fromSnapshot([a], 1)
    st = applyEvent(st, upsert(2, c))
    st = applyEvent(st, upsert(3, b))
    expect(st.ordered.map((s) => s.id)).toEqual(['ses_c', 'ses_b', 'ses_a'])
    const renamed = { ...b, title: 'Renamed', status: 'recording' as const }
    st = applyEvent(st, upsert(4, renamed))
    expect(st.ordered).toHaveLength(3)
    expect(st.byId.get('ses_b')?.title).toBe('Renamed')
    expect(st.seq).toBe(4)
  })

  it('ignores durable events the snapshot already contains (no double-apply)', () => {
    const newer = { ...a, title: 'newest' }
    const st = fromSnapshot([newer], 10)
    const stale = upsert(9, { ...a, title: 'stale' })
    expect(applyEvent(st, stale)).toBe(st)
    expect(applyEvent(st, upsert(10, { ...a, title: 'also stale' }))).toBe(st)
  })

  it('converges when a replay after the cursor carries older versions first', () => {
    // snapshot read at cursor 5 but already reflecting seq 7; replay 6 then 7 lands on the latest
    let st = fromSnapshot([{ ...a, title: 'v7' }], 5)
    st = applyEvent(st, upsert(6, { ...a, title: 'v6' }))
    expect(st.byId.get('ses_a')?.title).toBe('v6')
    st = applyEvent(st, upsert(7, { ...a, title: 'v7' }))
    expect(st.byId.get('ses_a')?.title).toBe('v7')
  })

  it('advances the cursor on other durable events without touching the list', () => {
    const st = fromSnapshot([a], 1)
    const ev: AnyEvent = {
      seq: 2,
      at: '2026-09-28T12:00:00.000Z',
      sessionId: 'ses_a',
      data: {
        type: 'segment.upserted',
        segment: {
          id: 'seg_1',
          sessionId: 'ses_a',
          track: 'mic',
          speaker: 'me',
          startMs: 0,
          endMs: 1000,
          text: 'hi',
          quality: 'live',
          revision: 1,
          confidence: null,
        },
      },
    }
    const next = applyEvent(st, ev)
    expect(next.ordered).toBe(st.ordered)
    expect(next.seq).toBe(2)
  })

  it('returns the same state for ephemeral events', () => {
    const st = fromSnapshot([a], 3)
    const ev: AnyEvent = {
      seq: null,
      at: '2026-09-28T12:00:00.000Z',
      sessionId: 'ses_a',
      data: { type: 'heartbeat', lastSeq: 3 },
    }
    expect(applyEvent(st, ev)).toBe(st)
  })

  it('starts from an empty state', () => {
    const st = applyEvent(emptySessions, upsert(1, a))
    expect(st.ordered.map((s) => s.id)).toEqual(['ses_a'])
  })
})

describe('filterSessions', () => {
  const list = fromSnapshot(
    [
      mk('ses_1', '2026-09-28T09:00:00.000Z', { title: 'Weekly product sync' }),
      mk('ses_2', '2026-09-28T10:00:00.000Z', { title: 'Design review' }),
      mk('ses_3', '2026-09-28T11:00:00.000Z', { title: '' }),
    ],
    0,
  ).ordered

  it('matches case-insensitively on the displayed title', () => {
    expect(filterSessions(list, 'WEEKLY').map((s) => s.id)).toEqual(['ses_1'])
    expect(filterSessions(list, '  review ').map((s) => s.id)).toEqual(['ses_2'])
    expect(filterSessions(list, 'untitled').map((s) => s.id)).toEqual(['ses_3'])
    expect(filterSessions(list, 'zzz')).toEqual([])
  })

  it('returns the same array for a blank query', () => {
    expect(filterSessions(list, '')).toBe(list)
    expect(filterSessions(list, '   ')).toBe(list)
  })
})

describe('activeSession', () => {
  it('finds a recording or paused session', () => {
    expect(activeSession([a, b])).toBeUndefined()
    const rec = { ...b, status: 'recording' as const }
    expect(activeSession([a, rec])).toBe(rec)
    const paused = { ...c, status: 'paused' as const }
    expect(activeSession([paused, a])).toBe(paused)
  })
})
