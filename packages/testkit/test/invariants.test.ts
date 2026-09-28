import type { Segment } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import {
  assertNoViolations,
  checkEventLog,
  checkSegmentHistory,
  checkSegments,
  foldSegments,
} from '../src/invariants/index.ts'

const seg = (o: Partial<Segment>): Segment => ({
  id: 'seg_1',
  sessionId: 'ses_1',
  track: 'mic',
  speaker: 'me',
  startMs: 0,
  endMs: 1000,
  text: 'hello',
  quality: 'live',
  revision: 1,
  confidence: null,
  ...o,
})

// The invariants are themselves tested against deliberately broken inputs — a checker that never
// fires is indistinguishable from a pipeline that never breaks.
describe('checkSegments', () => {
  it('accepts a clean two-track transcript', () => {
    const s = [
      seg({ id: 'a', startMs: 0, endMs: 1000 }),
      seg({ id: 'b', startMs: 1000, endMs: 2000 }),
      seg({ id: 'c', track: 'system', speaker: 'them', startMs: 500, endMs: 1500 }),
    ]
    expect(checkSegments(s, { durationMs: 2000 })).toEqual([])
  })

  it.each([
    ['non-overlapping', [seg({ id: 'a', endMs: 1000 }), seg({ id: 'b', startMs: 900, endMs: 1200 })]],
    ['mic-is-me', [seg({ speaker: 'them' })]],
    ['system-is-not-me', [seg({ track: 'system', speaker: 'me' })]],
    ['ordered-bounds', [seg({ startMs: 5, endMs: 2 })]],
    ['unique-id', [seg({}), seg({ startMs: 2000, endMs: 3000 })]],
    ['inside-session', [seg({ endMs: 9000 })]],
  ])('catches %s', (rule, segments) => {
    expect(checkSegments(segments as Segment[], { durationMs: 2000 }).map((v) => v.rule)).toContain(rule)
  })

  it('overlap across different tracks is fine — people talk over each other', () => {
    expect(checkSegments([seg({ id: 'a' }), seg({ id: 'b', track: 'system', speaker: 'them' })])).toEqual([])
  })
})

describe('checkSegmentHistory', () => {
  it('accepts live -> live -> final with increasing revisions', () => {
    const h = [
      seg({ revision: 1 }),
      seg({ revision: 2, text: 'hello there' }),
      seg({ revision: 3, quality: 'final' }),
    ]
    expect(checkSegmentHistory(h)).toEqual([])
  })
  it('catches a regression from final back to live', () => {
    const h = [seg({ revision: 1, quality: 'final' }), seg({ revision: 2, quality: 'live' })]
    expect(checkSegmentHistory(h).map((v) => v.rule)).toContain('never-back-to-live')
  })
  it('catches a revision that does not increase', () => {
    expect(checkSegmentHistory([seg({ revision: 1 }), seg({ revision: 1 })]).map((v) => v.rule)).toContain(
      'revision-increases',
    )
  })
})

describe('checkEventLog', () => {
  it('accepts a gap-free log', () => expect(checkEventLog([{ seq: 1 }, { seq: 2 }, { seq: 3 }])).toEqual([]))
  it('catches gaps and duplicates', () => {
    const rules = checkEventLog([{ seq: 1 }, { seq: 3 }, { seq: 3 }]).map((v) => v.rule)
    expect(rules).toContain('gap-free')
    expect(rules).toContain('no-duplicates')
  })
  it('honours a resume cursor', () => expect(checkEventLog([{ seq: 5 }, { seq: 6 }], 4)).toEqual([]))
})

describe('assertNoViolations', () => {
  it('names every rule broken', () => {
    expect(() => assertNoViolations([{ rule: 'gap-free', detail: 'x' }], 'fixture a')).toThrow(/gap-free.*/s)
  })
})

