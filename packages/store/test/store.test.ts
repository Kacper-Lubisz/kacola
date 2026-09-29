import type { QaMessage, Segment, StoredSettings, TrackKind } from '@gnomeola/protocol'
import { newId } from '@gnomeola/protocol'
import { pick, randInt, seededRandom } from '@gnomeola/testkit/daemon'
import {
  assertNoViolations,
  checkEventLog,
  checkSegmentHistory,
  foldSegments,
} from '@gnomeola/testkit/invariants'
import { describe, expect, it } from 'vitest'
import { Store, StoreError } from '../src/index.ts'

const mem = (now?: () => Date) => Store.open(':memory:', now ? { now } : {})

function tickingClock(start = Date.parse('2026-09-01T09:00:00.000Z')) {
  let t = start
  return () => {
    t += 1000
    return new Date(t)
  }
}

const seg = (sessionId: string, over: Partial<Segment> = {}): Omit<Segment, 'revision'> => ({
  id: over.id ?? newId('seg'),
  sessionId,
  track: over.track ?? 'mic',
  speaker: over.speaker ?? (over.track === 'system' ? 'them' : 'me'),
  startMs: over.startMs ?? 0,
  endMs: over.endMs ?? 1000,
  text: over.text ?? 'hello world',
  quality: over.quality ?? 'live',
  confidence: over.confidence ?? null,
})

describe('commit: state and log in one transaction', () => {
  it('appends a gap-free, strictly increasing log with every state change', () => {
    const s = mem()
    const a = s.createSession({ title: 'A' })
    s.updateSession(a.id, (x) => ({ ...x, title: 'A2' }))
    s.upsertSegment(seg(a.id))
    s.putSettings(defaultsForTest())
    const events = s.eventsAfter(0)
    expect(events.map((e) => e.data.type)).toEqual([
      'session.upserted',
      'session.upserted',
      'segment.upserted',
      'settings.updated',
    ])
    assertNoViolations(checkEventLog(events))
    expect(s.lastSeq()).toBe(4)
    expect(s.eventsAfter(2).map((e) => e.seq)).toEqual([3, 4])
    expect(s.eventsAfter(0, { limit: 2 }).map((e) => e.seq)).toEqual([1, 2])
    expect(s.eventsAfter(0, { sessionId: a.id }).map((e) => e.seq)).toEqual([1, 2, 3])
  })

  it('writes nothing — neither state nor log — when a change is refused', () => {
    const s = mem()
    const a = s.createSession({})
    const before = s.dump()
    expect(() => s.updateSession('ses_nope', (x) => x)).toThrow(StoreError)
    expect(() =>
      s.updateSession(a.id, () => {
        throw new StoreError('conflict', 'nope')
      }),
    ).toThrow(/nope/)
    expect(s.lastSeq()).toBe(1)
    expect(s.dump()).toBe(before)
  })

  it('notifies listeners after commit, once each, in seq order — even for commits made by a listener', () => {
    const s = mem()
    const seen: number[] = []
    let nested = false
    s.onCommit((e) => {
      // the transaction is over: the event is visible to readers
      expect(s.lastSeq()).toBeGreaterThanOrEqual(e.seq)
      seen.push(e.seq)
      if (!nested) {
        nested = true
        s.createSession({ title: 'from listener' })
      }
    })
    const other: number[] = []
    s.onCommit((e) => other.push(e.seq))
    s.createSession({})
    s.createSession({})
    expect(seen).toEqual([1, 2, 3])
    expect(other).toEqual([1, 2, 3])
  })
})

