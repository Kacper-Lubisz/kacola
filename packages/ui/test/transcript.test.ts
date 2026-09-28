import type { AnyEvent, Segment, Session, Transcript } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import {
  applyPartial,
  applyTranscriptEvent,
  emptyTranscript,
  fromSegments,
  TranscriptFeed,
  transcriptRows,
  upsertSegment,
} from '../src/data/transcript.ts'

const SES = 'ses_1'
let n = 0
const seg = (over: Partial<Segment> = {}): Segment => ({
  id: `seg_${++n}`,
  sessionId: SES,
  track: 'mic',
  speaker: 'me',
  startMs: 0,
  endMs: 1000,
  text: 'hello',
  quality: 'live',
  revision: 1,
  confidence: 0.5,
  ...over,
})
const ev = (data: AnyEvent['data'], sessionId: string | null = SES, seq: number | null = 1): AnyEvent =>
  ({ seq, at: '2026-09-28T12:00:00.000Z', sessionId, data }) as AnyEvent

describe('transcript fold', () => {
  it('orders segments by start, mic before system on a tie, whatever order they arrive in', () => {
    const a = seg({ startMs: 5000, track: 'system', speaker: 'them' })
    const b = seg({ startMs: 1000 })
    const c = seg({ startMs: 5000 })
    let s = emptyTranscript
    for (const x of [a, b, c]) s = upsertSegment(s, x)
    expect(s.ordered.map((x) => x.id)).toEqual([b.id, c.id, a.id])
    expect(fromSegments([a, b, c]).ordered.map((x) => x.id)).toEqual([b.id, c.id, a.id])
  })

  it('replaces a segment in place when a higher revision arrives, and ignores replays', () => {
    const live = seg({ startMs: 1000, text: 'the retry budget' })
    const other = seg({ startMs: 2000 })
    let s = fromSegments([live, other])
    const final = { ...live, text: 'The retry budget.', quality: 'final' as const, revision: 2 }
    s = upsertSegment(s, final)
    expect(s.ordered).toHaveLength(2)
    expect(s.ordered[0]).toBe(final)
    // a replayed older revision changes nothing, and returns the same object (no re-render)
    expect(upsertSegment(s, live)).toBe(s)
    expect(upsertSegment(s, final)).toBe(s)
  })

  it('moves a segment whose start changed in a revision', () => {
    const a = seg({ startMs: 1000 })
    const b = seg({ startMs: 2000 })
    let s = fromSegments([a, b])
    s = upsertSegment(s, { ...a, startMs: 3000, revision: 2 })
    expect(s.ordered.map((x) => x.id)).toEqual([b.id, a.id])
  })

  it('keeps one partial per track and drops it when a segment closes over it', () => {
    let s = emptyTranscript
    s = applyPartial(s, { track: 'mic', speaker: 'me', startMs: 0, text: 'the' })
    s = applyPartial(s, { track: 'mic', speaker: 'me', startMs: 0, text: 'the retry' })
    s = applyPartial(s, { track: 'system', speaker: 'them', startMs: 0, text: 'yes' })
    expect(Object.values(s.partials).map((p) => p.text)).toEqual(['the retry', 'yes'])
    s = upsertSegment(s, seg({ startMs: 0, text: 'the retry budget' }))
    expect(s.partials.mic).toBeUndefined()
    expect(s.partials.system?.text).toBe('yes')
    // a late partial for the segment that already closed is stale
    expect(applyPartial(s, { track: 'mic', speaker: 'me', startMs: 0, text: 'the retry bud' })).toBe(s)
    // the next open segment's partial is welcome
    s = applyPartial(s, { track: 'mic', speaker: 'me', startMs: 1000, text: 'then' })
    expect(s.partials.mic?.text).toBe('then')
  })

  it('folds only this session’s events, and clears partials when recording ends', () => {
    let s = emptyTranscript
    s = applyTranscriptEvent(
      s,
      SES,
      ev({ type: 'segment.upserted', segment: seg({ sessionId: 'other' }) }, 'other'),
    )
    expect(s.ordered).toHaveLength(0)
    s = applyTranscriptEvent(
      s,
      SES,
      ev({ type: 'transcript.partial', track: 'mic', speaker: 'me', startMs: 0, text: 'hi' }, SES, null),
    )
    expect(s.partials.mic?.text).toBe('hi')
    const stopped = { status: 'stopped' } as Session
    s = applyTranscriptEvent(s, SES, ev({ type: 'session.upserted', session: stopped }))
    expect(s.partials).toEqual({})
  })

  it('presents rows grouped by speaker, partials last, provisional marked', () => {
    let s = fromSegments([
      seg({ startMs: 0, speaker: 'me' }),
      seg({ startMs: 1000, speaker: 'me', quality: 'final', revision: 2 }),
      seg({ startMs: 2000, track: 'system', speaker: 'them', quality: 'final', revision: 2 }),
    ])
    s = applyPartial(s, { track: 'system', speaker: 'them', startMs: 3000, text: 'and' })
    const rows = transcriptRows(s)
    expect(rows.map((r) => [r.speaker, r.groupStart, r.provisional, r.kind])).toEqual([
      ['me', true, true, 'segment'],
      ['me', false, false, 'segment'],
      ['them', true, false, 'segment'],
      ['them', false, true, 'partial'],
    ])
    expect(rows.at(-1)!.id).toBe('partial:system')
  })
})

describe('TranscriptFeed', () => {
  it('listens before loading and folds what arrived during the fetch, without losing or doubling', async () => {
    const listeners = new Set<(e: AnyEvent) => void>()
    const a = seg({ startMs: 0 })
    let resolve!: (t: Transcript) => void
    const feed = new TranscriptFeed(SES, {
      load: () => new Promise((r) => (resolve = r)),
      onEvent: (l) => {
        listeners.add(l)
        return () => listeners.delete(l)
      },
    }).start()
    expect(feed.getSnapshot().status).toBe('loading')
    // during the fetch: a new segment, and the final revision of one the snapshot will contain
    const b = seg({ startMs: 1000 })
    for (const l of listeners) l(ev({ type: 'segment.upserted', segment: b }))
    for (const l of listeners)
      l(ev({ type: 'segment.upserted', segment: { ...a, revision: 2, text: 'Hello.' } }))
    resolve({ session: {} as Session, segments: [a], window: null, total: 1 })
    await new Promise((r) => setTimeout(r, 0))
    const snap = feed.getSnapshot()
    expect(snap.status).toBe('ready')
    expect(snap.transcript.ordered.map((x) => [x.id, x.text])).toEqual([
      [a.id, 'Hello.'],
      [b.id, 'hello'],
    ])
    // live after that
    const c = seg({ startMs: 2000 })
    for (const l of listeners) l(ev({ type: 'segment.upserted', segment: c }))
    expect(feed.getSnapshot().transcript.ordered).toHaveLength(3)
    feed.dispose()
    expect(listeners.size).toBe(0)
  })

  it('reports a failed load and keeps what it has', async () => {
    const feed = new TranscriptFeed(SES, {
      load: async () => {
        throw new Error('404 no session')
      },
      onEvent: () => () => {},
    }).start()
    await new Promise((r) => setTimeout(r, 0))
    expect(feed.getSnapshot()).toMatchObject({ status: 'error', error: '404 no session' })
  })
})
