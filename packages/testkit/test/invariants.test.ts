import type { Segment } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import {
  assertNoViolations,
  checkEventLog,
  checkSegmentHistory,
  checkSegments,
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
