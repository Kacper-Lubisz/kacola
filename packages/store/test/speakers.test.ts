import { newId, type Segment } from '@kacola/protocol'
import { assertNoViolations, checkAttribution, foldSegments } from '@kacola/testkit/invariants'
import { describe, expect, it } from 'vitest'
import { Store, StoreError } from '../src/index.ts'

// A-1 — speakers, attribution and voiceprints in the store: durable, replayable, and never able to
// attribute the microphone to anyone but the user.

function setup() {
  const s = Store.open(':memory:')
  const ses = s.createSession({ title: 'planning' })
  const seg = (track: 'mic' | 'system', startMs: number, over: Partial<Segment> = {}) =>
    s.upsertSegment({
      id: newId('seg'),
      sessionId: ses.id,
      track,
      speaker: track === 'mic' ? 'me' : 'them',
      startMs,
      endMs: startMs + 1000,
      text: `words at ${startMs}`,
      quality: 'live',
      confidence: null,
      ...over,
    })
  return { s, ses, seg }
}

const replayed = (s: Store) => {
  const dst = Store.open(':memory:')
  dst.replay(s.eventsAfter(0))
  return dst
}

describe('speakers', () => {
  it('are "Speaker N" with the next colour until named, in creation order', () => {
    const { s, ses } = setup()
    const a = s.createSpeaker(ses.id)
    const b = s.createSpeaker(ses.id)
    const c = s.createSpeaker(ses.id, { label: 'Ana' })
    expect([a.label, b.label, c.label]).toEqual(['Speaker 1', 'Speaker 2', 'Ana'])
    expect([a.colour, b.colour, c.colour]).toEqual([0, 1, 2])
    expect([a.named, c.named]).toEqual([false, true])
    expect(s.speakers(ses.id).map((x) => x.id)).toEqual([a.id, b.id, c.id])
    // numbering continues past the highest in use, even after a merge
    s.mergeSpeakers(ses.id, b.id, a.id)
    expect(s.createSpeaker(ses.id).label).toBe('Speaker 3')
  })

  it('a rename relabels every segment of theirs, and filters follow the new name', () => {
    const { s, ses, seg } = setup()
    const spk = s.createSpeaker(ses.id)
    const g1 = seg('system', 0, { text: 'the retry budget is three attempts' })
    const g2 = seg('system', 2000)
    seg('mic', 1000)
    s.attributeSegments(ses.id, spk.id, [g1.id, g2.id], 'auto')
    expect(s.getSegment(g1.id)).toMatchObject({ speaker: 'Speaker 1', speakerId: spk.id })
    s.renameSpeaker(ses.id, spk.id, '  Ana  ')
    expect(s.getSegment(g1.id)!.speaker).toBe('Ana')
    expect(s.transcript(ses.id, { speaker: 'ana' }).segments.map((x) => x.id)).toEqual([g1.id, g2.id])
    expect(s.transcript(ses.id, { speaker: spk.id }).segments).toHaveLength(2)
    expect(s.transcript(ses.id, { speaker: 'me' }).segments).toHaveLength(1)
    expect(s.search({ q: 'retry budget', speaker: 'Ana' }).hits.map((h) => h.segmentId)).toEqual([g1.id])
    expect(s.search({ q: 'retry budget', speaker: 'Ana' }).hits[0]!.speaker).toBe('Ana')
    expect(replayed(s).dump()).toBe(s.dump())
  })

  it('refuses reserved and duplicate labels — a far-end speaker can never be "me"', () => {
    const { s, ses } = setup()
    const a = s.createSpeaker(ses.id, { label: 'Ana' })
    const b = s.createSpeaker(ses.id)
    for (const bad of ['me', 'ME', ' Me ', 'them'])
      expect(() => s.renameSpeaker(ses.id, b.id, bad), bad).toThrow(/reserved/)
    expect(() => s.createSpeaker(ses.id, { label: 'me' })).toThrow(/reserved/)
    expect(() => s.renameSpeaker(ses.id, b.id, 'ana')).toThrow(/merge them instead/)
    // renaming to your own name (other case) is fine
    expect(s.renameSpeaker(ses.id, a.id, 'ANA').label).toBe('ANA')
    expect(() => s.renameSpeaker(ses.id, 'spk_nope', 'Zed')).toThrow(StoreError)
  })

  it('an attributed segment keeps its speaker through later upserts (live → final)', () => {
    const { s, ses, seg } = setup()
    const spk = s.createSpeaker(ses.id, { label: 'Ben' })
    const g = seg('system', 0)
    s.attributeSegments(ses.id, spk.id, [g.id], 'auto')
    const cur = s.getSegment(g.id)!
    // the pipeline does not know about attribution: it re-emits `them` and no speaker id
    const { speakerId: _drop, ...plain } = cur
    s.upsertSegment({ ...plain, speaker: 'them', text: 'final words', quality: 'final' })
    expect(s.getSegment(g.id)).toMatchObject({
      speaker: 'Ben',
      speakerId: spk.id,
      quality: 'final',
      revision: 2,
    })
    // and a producer naming a different speaker on a later upsert does not move it either
    const other = s.createSpeaker(ses.id)
    s.upsertSegment({ ...plain, speakerId: other.id, text: 'x', quality: 'final' })
    expect(s.getSegment(g.id)!.speakerId).toBe(spk.id)
  })

  it('a new segment may be born attributed, and a merged speaker id still resolves', () => {
    const { s, ses, seg } = setup()
    const a = s.createSpeaker(ses.id)
    const b = s.createSpeaker(ses.id, { label: 'Priya' })
    s.mergeSpeakers(ses.id, a.id, b.id)
    const g = seg('system', 0, { speakerId: a.id })
    expect(s.getSegment(g.id)).toMatchObject({ speakerId: b.id, speaker: 'Priya' })
    expect(s.resolveSpeaker(a.id)!.id).toBe(b.id)
    expect(() => seg('mic', 0, { speakerId: b.id })).toThrow(/only far-end/)
    const other = s.createSession({})
    expect(() => s.upsertSegment({ ...g, id: newId('seg'), sessionId: other.id, speakerId: b.id })).toThrow(
      /no speaker/,
    )
  })

  it('the diarizer never overrides a person; a person overrides the diarizer', () => {
    const { s, ses, seg } = setup()
    const a = s.createSpeaker(ses.id)
    const b = s.createSpeaker(ses.id)
    const g1 = seg('system', 0)
    const g2 = seg('system', 2000)
    expect(s.attributeSegments(ses.id, a.id, [g1.id, g2.id], 'auto')).toEqual([g1.id, g2.id].sort())
    expect(s.attributeSegments(ses.id, b.id, [g1.id], 'user')).toEqual([g1.id])
    // re-clustering later wants g1 and g2 on a again: only g2 is the diarizer's to move
    const before = s.lastSeq()
    expect(s.attributeSegments(ses.id, a.id, [g1.id, g2.id], 'auto')).toEqual([])
    expect(s.lastSeq()).toBe(before) // nothing moved, nothing written
    expect(s.attributeSegments(ses.id, b.id, [g2.id], 'auto')).toEqual([g2.id])
    expect(s.getSegment(g1.id)!.speakerId).toBe(b.id)
    // a mic segment can never be attributed, by anyone
    const m = seg('mic', 500)
    expect(() => s.attributeSegments(ses.id, a.id, [m.id], 'user')).toThrow(/always "me"/)
    expect(() => s.attributeSegments(ses.id, a.id, [m.id], 'auto')).toThrow(/always "me"/)
    expect(() => s.attributeSegments(ses.id, a.id, ['seg_nope'], 'user')).toThrow(/no segment/)
    expect(replayed(s).dump()).toBe(s.dump())
  })

  it('merge moves every segment, leaves a tombstone, and is a person’s decision', () => {
    const { s, ses, seg } = setup()
    const a = s.createSpeaker(ses.id, { label: 'Ana' })
    const b = s.createSpeaker(ses.id)
    const c = s.createSpeaker(ses.id)
    const g = [seg('system', 0), seg('system', 2000), seg('system', 4000)]
    s.attributeSegments(ses.id, b.id, [g[0]!.id, g[1]!.id], 'auto')
    s.attributeSegments(ses.id, c.id, [g[2]!.id], 'auto')
    s.mergeSpeakers(ses.id, c.id, b.id)
    s.mergeSpeakers(ses.id, b.id, a.id) // c's tombstone now points straight at a
    expect(s.speakers(ses.id).map((x) => x.id)).toEqual([a.id])
    expect(s.getSpeaker(c.id)!.mergedInto).toBe(a.id)
    for (const x of g) expect(s.getSegment(x.id)).toMatchObject({ speakerId: a.id, speaker: 'Ana' })
    // merged segments are now the user's decision: re-clustering cannot pull them apart
    const d = s.createSpeaker(ses.id)
    expect(s.attributeSegments(ses.id, d.id, [g[0]!.id], 'auto')).toEqual([])
    expect(() => s.mergeSpeakers(ses.id, b.id, a.id)).toThrow(/already merged/)
    expect(() => s.mergeSpeakers(ses.id, a.id, a.id)).toThrow(/itself/)
    expect(() => s.renameSpeaker(ses.id, b.id, 'X')).toThrow(/merged/)
    expect(replayed(s).dump()).toBe(s.dump())
  })

  it('split moves chosen segments to a new speaker; unattributed speech can be split off `them`', () => {
    const { s, ses, seg } = setup()
    const a = s.createSpeaker(ses.id)
    const g = [seg('system', 0), seg('system', 2000), seg('system', 4000)]
    s.attributeSegments(ses.id, a.id, [g[0]!.id, g[1]!.id], 'auto')
    const n = s.splitSpeaker(ses.id, a.id, [g[1]!.id])
    expect(n.label).toBe('Speaker 2')
    expect(s.getSegment(g[1]!.id)!.speakerId).toBe(n.id)
    expect(s.getSegment(g[0]!.id)!.speakerId).toBe(a.id)
    const t = s.splitSpeaker(ses.id, 'them', [g[2]!.id])
    expect(s.getSegment(g[2]!.id)!.speakerId).toBe(t.id)
    const m = seg('mic', 100)
    const seq = s.lastSeq()
    expect(() => s.splitSpeaker(ses.id, a.id, [m.id])).toThrow(/always "me"/)
    expect(() => s.splitSpeaker(ses.id, a.id, [g[2]!.id])).toThrow(/not spk_/)
    expect(() => s.splitSpeaker(ses.id, a.id, [])).toThrow(/nothing/)
    expect(s.lastSeq()).toBe(seq) // a refused split writes nothing, not even the new speaker
    expect(replayed(s).dump()).toBe(s.dump())
  })

  it('summarises who spoke how much, with me first and `them` only when something is unattributed', () => {
    const { s, ses, seg } = setup()
    const a = s.createSpeaker(ses.id, { label: 'Ana' })
    seg('mic', 0)
    seg('mic', 5000)
    const g = seg('system', 1000)
    expect(s.speakerSummaries(ses.id).map((x) => [x.id, x.segments, x.talkMs])).toEqual([
      ['me', 2, 2000],
      [a.id, 0, 0],
      ['them', 1, 1000],
    ])
    s.attributeSegments(ses.id, a.id, [g.id], 'auto')
    expect(s.speakerSummaries(ses.id).map((x) => [x.label, x.segments])).toEqual([
      ['me', 2],
      ['Ana', 1],
    ])
  })

  it('voiceprints: upsert, link, delete unlinks', () => {
    const { s, ses } = setup()
    const now = new Date().toISOString()
    const v = s.upsertVoiceprint({
      id: newId('vp'),
      name: 'Ana',
      model: 'emb',
      embedding: [0.5, -0.25, 1e-7],
      samples: 1,
      createdAt: now,
      updatedAt: now,
    })
    expect(s.getVoiceprint(v.id)).toEqual(v)
    const a = s.createSpeaker(ses.id)
    expect(s.linkVoiceprint(ses.id, a.id, v.id, 'Ana')).toMatchObject({
      voiceprintId: v.id,
      label: 'Ana',
      named: true,
    })
    expect(() => s.linkVoiceprint(ses.id, a.id, 'vp_nope')).toThrow(/no voiceprint/)
    s.deleteVoiceprint(v.id)
    expect(s.getSpeaker(a.id)!.voiceprintId).toBeNull()
    expect(s.voiceprints()).toEqual([])
    expect(() => s.deleteVoiceprint(v.id)).toThrow(/no voiceprint/)
    expect(replayed(s).dump()).toBe(s.dump())
  })

  it('deleting a session deletes its speakers; the fold of the log agrees with the tables', () => {
    const { s, ses, seg } = setup()
    const a = s.createSpeaker(ses.id)
    const g = seg('system', 0)
    seg('mic', 0)
    s.attributeSegments(ses.id, a.id, [g.id], 'auto')
    s.renameSpeaker(ses.id, a.id, 'Ana')
    const folded = [...foldSegments(s.eventsAfter(0)).values()]
    expect(folded.sort((x, y) => x.id.localeCompare(y.id))).toEqual(
      s.segments(ses.id).sort((x, y) => x.id.localeCompare(y.id)),
    )
    assertNoViolations(checkAttribution(s.segments(ses.id)))
    s.deleteSession(ses.id)
    expect(s.speakers(ses.id, { includeMerged: true })).toEqual([])
  })
})