describe('invariants — edge cases pinned by mutation testing', () => {
  it('allows zero-length segments but not negative ones', () => {
    expect(checkSegments([seg({ startMs: 5, endMs: 5 })])).toEqual([])
    expect(checkSegments([seg({ startMs: 5, endMs: 4 })])[0]).toEqual({
      rule: 'ordered-bounds',
      detail: 'seg_1: end 4 < start 5',
    })
  })

  it('tolerates 250ms past the session end, and not a millisecond more', () => {
    expect(checkSegments([seg({ endMs: 2250 })], { durationMs: 2000 })).toEqual([])
    // One segment past the tolerance breaks both the per-segment and the per-track bound.
    expect(checkSegments([seg({ endMs: 2251 })], { durationMs: 2000 }).map((v) => v.rule)).toEqual([
      'inside-session',
      'duration-sum',
    ])
  })

  it('detects overlap regardless of input order', () => {
    const v = checkSegments([
      seg({ id: 'b', startMs: 900, endMs: 1200 }),
      seg({ id: 'c', startMs: 5000, endMs: 6000 }),
      seg({ id: 'a', endMs: 1000 }),
    ])
    expect(v).toEqual([{ rule: 'non-overlapping', detail: 'mic: a [0,1000) overlaps b [900,1200)' }])
  })

  it('orders by end time when start times tie', () => {
    // Same start: the shorter one sorts first, so the longer one overlaps it.
    const v = checkSegments([
      seg({ id: 'long', startMs: 0, endMs: 3000 }),
      seg({ id: 'short', startMs: 0, endMs: 1000 }),
    ])
    expect(v.map((x) => x.detail)).toEqual(['mic: short [0,1000) overlaps long [0,3000)'])
  })

  it('bounds the total duration per track', () => {
    const many = [0, 1, 2].map((i) => seg({ id: `s${i}`, startMs: i * 1000, endMs: i * 1000 + 1000 }))
    expect(checkSegments(many, { durationMs: 2750 })).toEqual([])
    const v = checkSegments(many, { durationMs: 2700 })
    expect(v.map((x) => x.rule)).toContain('duration-sum')
    expect(v.find((x) => x.rule === 'duration-sum')!.detail).toBe(
      'mic: segments sum to 3000ms > session 2700ms',
    )
    expect(checkSegments(many).map((x) => x.rule)).not.toContain('duration-sum')
  })

  it('requires a speaker, and finality only when asked', () => {
    expect(checkSegments([seg({ speaker: '' })]).map((v) => v.rule)).toContain('has-speaker')
    expect(checkSegments([seg({ quality: 'live' })])).toEqual([])
    expect(checkSegments([seg({ quality: 'live' })], { requireFinal: true })).toEqual([
      { rule: 'all-final', detail: 'seg_1 still live' },
    ])
    expect(checkSegments([seg({ quality: 'final' })], { requireFinal: true })).toEqual([])
  })

  it('reports readable details for attribution violations', () => {
    expect(checkSegments([seg({ speaker: 'them' })])[0]!.detail).toBe(
      'seg_1: mic segment attributed to "them"',
    )
    expect(checkSegments([seg({ track: 'system' })])[0]!.detail).toBe(
      'seg_1: far-end segment attributed to me',
    )
    expect(checkSegments([seg({}), seg({ startMs: 5000, endMs: 6000 })])[0]!.detail).toBe(
      'duplicate segment id seg_1',
    )
  })

  it('history: first revision must be 1; track and session never change', () => {
    expect(checkSegmentHistory([seg({ revision: 2 })])).toEqual([
      { rule: 'revision-starts-at-1', detail: 'seg_1: first seen at revision 2' },
    ])
    const moved = checkSegmentHistory([
      seg({ revision: 1 }),
      seg({ revision: 2, track: 'system', speaker: 'them', sessionId: 'ses_2' }),
    ])
    expect(moved.map((v) => v.rule).sort()).toEqual(['session-stable', 'track-stable'])
    expect(
      checkSegmentHistory([seg({ revision: 1, quality: 'final' }), seg({ revision: 2, quality: 'final' })]),
    ).toEqual([])
    expect(checkSegmentHistory([seg({ revision: 1 }), seg({ revision: 2 })])).toEqual([])
    expect(checkSegmentHistory([seg({ revision: 3 }), seg({ revision: 2 })]).map((v) => v.detail)).toContain(
      'seg_1: revision 3 -> 2',
    )
  })
})

describe('foldSegments', () => {
  it('keeps the latest upsert per segment and ignores other events', () => {
    const at = '2026-09-28T10:00:00.000Z'
    const s1 = seg({ id: 'a', revision: 1 })
    const s2 = seg({ id: 'a', revision: 2, text: 'final text', quality: 'final' })
    const s3 = seg({ id: 'b', startMs: 2000, endMs: 3000 })
    const events = [
      { seq: 1, at, sessionId: 'ses_1', data: { type: 'segment.upserted' as const, segment: s1 } },
      { seq: 2, at, sessionId: 'ses_1', data: { type: 'segment.upserted' as const, segment: s3 } },
      { seq: 3, at, sessionId: 'ses_1', data: { type: 'segment.upserted' as const, segment: s2 } },
      {
        seq: 4,
        at,
        sessionId: null,
        data: {
          type: 'qa.message' as const,
          message: {
            id: 'qa',
            sessionId: null,
            requestId: 'r',
            role: 'user' as const,
            text: 't',
            citations: [],
            model: null,
            usage: null,
            stopReason: null,
            createdAt: at,
          },
        },
      },
    ]
    const folded = foldSegments(events)
    expect([...folded.keys()]).toEqual(['a', 'b'])
    expect(folded.get('a')).toEqual(s2)
  })
})

describe('assertNoViolations', () => {
  it('passes silently on no violations', () => expect(() => assertNoViolations([])).not.toThrow())
  it('includes context, counts, and truncates after 50', () => {
    const many = Array.from({ length: 53 }, (_, i) => ({ rule: 'r', detail: `d${i}` }))
    let msg = ''
    try {
      assertNoViolations(many, 'fixture x')
    } catch (e) {
      msg = (e as Error).message
    }
    expect(msg.startsWith('53 invariant violation(s) in fixture x:\n  [r] d0\n')).toBe(true)
    expect(msg).toContain('  [r] d49')
    expect(msg).not.toContain('d50')
    expect(msg.endsWith('\n  …and 3 more')).toBe(true)
    expect(() => assertNoViolations([{ rule: 'r', detail: 'x' }])).toThrow(/^1 invariant violation\(s\):\n/)
  })
})
