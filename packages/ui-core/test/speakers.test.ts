import type { AnyEvent, DurableEventData, Segment, Speaker, SpeakerSummary } from '@kacola/protocol'
import { describe, expect, it } from 'vitest'
import {
  applySpeakerEvent,
  emptySpeakers,
  fromSummaries,
  SpeakersFeed,
  speakerClass,
} from '../src/speakers.ts'
import { applyTranscriptEvent, fromSegments, transcriptRows } from '../src/transcript.ts'

// A-5: the UI folds attribution events exactly like the daemon's store does — the transcript relabels
// in place, merged speakers vanish, colours never move.

const S = 'ses_a'
let seq = 0
const ev = (data: DurableEventData, sessionId: string | null = S): AnyEvent => ({
  seq: ++seq,
  at: '2026-09-29T12:00:00.000Z',
  sessionId,
  data,
})

const summary = (id: string, label: string, colour: number | null, over: Partial<SpeakerSummary> = {}) =>
  ({
    id,
    label,
    track: id === 'me' ? 'mic' : 'system',
    named: false,
    colour,
    voiceprintId: null,
    segments: 1,
    talkMs: 1000,
    ...over,
  }) as SpeakerSummary

const speaker = (id: string, label: string, colour: number, over: Partial<Speaker> = {}): Speaker => ({
  id,
  sessionId: S,
  label,
  named: false,
  colour,
  voiceprintId: null,
  mergedInto: null,
  createdAt: '2026-09-29T12:00:00.000Z',
  ...over,
})

const seg = (id: string, track: 'mic' | 'system', startMs: number, over: Partial<Segment> = {}): Segment => ({
  id,
  sessionId: S,
  track,
  speaker: track === 'mic' ? 'me' : 'them',
  startMs,
  endMs: startMs + 1000,
  text: `line ${id}`,
  quality: 'final',
  revision: 1,
  confidence: null,
  ...over,
})

describe('speakers fold', () => {
  const base = fromSummaries([
    summary('them', 'them', null),
    summary('spk_b', 'Speaker 2', 1),
    summary('me', 'me', null),
    summary('spk_a', 'Speaker 1', 0),
  ])

  it('orders me first, far-end speakers in creation order, them last', () => {
    expect(base.list.map((s) => s.id)).toEqual(['me', 'spk_b', 'spk_a', 'them'])
  })

  it('a rename changes the label and keeps the colour and the numbers', () => {
    const r = applySpeakerEvent(
      base,
      S,
      ev({ type: 'speaker.upserted', speaker: speaker('spk_a', 'Ana', 0, { named: true }) }),
    )
    expect(r.state.byId.get('spk_a')).toMatchObject({ label: 'Ana', colour: 0, named: true, segments: 1 })
    expect(r.stale).toBe(false)
  })

  it('a new speaker is appended before `them`; another session is ignored', () => {
    const r = applySpeakerEvent(
      base,
      S,
      ev({ type: 'speaker.upserted', speaker: speaker('spk_c', 'Speaker 3', 2) }),
    )
    expect(r.state.list.map((s) => s.id)).toEqual(['me', 'spk_b', 'spk_a', 'spk_c', 'them'])
    const other = applySpeakerEvent(
      base,
      S,
      ev({ type: 'speaker.upserted', speaker: { ...speaker('spk_x', 'X', 3), sessionId: 'ses_other' } }),
    )
    expect(other.state).toBe(base)
  })

  it('a merge folds the counts into the survivor and drops the merged speaker', () => {
    const r = applySpeakerEvent(
      base,
      S,
      ev({ type: 'speaker.merged', sessionId: S, fromId: 'spk_b', intoId: 'spk_a' }),
    )
    expect(r.state.list.map((s) => s.id)).toEqual(['me', 'spk_a', 'them'])
    expect(r.state.byId.get('spk_a')).toMatchObject({ segments: 2, talkMs: 2000, colour: 0 })
    // a merged tombstone's own upsert also removes it
    const t = applySpeakerEvent(
      base,
      S,
      ev({ type: 'speaker.upserted', speaker: speaker('spk_b', 'Speaker 2', 1, { mergedInto: 'spk_a' }) }),
    )
    expect(t.state.byId.has('spk_b')).toBe(false)
  })

  it('attributions and far-end segments make the numbers stale (the feed refetches)', () => {
    expect(
      applySpeakerEvent(
        base,
        S,
        ev({ type: 'segments.attributed', sessionId: S, speakerId: 'spk_a', segmentIds: ['g1'], by: 'auto' }),
      ).stale,
    ).toBe(true)
    expect(
      applySpeakerEvent(base, S, ev({ type: 'segment.upserted', segment: seg('g9', 'system', 0) })).stale,
    ).toBe(true)
    expect(applySpeakerEvent(emptySpeakers, S, ev({ type: 'session.deleted', sessionId: S })).stale).toBe(
      false,
    )
  })

  it('chip classes come from the daemon colour, never the list position', () => {
    expect(speakerClass(base.byId.get('spk_a'), 'Speaker 1')).toBe('speaker-c0')
    expect(speakerClass(base.byId.get('spk_b'), 'Speaker 2')).toBe('speaker-c1')
    expect(speakerClass(summary('spk_z', 'Z', 11), 'Z')).toBe('speaker-c3')
    expect(speakerClass(base.byId.get('me'), 'me')).toBe('speaker-me')
    expect(speakerClass(undefined, 'them')).toBe('speaker-them')
  })
})