describe('segments', () => {
  it('assigns revisions and allows live -> final', () => {
    const s = mem()
    const a = s.createSession({})
    const id = newId('seg')
    expect(s.upsertSegment(seg(a.id, { id, text: 'helo' })).revision).toBe(1)
    expect(s.upsertSegment(seg(a.id, { id, text: 'hello' })).revision).toBe(2)
    const fin = s.upsertSegment(seg(a.id, { id, text: 'Hello.', quality: 'final' }))
    expect(fin).toMatchObject({ revision: 3, quality: 'final', text: 'Hello.' })
    expect(s.segments(a.id)).toEqual([fin])
    const history = s
      .eventsAfter(0)
      .flatMap((e) => (e.data.type === 'segment.upserted' ? [e.data.segment] : []))
    assertNoViolations(checkSegmentHistory(history))
  })

  it('refuses every invariant violation and writes nothing', () => {
    const s = mem()
    const a = s.createSession({})
    const b = s.createSession({})
    const id = newId('seg')
    s.upsertSegment(seg(a.id, { id, quality: 'final' }))
    const seq = s.lastSeq()
    const bad: [string, Omit<Segment, 'revision'>][] = [
      ['final->live', seg(a.id, { id, quality: 'live' })],
      ['track change', seg(a.id, { id, track: 'system', quality: 'final' })],
      ['session change', seg(b.id, { id, quality: 'final' })],
      ['mic not me', seg(a.id, { track: 'mic', speaker: 'ana' })],
      ['system is me', seg(a.id, { track: 'system', speaker: 'me' })],
      ['empty speaker', seg(a.id, { track: 'system', speaker: '' })],
      ['end before start', seg(a.id, { startMs: 500, endMs: 100 })],
      ['unknown session', seg('ses_missing')],
    ]
    for (const [name, input] of bad) expect(() => s.upsertSegment(input), name).toThrow(StoreError)
    expect(s.lastSeq()).toBe(seq)
  })
})

describe('sessions', () => {
  it('lists newest first, hides private unless asked, honours since and limit', () => {
    const s = mem(tickingClock())
    const a = s.createSession({ title: 'a' })
    const b = s.createSession({ title: 'b', private: true })
    const c = s.createSession({ title: 'c' })
    expect(s.listSessions().map((x) => x.id)).toEqual([c.id, a.id])
    expect(s.listSessions({ includePrivate: true }).map((x) => x.id)).toEqual([c.id, b.id, a.id])
    expect(s.listSessions({ includePrivate: true, limit: 1 }).map((x) => x.id)).toEqual([c.id])
    expect(s.listSessions({ since: new Date(b.createdAt) }).map((x) => x.id)).toEqual([c.id])
  })

  it('round-trips tracks and gaps', () => {
    const s = mem()
    const a = s.createSession({})
    const tracks = [
      {
        kind: 'mic' as const,
        device: 'alsa_input.x',
        sampleRate: 16000,
        audioPath: '/a/mic.wav',
        archivePath: null,
        gaps: [],
      },
      {
        kind: 'system' as const,
        device: 'alsa_output.y.monitor',
        sampleRate: 16000,
        audioPath: '/a/system.wav',
        archivePath: null,
        gaps: [{ atMs: 1000, durationMs: 250, reason: 'device switch' }],
      },
    ]
    s.updateSession(a.id, (x) => ({ ...x, tracks }))
    expect(s.getSession(a.id)?.tracks).toEqual(tracks)
    s.updateSession(a.id, (x) => ({ ...x, tracks: tracks.slice(0, 1) }))
    expect(s.getSession(a.id)?.tracks).toEqual(tracks.slice(0, 1))
  })

  it('deletes a session with its tracks, segments, Q&A and search index entries', () => {
    const s = mem()
    const a = s.createSession({})
    const keep = s.createSession({})
    s.upsertSegment(seg(a.id, { text: 'zebra crossing' }))
    s.upsertSegment(seg(keep.id, { text: 'zebra stripes' }))
    s.addQaMessage(qa(a.id))
    s.deleteSession(a.id)
    expect(s.getSession(a.id)).toBeNull()
    expect(s.segments(a.id)).toEqual([])
    expect(s.qaHistory(a.id)).toEqual([])
    expect(s.search({ q: 'zebra' }).hits.map((h) => h.sessionId)).toEqual([keep.id])
    s.checkFts()
    expect(() => s.deleteSession(a.id)).toThrow(StoreError)
  })
})

