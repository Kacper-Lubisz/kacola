import { fromSummaries } from '@kacola/ui-core/speakers'
import { fromSegments } from '@kacola/ui-core/transcript'
import { describe, expect, it } from 'vitest'
import { slotOf } from '../src/renderer/features/speakers/speaker-chip.tsx'
import {
  buildRows,
  citedIndex,
  findMatches,
  gapsOf,
  rowName,
  splitMatches,
} from '../src/renderer/features/transcript/rows.ts'
import { parseTime } from '../src/renderer/features/transcript/search-params.ts'
import { segment, session } from './helpers.ts'

// The transcript's display rows (features/transcript/rows.ts): pure, so every rule is pinned here and
// the component only renders what this produces.

const S = 's1'
const seg = (id: string, startMs: number, over: Parameters<typeof segment>[2] = {}) =>
  segment(id, S, { startMs, endMs: startMs + 900, text: `line ${id}`, quality: 'final', ...over })

describe('transcript rows', () => {
  const t = fromSegments([
    seg('a', 1000),
    seg('b', 2000),
    seg('c', 5000, { track: 'system', speaker: 'Ana', speakerId: 'spk_1' }),
    seg('d', 9000, { quality: 'live' }),
  ])

  it('names lines exactly like the GTK app (the e2e contract), provisional and in-progress marked', () => {
    const rows = buildRows(t, undefined, {
      mic: { track: 'mic', speaker: 'me', startMs: 12_000, text: 'and so' },
    })
    expect(rows.map(rowName)).toEqual([
      'Me at 0:01: line a',
      'Me at 0:02: line b',
      'Ana at 0:05: line c',
      'Me at 0:09: line d (provisional)',
      'Me at 0:12: and so (in progress)',
    ])
    expect(rows.map((r) => (r.kind === 'gap' ? null : r.groupStart))).toEqual([
      true,
      false,
      true,
      true,
      false,
    ])
  })

  it('drops a partial a segment on its track has already closed over (a late partial never resurrects)', () => {
    const rows = buildRows(t, undefined, {
      mic: { track: 'mic', speaker: 'me', startMs: 9000, text: 'stale' },
    })
    expect(rows.some((r) => r.kind === 'partial')).toBe(false)
  })

  it('merges recorded gaps in by time; a gap starts a new speaker run and both tracks share one marker', () => {
    const gaps = gapsOf(
      session(S, {
        tracks: [
          {
            kind: 'mic',
            device: 'm',
            sampleRate: 16000,
            audioPath: null,
            archivePath: null,
            gaps: [{ atMs: 1500, durationMs: 3000, reason: 'suspend' }],
          },
          {
            kind: 'system',
            device: 's',
            sampleRate: 16000,
            audioPath: null,
            archivePath: null,
            gaps: [
              { atMs: 1500, durationMs: 4000, reason: 'suspend' },
              { atMs: 20_000, durationMs: 1000, reason: 'device switched' },
            ],
          },
        ],
      }),
    )
    expect(gaps).toMatchObject([
      { startMs: 1500, durationMs: 4000, tracks: ['mic', 'system'] },
      { startMs: 20_000, reason: 'device switched' },
    ])
    const partial = { mic: { track: 'mic' as const, speaker: 'me', startMs: 30_000, text: 'now' } }
    const rows = buildRows(t, undefined, partial, gaps)
    expect(rows.map((r) => r.id)).toEqual(['a', 'gap:1500', 'b', 'c', 'd', 'gap:20000', 'partial:mic'])
    // b follows a gap: it shows its speaker again
    expect(rows[2]).toMatchObject({ id: 'b', groupStart: true })
    expect(rowName(rows[1]!)).toBe('Recording gap at 0:01, 0:04: suspend')
  })

  it('takes chip colours and the freshest names from the speaker list', () => {
    const sp = fromSummaries([
      {
        id: 'me',
        label: 'me',
        track: 'mic',
        named: true,
        colour: null,
        voiceprintId: null,
        segments: 3,
        talkMs: 1,
      },
      {
        id: 'spk_1',
        label: 'Ana B.',
        track: 'system',
        named: true,
        colour: 7,
        voiceprintId: null,
        segments: 1,
        talkMs: 1,
      },
    ])
    const c = buildRows(t, sp, undefined).find((r) => r.id === 'c')!
    expect(c).toMatchObject({ speaker: 'Ana B.', colour: 7 })
  })

  it('finds and splits search matches case-insensitively, never in gaps', () => {
    const rows = buildRows(t, undefined, undefined, [
      { id: 'gap:1', kind: 'gap', startMs: 1, durationMs: 1, reason: 'line', tracks: ['mic'] },
    ])
    expect(findMatches(rows, 'LINE ')).toEqual([1, 2, 3, 4])
    expect(findMatches(rows, '  ')).toEqual([])
    expect(splitMatches('Retry the retry', 'retry')).toEqual([
      { text: 'Retry', hit: true },
      { text: ' the ', hit: false },
      { text: 'retry', hit: true },
    ])
    expect(splitMatches('abc', '')).toEqual([{ text: 'abc', hit: false }])
  })

  it('resolves a citation by segment id, else by time (the last line starting at or before it)', () => {
    const rows = buildRows(t, undefined, undefined)
    expect(citedIndex(rows, 'c', undefined)).toBe(2)
    expect(citedIndex(rows, 'nope', 4999)).toBe(1)
    expect(citedIndex(rows, undefined, 5000)).toBe(2)
    expect(citedIndex(rows, undefined, 500)).toBe(-1)
    expect(citedIndex(rows, 'nope', undefined)).toBe(-1)
  })
})

describe('citation search params and chip colours', () => {
  it('parses ?t= as non-negative seconds', () => {
    expect(parseTime('83.5')).toEqual({ t: 83.5 })
    expect(parseTime(12)).toEqual({ t: 12 })
    expect(parseTime('-1')).toEqual({})
    expect(parseTime('x')).toEqual({})
    expect(parseTime('')).toEqual({})
    expect(parseTime(undefined)).toEqual({})
  })

  it('folds the daemon’s 8 palette slots onto the brand’s 6 speaker colours; me is ink, them neutral', () => {
    expect([0, 1, 5, 6, 7].map((c) => slotOf(c, 'Speaker'))).toEqual(['1', '2', '6', '1', '2'])
    expect(slotOf(null, 'me')).toBe('me')
    expect(slotOf(3, 'them')).toBeUndefined()
    expect(slotOf(null, 'Speaker 1')).toBeUndefined()
  })
})
