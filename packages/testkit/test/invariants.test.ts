import type { DurableEvent, Segment, Speaker } from '@kacola/protocol'
import { describe, expect, it } from 'vitest'
import {
  assertNoViolations,
  checkAttribution,
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

describe('invariant details name the offending segment or seq', () => {
  it('segment rules', () => {
    expect(checkSegments([seg({ endMs: 9000 })], { durationMs: 2000 })[0]).toEqual({
      rule: 'inside-session',
      detail: 'seg_1: ends at 9000 beyond duration 2000',
    })
    expect(checkSegments([seg({ track: 'system', speaker: '' })])).toEqual([
      { rule: 'has-speaker', detail: 'seg_1: empty speaker' },
    ])
  })

  it('history rules', () => {
    expect(
      checkSegmentHistory([
        seg({ revision: 1, quality: 'final' }),
        seg({ revision: 2, quality: 'live', track: 'system', speaker: 'them', sessionId: 'ses_2' }),
      ]),
    ).toEqual([
      { rule: 'never-back-to-live', detail: 'seg_1: final -> live' },
      { rule: 'track-stable', detail: 'seg_1: track changed' },
      { rule: 'session-stable', detail: 'seg_1: session changed' },
    ])
  })

  it('event-log rules', () => {
    expect(checkEventLog([{ seq: 1 }, { seq: 1 }, { seq: 4 }])).toEqual([
      { rule: 'no-duplicates', detail: 'seq 1 delivered twice' },
      { rule: 'gap-free', detail: 'expected seq 2, got 1' },
      { rule: 'gap-free', detail: 'expected seq 2, got 4' },
    ])
  })
})

describe('foldSegments — attribution events (M3)', () => {
  const at = '2026-09-28T10:00:00.000Z'
  let seq = 0
  const ev = (data: DurableEvent['data']): DurableEvent => ({ seq: ++seq, at, sessionId: 'ses_1', data })
  const upsert = (s: Segment) => ev({ type: 'segment.upserted', segment: s })
  const speaker = (id: string, label: string): Speaker => ({
    id,
    sessionId: 'ses_1',
    label,
    named: true,
    colour: 0,
    voiceprintId: null,
    mergedInto: null,
    createdAt: at,
  })
  const far = (id: string, speakerId?: string) =>
    seg({ id, track: 'system', speaker: speakerId ? `Speaker ${speakerId}` : 'them', speakerId })
  const view = (m: Map<string, Segment>) =>
    Object.fromEntries([...m].map(([id, s]) => [id, `${s.speaker}/${s.speakerId ?? '-'}`]))

  it("a rename relabels exactly that speaker's segments", () => {
    const folded = foldSegments([
      upsert(far('a', 'spk_1')),
      upsert(far('b', 'spk_2')),
      upsert(seg({ id: 'm' })),
      ev({ type: 'speaker.upserted', speaker: speaker('spk_1', 'Ana') }),
    ])
    expect(view(folded)).toEqual({ a: 'Ana/spk_1', b: 'Speaker spk_2/spk_2', m: 'me/-' })
  })

  it("a merge moves the source speaker's segments onto the target, under the target's label", () => {
    const folded = foldSegments([
      ev({ type: 'speaker.upserted', speaker: speaker('spk_2', 'Bo') }),
      upsert(far('a', 'spk_1')),
      upsert({ ...far('b', 'spk_2'), speaker: 'Bo' }),
      upsert(far('c', 'spk_3')),
      ev({ type: 'speaker.merged', sessionId: 'ses_1', fromId: 'spk_1', intoId: 'spk_2' }),
    ])
    expect(view(folded)).toEqual({ a: 'Bo/spk_2', b: 'Bo/spk_2', c: 'Speaker spk_3/spk_3' })
  })

  it("a merge into a speaker whose label was never logged keeps the segment's own label", () => {
    const folded = foldSegments([
      upsert(far('a', 'spk_1')),
      ev({ type: 'speaker.merged', sessionId: 'ses_1', fromId: 'spk_1', intoId: 'spk_9' }),
    ])
    expect(view(folded)).toEqual({ a: 'Speaker spk_1/spk_9' })
  })

  it('an attribution moves exactly the listed segments, and a later rename follows them', () => {
    const folded = foldSegments([
      ev({ type: 'speaker.upserted', speaker: speaker('spk_1', 'Speaker 1') }),
      upsert(far('a')),
      upsert(far('b')),
      upsert(far('c', 'spk_3')),
      ev({
        type: 'segments.attributed',
        sessionId: 'ses_1',
        speakerId: 'spk_1',
        segmentIds: ['a', 'c', 'nope'],
        by: 'auto',
      }),
      ev({ type: 'speaker.upserted', speaker: speaker('spk_1', 'Cy') }),
    ])
    expect(view(folded)).toEqual({ a: 'Cy/spk_1', b: 'them/-', c: 'Cy/spk_1' })
    expect(folded.has('nope')).toBe(false)
  })
})

describe('checkAttribution', () => {
  it('accepts the user on the mic and anyone else on the far end', () => {
    expect(
      checkAttribution([
        seg({ id: 'm' }),
        seg({ id: 't', track: 'system', speaker: 'them' }),
        seg({ id: 's', track: 'system', speaker: 'Ana', speakerId: 'spk_1' }),
        // "Mehmet" is not "me"
        seg({ id: 'x', track: 'system', speaker: 'Mehmet' }),
      ]),
    ).toEqual([])
  })

  it('a mic segment must be "me" and carry no far-end speaker id', () => {
    expect(
      checkAttribution([
        seg({ id: 'a', speaker: 'them' }),
        seg({ id: 'b', speakerId: 'spk_1' }),
        seg({ id: 'c', speaker: 'Ana', speakerId: 'spk_1' }),
      ]),
    ).toEqual([
      { rule: 'mic-is-me', detail: 'a: mic segment is "them"' },
      { rule: 'mic-is-me', detail: 'b: mic segment is "me" (spk_1)' },
      { rule: 'mic-is-me', detail: 'c: mic segment is "Ana" (spk_1)' },
    ])
  })

  it('a far-end segment is never the user, however the label is cased or padded', () => {
    expect(
      checkAttribution([
        seg({ id: 'a', track: 'system', speaker: 'me' }),
        seg({ id: 'b', track: 'system', speaker: ' Me ' }),
        seg({ id: 'c', track: 'system', speaker: 'ME' }),
      ]),
    ).toEqual(
      ['a', 'b', 'c'].map((id) => ({
        rule: 'system-is-not-me',
        detail: `${id}: far-end segment attributed to me`,
      })),
    )
  })
})

describe('assertNoViolations — truncation boundary', () => {
  const n = (k: number) => Array.from({ length: k }, (_, i) => ({ rule: 'r', detail: `d${i}` }))
  const message = (vs: { rule: string; detail: string }[]) => {
    try {
      assertNoViolations(vs)
    } catch (e) {
      return (e as Error).message
    }
    return ''
  }
  it('lists up to 50 in full with no "more" line', () => {
    expect(message(n(1))).toBe('1 invariant violation(s):\n  [r] d0')
    expect(message(n(50)).endsWith('\n  [r] d49')).toBe(true)
    expect(message(n(51)).endsWith('\n  [r] d49\n  …and 1 more')).toBe(true)
  })
})