describe('transcript windows', () => {
  const s = mem()
  const a = s.createSession({})
  const segs = [
    s.upsertSegment(seg(a.id, { startMs: 0, endMs: 1000, text: 'one' })),
    s.upsertSegment(seg(a.id, { track: 'system', startMs: 500, endMs: 1500, text: 'two', quality: 'final' })),
    s.upsertSegment(seg(a.id, { startMs: 2000, endMs: 3000, text: 'three', quality: 'final' })),
    s.upsertSegment(seg(a.id, { track: 'system', speaker: 'Ana', startMs: 4000, endMs: 5000, text: 'four' })),
  ]

  it('returns everything with a null window by default', () => {
    const t = s.transcript(a.id)
    expect(t.segments.map((x) => x.text)).toEqual(['one', 'two', 'three', 'four'])
    expect(t.window).toBeNull()
    expect(t.total).toBe(4)
  })

  it('selects overlapping segments, inclusive, and reports the applied window', () => {
    expect(s.transcript(a.id, { fromMs: 1200, toMs: 2000 }).segments.map((x) => x.text)).toEqual([
      'two',
      'three',
    ])
    const t = s.transcript(a.id, { fromMs: 3500 })
    expect(t.segments.map((x) => x.text)).toEqual(['four'])
    expect(t.window).toEqual({ fromMs: 3500, toMs: 5000 })
    expect(t.total).toBe(4)
    expect(s.transcript(a.id, { toMs: 400 }).window).toEqual({ fromMs: 0, toMs: 400 })
  })

  it('filters by speaker (case-insensitive), track and quality', () => {
    expect(s.transcript(a.id, { speaker: 'ana' }).segments.map((x) => x.text)).toEqual(['four'])
    expect(s.transcript(a.id, { track: 'system' }).segments.map((x) => x.text)).toEqual(['two', 'four'])
    expect(s.transcript(a.id, { quality: 'final' }).segments.map((x) => x.text)).toEqual(['two', 'three'])
    expect(s.transcript(a.id, { quality: 'live' }).segments.map((x) => x.text)).toEqual(['one', 'four'])
    expect(s.transcript(a.id, { quality: 'best' }).segments).toEqual(segs)
  })

  it('rejects an inverted window and an unknown session', () => {
    expect(() => s.transcript(a.id, { fromMs: 10, toMs: 5 })).toThrow(/toMs/)
    expect(() => s.transcript('ses_missing')).toThrow(StoreError)
  })
})

describe('replay reproduces the store byte-for-byte', () => {
  for (const seed of [1, 7, 42, 1337]) {
    it(`random history, seed ${seed}`, () => {
      const rnd = seededRandom(seed)
      const src = mem(tickingClock())
      const log = randomHistory(src, rnd, 600)
      const events = src.eventsAfter(0)
      expect(events.length).toBe(log)
      assertNoViolations(checkEventLog(events))
      // the history exercises every kind of event, attribution (M3) included
      const kinds = new Set(events.map((e) => e.data.type))
      for (const k of ['speaker.upserted', 'speaker.merged', 'segments.attributed', 'voiceprint.upserted'])
        expect(kinds, k).toContain(k)

      const dst = mem(() => new Date('2000-01-01T00:00:00Z')) // a different clock must not matter
      expect(dst.replay(events, 37)).toBe(events.length)
      expect(dst.dump()).toBe(src.dump())
      expect(dst.eventsAfter(0)).toEqual(events)
      expect(dst.lastSeq()).toBe(src.lastSeq())
      src.checkFts()
      dst.checkFts()

      // the segment table equals the fold of the log
      const folded = foldSegments(events)
      const live = new Set(src.listSessions({ includePrivate: true, limit: 500 }).map((x) => x.id))
      const expected = [...folded.values()].filter((g) => live.has(g.sessionId))
      const actual = [...live].flatMap((id) => src.segments(id))
      expect(actual.sort(byId)).toEqual(expected.sort(byId))

      // and a replayed store keeps working: the next commit continues the sequence
      dst.createSession({})
      expect(dst.lastSeq()).toBe(events.length + 1)
    })
  }

  it('refuses to replay into a non-empty store, or a log with a gap', () => {
    const src = mem()
    src.createSession({})
    src.createSession({})
    src.createSession({})
    const events = src.eventsAfter(0)
    expect(() => src.replay(events)).toThrow(/empty/)
    const dst = mem()
    expect(() => dst.replay([events[0]!, events[2]!])).toThrow(/gap/)
    const dst2 = mem()
    expect(() => dst2.replay(events.slice(1))).toThrow(/gap/)
  })
})