describe('transcript fold of attribution events (as the daemon store applies them)', () => {
  const t0 = fromSegments([
    seg('m1', 'mic', 0),
    seg('g1', 'system', 1000, { speakerId: 'spk_a', speaker: 'Speaker 1' }),
    seg('g2', 'system', 2000, { speakerId: 'spk_a', speaker: 'Speaker 1' }),
    seg('g3', 'system', 3000),
  ])

  it('a rename relabels every segment of that speaker in place, without a new revision', () => {
    const t = applyTranscriptEvent(
      t0,
      S,
      ev({ type: 'speaker.upserted', speaker: speaker('spk_a', 'Ana', 0) }),
    )
    expect(t.ordered.map((s) => s.speaker)).toEqual(['me', 'Ana', 'Ana', 'them'])
    expect(t.byId.get('g1')!.revision).toBe(1)
    // …so a replayed older upsert of the same revision does not undo it
    expect(t.byId.get('g1')!.speaker).toBe('Ana')
  })

  it('attribution moves exactly the listed far-end segments, never a mic one', () => {
    let t = applyTranscriptEvent(
      t0,
      S,
      ev({ type: 'speaker.upserted', speaker: speaker('spk_b', 'Speaker 2', 1) }),
    )
    t = applyTranscriptEvent(
      t,
      S,
      ev({
        type: 'segments.attributed',
        sessionId: S,
        speakerId: 'spk_b',
        segmentIds: ['g3', 'm1'],
        by: 'user',
      }),
    )
    expect(t.ordered.map((s) => [s.id, s.speaker, s.speakerId ?? null])).toEqual([
      ['m1', 'me', null],
      ['g1', 'Speaker 1', 'spk_a'],
      ['g2', 'Speaker 1', 'spk_a'],
      ['g3', 'Speaker 2', 'spk_b'],
    ])
  })

  it('a merge moves the merged speaker’s segments to the survivor with its label', () => {
    let t = applyTranscriptEvent(t0, S, ev({ type: 'speaker.upserted', speaker: speaker('spk_b', 'Ben', 1) }))
    t = applyTranscriptEvent(
      t,
      S,
      ev({ type: 'speaker.merged', sessionId: S, fromId: 'spk_a', intoId: 'spk_b' }),
    )
    expect(
      t.ordered.filter((s) => s.track === 'system').map((s) => [s.speaker, s.speakerId ?? null]),
    ).toEqual([
      ['Ben', 'spk_b'],
      ['Ben', 'spk_b'],
      ['them', null],
    ])
  })

  it('rows take names and chip colours from the speaker list, and group by speaker id', () => {
    const speakers = fromSummaries([
      summary('me', 'me', null),
      summary('spk_a', 'Ana', 4),
      summary('them', 'them', null),
    ])
    const rows = transcriptRows(t0, speakers)
    expect(rows.map((r) => [r.speaker, r.colour, r.groupStart])).toEqual([
      ['me', null, true],
      ['Ana', 4, true],
      ['Ana', 4, false],
      ['them', null, true],
    ])
  })
})

describe('SpeakersFeed', () => {
  it('loads, folds events that arrive during the fetch, and refetches stale numbers', async () => {
    const listeners = new Set<(e: AnyEvent) => void>()
    let loads = 0
    let release: (() => void) | null = null
    const timers: (() => void)[] = []
    const feed = new SpeakersFeed(S, {
      load: async () => {
        loads++
        if (loads === 1) await new Promise<void>((r) => (release = r))
        return [
          summary('me', 'me', null),
          summary('spk_a', loads === 1 ? 'Speaker 1' : 'Ana', 0, { segments: loads }),
        ]
      },
      onEvent: (l) => {
        listeners.add(l)
        return () => listeners.delete(l)
      },
      setTimeout: (fn) => timers.push(fn),
      clearTimeout: () => {},
    }).start()
    expect(feed.getSnapshot().status).toBe('loading')
    for (const l of listeners) l(ev({ type: 'speaker.upserted', speaker: speaker('spk_a', 'Ana', 0) }))
    release!()
    await new Promise((r) => setTimeout(r, 0))
    expect(feed.getSnapshot()).toMatchObject({ status: 'ready' })
    expect(feed.getSnapshot().speakers.byId.get('spk_a')!.label).toBe('Ana')
    for (const l of listeners)
      l(ev({ type: 'segments.attributed', sessionId: S, speakerId: 'spk_a', segmentIds: ['g'], by: 'auto' }))
    expect(timers).toHaveLength(1)
    timers[0]!()
    await new Promise((r) => setTimeout(r, 0))
    expect(feed.getSnapshot().speakers.byId.get('spk_a')!.segments).toBe(2)
    feed.dispose()
    expect(listeners.size).toBe(0)
  })
})