describe('settings', () => {
  it('stores and returns settings, as an event', () => {
    const s = mem()
    expect(s.getSettings()).toBeNull()
    const v = defaultsForTest()
    s.putSettings(v)
    expect(s.getSettings()).toEqual(v)
    expect(s.eventsAfter(0).at(-1)?.data).toEqual({ type: 'settings.updated', settings: v })
  })
})

// ------------------------------------------------------------------ helpers

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function defaultsForTest(): StoredSettings {
  return {
    llm: { provider: 'anthropic', model: 'claude-opus-5', ollamaUrl: 'http://127.0.0.1:11434' },
    stt: { liveModel: 'l', finalModel: 'f', finalPass: 'during' },
    capture: { micDevice: 'default', systemDevice: 'default' },
    retention: { audio: 'keep', days: 30, archive: false },
  }
}

function qa(sessionId: string | null, role: QaMessage['role'] = 'user'): QaMessage {
  return {
    id: newId('qa'),
    sessionId,
    requestId: newId('req'),
    role,
    text: 'what did we decide?',
    citations: [],
    model: role === 'assistant' ? 'claude-opus-5' : null,
    usage: null,
    stopReason: null,
    createdAt: new Date().toISOString(),
  }
}

const WORDS = [
  'retry',
  'budget',
  'migration',
  'thursday',
  'dashboard',
  'café',
  'naïve',
  'ship',
  'zebra',
  'œuvre',
]

const NAMES = ['Ana', 'Ben', 'Priya', 'Zoë', 'Ana-María', 'Sam']

/**
 * One random M3 operation (create / rename / merge / attribute / split / voiceprints), always legal;
 * returns how many events it should have written (0 when there was nothing to do).
 */
function speakerOp(
  s: Store,
  rnd: () => number,
  sessionId: string,
  segIds: Map<string, { id: string; track: TrackKind; final: boolean }[]>,
): number {
  const spk = s.speakers(sessionId)
  const system = (segIds.get(sessionId) ?? []).filter((k) => k.track === 'system').map((k) => k.id)
  const r = rnd()
  if (spk.length < 2 || r < 0.2) {
    const vps = s.voiceprints()
    s.createSpeaker(sessionId, vps.length && rnd() < 0.3 ? { voiceprintId: pick(rnd, vps).id } : {})
    return 1
  }
  if (r < 0.35) {
    const name = `${pick(rnd, NAMES)} ${randInt(rnd, 1, 999)}`
    s.renameSpeaker(sessionId, pick(rnd, spk).id, name)
    return 1
  }
  if (r < 0.5 && spk.length >= 2) {
    const a = pick(rnd, spk)
    const b = pick(
      rnd,
      spk.filter((x) => x.id !== a.id),
    )
    s.mergeSpeakers(sessionId, a.id, b.id)
    return 1
  }
  if (r < 0.75 && system.length) {
    const ids = system.filter(() => rnd() < 0.4)
    // a stale id (a merged tombstone) must still resolve
    const all = s.speakers(sessionId, { includeMerged: true })
    return s.attributeSegments(sessionId, pick(rnd, all).id, ids, rnd() < 0.7 ? 'auto' : 'user').length
      ? 1
      : 0
  }
  if (r < 0.85 && system.length) {
    const from = pick(rnd, [...spk.map((x) => x.id), 'them'])
    const mine = system.filter((id) => (s.getSegment(id)!.speakerId ?? 'them') === from)
    if (!mine.length) return 0
    s.splitSpeaker(sessionId, from, mine.slice(0, randInt(rnd, 1, mine.length)))
    return 2
  }
  if (r < 0.95) {
    const existing = s.voiceprints()
    const now = new Date(Date.parse('2026-09-01T00:00:00Z') + randInt(rnd, 0, 1e9)).toISOString()
    const v =
      existing.length && rnd() < 0.5
        ? { ...pick(rnd, existing), samples: randInt(rnd, 1, 9), updatedAt: now }
        : {
            id: newId('vp'),
            name: pick(rnd, NAMES),
            model: 'emb-test',
            embedding: Array.from({ length: 4 }, () => Math.round(rnd() * 1000) / 1000),
            samples: 1,
            createdAt: now,
            updatedAt: now,
          }
    s.upsertVoiceprint(v)
    if (rnd() < 0.5) {
      s.linkVoiceprint(sessionId, pick(rnd, spk).id, v.id)
      return 2
    }
    return 1
  }
  const vps = s.voiceprints()
  if (!vps.length) return 0
  s.deleteVoiceprint(pick(rnd, vps).id)
  return 1
}

/** Drive a store through a random but legal history; returns how many events it produced. */
function randomHistory(s: Store, rnd: () => number, steps: number): number {
  const cursor = new Map<string, Record<TrackKind, number>>()
  const segIds = new Map<string, { id: string; track: TrackKind; final: boolean }[]>()
  let n = 0
  const text = () => Array.from({ length: randInt(rnd, 1, 12) }, () => pick(rnd, WORDS)).join(' ')
  for (let i = 0; i < steps; i++) {
    const sessions = [...cursor.keys()]
    const r = rnd()
    if (!sessions.length || r < 0.08) {
      const x = s.createSession({ title: text(), private: rnd() < 0.3 })
      cursor.set(x.id, { mic: 0, system: 0 })
      segIds.set(x.id, [])
    } else if (r < 0.15) {
      const id = pick(rnd, sessions)
      s.updateSession(id, (x) => ({
        ...x,
        title: text(),
        private: rnd() < 0.5,
        status: pick(rnd, ['idle', 'recording', 'paused', 'stopped'] as const),
        durationMs: x.durationMs + randInt(rnd, 0, 5000),
      }))
    } else if (r < 0.18 && sessions.length > 2) {
      const id = pick(rnd, sessions)
      s.deleteSession(id)
      cursor.delete(id)
      segIds.delete(id)
    } else if (r < 0.22) {
      const id = pick(rnd, sessions)
      s.addQaMessage(qa(rnd() < 0.8 ? id : null, rnd() < 0.5 ? 'user' : 'assistant'))
    } else if (r < 0.24) {
      const v = defaultsForTest()
      v.retention.days = randInt(rnd, 1, 90)
      s.putSettings(v)
    } else if (r < 0.42) {
      n += speakerOp(s, rnd, pick(rnd, sessions), segIds)
      continue
    } else {
      const id = pick(rnd, sessions)
      const known = segIds.get(id)!
      const open = known.filter((k) => !k.final)
      if (open.length && rnd() < 0.5) {
        const k = pick(rnd, open)
        const cur = s.getSegment(k.id)!
        const final = rnd() < 0.5
        s.upsertSegment({ ...cur, text: text(), quality: final ? 'final' : 'live', confidence: rnd() })
        k.final = final
      } else {
        const track: TrackKind = rnd() < 0.5 ? 'mic' : 'system'
        const c = cursor.get(id)!
        const start = c[track] + randInt(rnd, 0, 500)
        const end = start + randInt(rnd, 200, 4000)
        c[track] = end
        const g = s.upsertSegment({
          id: newId('seg'),
          sessionId: id,
          track,
          speaker: track === 'mic' ? 'me' : pick(rnd, ['them', 'speaker-1', 'Ana']),
          ...(track === 'system' && s.speakers(id).length && rnd() < 0.3
            ? { speakerId: pick(rnd, s.speakers(id, { includeMerged: true })).id }
            : {}),
          startMs: start,
          endMs: end,
          text: text(),
          quality: 'live',
          confidence: null,
        })
        known.push({ id: g.id, track, final: false })
      }
    }
    n++
  }
  return n
}
