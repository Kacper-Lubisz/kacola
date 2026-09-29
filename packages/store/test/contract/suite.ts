import { type DurableEvent, SearchHit, type Segment, type SyncItem } from '@gnomeola/protocol'
import { seededRandom } from '@gnomeola/testkit/daemon'
import {
  assertNoViolations,
  checkEventLog,
  checkSegmentHistory,
  foldSegments,
} from '@gnomeola/testkit/invariants'
import { afterEach, describe, expect, it } from 'vitest'
import type { StoreApi } from '../../src/api.ts'
import { StoreError } from '../../src/errors.ts'
import { SNIPPET_MAX_CHARS } from '../../src/fts.ts'
import { SqliteStoreApi } from '../../src/sqlite-api.ts'
import { defaultsForTest, notesLog, qa, randomHistory, tickingClock } from './history.ts'

// V-8 / H-1 — the dialect contract. ONE suite, run unchanged against every StoreApi implementation
// (SQLite via SqliteStoreApi, Postgres via PGlite, and a real Postgres server when podman is available).
// Exit criterion of V-8: the same suite passes on both dialects.

export type StoreFactory = (opts?: { now?: () => Date }) => Promise<StoreApi>

let segN = 0
const seg = (sessionId: string, over: Partial<Segment> = {}): Omit<Segment, 'revision'> => ({
  id: over.id ?? `seg_c${String(++segN).padStart(8, '0')}`,
  sessionId,
  track: over.track ?? 'mic',
  speaker: over.speaker ?? (over.track === 'system' ? 'them' : 'me'),
  startMs: over.startMs ?? 0,
  endMs: over.endMs ?? 1000,
  text: over.text ?? 'hello world',
  quality: over.quality ?? 'live',
  confidence: over.confidence ?? null,
})

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function storeContract(dialect: string, factory: StoreFactory): void {
  const open: StoreApi[] = []
  const make: StoreFactory = async (o) => {
    const s = await factory(o)
    open.push(s)
    return s
  }
  afterEach(async () => {
    await Promise.all(open.splice(0).map((s) => s.close()))
  })

  describe(`[${dialect}] commit: state and log in one transaction`, () => {
    it('appends a gap-free, strictly increasing log with every state change', async () => {
      const s = await make()
      const a = await s.createSession({ title: 'A' })
      await s.updateSession(a.id, (x) => ({ ...x, title: 'A2' }))
      await s.upsertSegment(seg(a.id))
      await s.putSettings(defaultsForTest())
      const events = await s.eventsAfter(0)
      expect(events.map((e) => e.data.type)).toEqual([
        'session.upserted',
        'session.upserted',
        'segment.upserted',
        'settings.updated',
      ])
      assertNoViolations(checkEventLog(events))
      expect(await s.lastSeq()).toBe(4)
      expect((await s.eventsAfter(2)).map((e) => e.seq)).toEqual([3, 4])
      expect((await s.eventsAfter(0, { limit: 2 })).map((e) => e.seq)).toEqual([1, 2])
      expect((await s.eventsAfter(0, { sessionId: a.id })).map((e) => e.seq)).toEqual([1, 2, 3])
    })

    it('writes nothing — neither state nor log — when a change is refused', async () => {
      const s = await make()
      const a = await s.createSession({})
      const before = await s.snapshot()
      await expect(s.updateSession('ses_nope', (x) => x)).rejects.toThrow(StoreError)
      await expect(
        s.updateSession(a.id, () => {
          throw new StoreError('conflict', 'nope')
        }),
      ).rejects.toThrow(/nope/)
      await expect(s.createSession({ id: a.id })).rejects.toThrow(/exists/)
      expect(await s.lastSeq()).toBe(1)
      expect(await s.snapshot()).toEqual(before)
    })

    it('notifies listeners after commit, once each, in seq order', async () => {
      const s = await make()
      const seen: number[] = []
      s.onCommit((e) => seen.push(e.seq))
      await Promise.all([s.createSession({}), s.createSession({}), s.createSession({})])
      await s.createSession({})
      expect(seen).toEqual([1, 2, 3, 4])
    })

    it('keeps seq gap-free and unique under concurrent writers on one instance', async () => {
      const s = await make()
      const a = await s.createSession({ title: 'concurrency' })
      const results = await Promise.allSettled(
        Array.from({ length: 60 }, (_, i) =>
          // every 7th write is refused inside its transaction: it must leave no hole in the log
          i % 7 === 3 ? s.upsertSegment(seg('ses_missing')) : s.upsertSegment(seg(a.id, { text: `w${i}` })),
        ),
      )
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const events = await s.eventsAfter(0)
      assertNoViolations(checkEventLog(events))
      expect(events).toHaveLength(1 + ok)
      expect(await s.segments(a.id)).toHaveLength(ok)
    })
  })

  describe(`[${dialect}] segments`, () => {
    it('assigns revisions and allows live -> final', async () => {
      const s = await make()
      const a = await s.createSession({})
      const id = 'seg_rev00000001'
      expect((await s.upsertSegment(seg(a.id, { id, text: 'helo' }))).revision).toBe(1)
      expect((await s.upsertSegment(seg(a.id, { id, text: 'hello' }))).revision).toBe(2)
      const fin = await s.upsertSegment(
        seg(a.id, { id, text: 'Hello.', quality: 'final', confidence: 0.123456789 }),
      )
      expect(fin).toMatchObject({ revision: 3, quality: 'final', text: 'Hello.', confidence: 0.123456789 })
      expect(await s.segments(a.id)).toEqual([fin])
      expect(await s.getSegment(id)).toEqual(fin)
      const history = (await s.eventsAfter(0)).flatMap((e) =>
        e.data.type === 'segment.upserted' ? [e.data.segment] : [],
      )
      assertNoViolations(checkSegmentHistory(history))
    })

    it('refuses every invariant violation and writes nothing', async () => {
      const s = await make()
      const a = await s.createSession({})
      const b = await s.createSession({})
      const id = 'seg_inv00000001'
      await s.upsertSegment(seg(a.id, { id, quality: 'final' }))
      const seq = await s.lastSeq()
      const bad: [string, Omit<Segment, 'revision'>, StoreError['code']][] = [
        ['final->live', seg(a.id, { id, quality: 'live' }), 'conflict'],
        ['track change', seg(a.id, { id, track: 'system', quality: 'final' }), 'conflict'],
        ['session change', seg(b.id, { id, quality: 'final' }), 'conflict'],
        ['mic not me', seg(a.id, { track: 'mic', speaker: 'ana' }), 'bad_request'],
        ['system is me', seg(a.id, { track: 'system', speaker: 'me' }), 'bad_request'],
        ['empty speaker', seg(a.id, { track: 'system', speaker: '' }), 'bad_request'],
        ['end before start', seg(a.id, { startMs: 500, endMs: 100 }), 'bad_request'],
        ['unknown session', seg('ses_missing'), 'not_found'],
      ]
      for (const [name, input, code] of bad) {
        const err = await s.upsertSegment(input).then(
          () => null,
          (e: unknown) => e,
        )
        expect(err, name).toBeInstanceOf(StoreError)
        expect((err as StoreError).code, name).toBe(code)
      }
      expect(await s.lastSeq()).toBe(seq)
    })
  })

  describe(`[${dialect}] sessions`, () => {
    it('lists newest first, hides private unless asked, honours since and limit', async () => {
      const s = await make({ now: tickingClock() })
      const a = await s.createSession({ title: 'a' })
      const b = await s.createSession({ title: 'b', private: true })
      const c = await s.createSession({ title: 'c' })
      expect((await s.listSessions()).map((x) => x.id)).toEqual([c.id, a.id])
      expect((await s.listSessions({ includePrivate: true })).map((x) => x.id)).toEqual([c.id, b.id, a.id])
      expect((await s.listSessions({ includePrivate: true, limit: 1 })).map((x) => x.id)).toEqual([c.id])
      expect((await s.listSessions({ since: new Date(b.createdAt) })).map((x) => x.id)).toEqual([c.id])
      expect(await s.getSession(b.id)).toEqual(b)
      expect(await s.getSession('ses_missing')).toBeNull()
    })

    it('titles default from the clock and are trimmed', async () => {
      const s = await make({ now: () => new Date('2026-09-01T09:05:00.000Z') })
      expect((await s.createSession({})).title).toBe('Meeting 2026-09-01 09:05')
      expect((await s.createSession({ title: '  standup  ' })).title).toBe('standup')
    })

    it('round-trips tracks and gaps, and finds sessions by status', async () => {
      const s = await make()
      const a = await s.createSession({})
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
          archivePath: '/a/system.opus',
          gaps: [{ atMs: 1000, durationMs: 250, reason: 'device switch' }],
        },
      ]
      await s.updateSession(a.id, (x) => ({ ...x, tracks, status: 'recording' }))
      expect((await s.getSession(a.id))?.tracks).toEqual(tracks)
      expect((await s.sessionsWithStatus(['recording', 'paused'])).map((x) => x.id)).toEqual([a.id])
      await s.updateSession(a.id, (x) => ({ ...x, tracks: tracks.slice(0, 1), status: 'stopped' }))
      expect((await s.getSession(a.id))?.tracks).toEqual(tracks.slice(0, 1))
      expect(await s.sessionsWithStatus(['recording'])).toEqual([])
    })

    it('deletes a session with its tracks, segments, Q&A and search entries', async () => {
      const s = await make()
      const a = await s.createSession({})
      const keep = await s.createSession({})
      await s.upsertSegment(seg(a.id, { text: 'zebra crossing' }))
      await s.upsertSegment(seg(keep.id, { text: 'zebra stripes' }))
      await s.addQaMessage(qa(a.id))
      await s.deleteSession(a.id)
      expect(await s.getSession(a.id)).toBeNull()
      expect(await s.segments(a.id)).toEqual([])
      expect(await s.qaHistory(a.id)).toEqual([])
      expect((await s.search({ q: 'zebra' })).hits.map((h) => h.sessionId)).toEqual([keep.id])
      await expect(s.deleteSession(a.id)).rejects.toThrow(StoreError)
      await expect(
        s.deleteSession(keep.id, () => {
          throw new StoreError('conflict', 'guarded')
        }),
      ).rejects.toThrow(/guarded/)
      expect(await s.getSession(keep.id)).not.toBeNull()
    })
  })

  describe(`[${dialect}] Q&A and settings`, () => {
    it('keeps Q&A in insertion order per session, including upserts of the same id', async () => {
      const s = await make()
      const a = await s.createSession({})
      const q1 = qa(a.id, 'user')
      const a1 = qa(a.id, 'assistant')
      const x = qa(null, 'user')
      await s.addQaMessage(q1)
      await s.addQaMessage(x)
      await s.addQaMessage(a1)
      await s.addQaMessage({ ...q1, text: 'edited' })
      expect(await s.qaHistory(a.id)).toEqual([{ ...q1, text: 'edited' }, a1])
      await expect(s.addQaMessage(qa('ses_missing'))).rejects.toThrow(StoreError)
      expect((await s.snapshot()).qa.map((m) => m.id).sort()).toEqual([q1.id, a1.id, x.id].sort())
    })

    it('stores and returns settings, as an event', async () => {
      const s = await make()
      expect(await s.getSettings()).toBeNull()
      const v = defaultsForTest()
      await s.putSettings(v)
      expect(await s.getSettings()).toEqual(v)
      expect((await s.eventsAfter(0)).at(-1)?.data).toEqual({ type: 'settings.updated', settings: v })
    })
  })

  describe(`[${dialect}] transcript windows`, () => {
    async function world() {
      const s = await make()
      const a = await s.createSession({})
      const segs = [
        await s.upsertSegment(seg(a.id, { startMs: 0, endMs: 1000, text: 'one' })),
        await s.upsertSegment(
          seg(a.id, { track: 'system', startMs: 500, endMs: 1500, text: 'two', quality: 'final' }),
        ),
        await s.upsertSegment(seg(a.id, { startMs: 2000, endMs: 3000, text: 'three', quality: 'final' })),
        await s.upsertSegment(
          seg(a.id, { track: 'system', speaker: 'Ana', startMs: 4000, endMs: 5000, text: 'four' }),
        ),
      ]
      return { s, a, segs }
    }

    it('returns everything with a null window by default', async () => {
      const { s, a } = await world()
      const t = await s.transcript(a.id)
      expect(t.segments.map((x) => x.text)).toEqual(['one', 'two', 'three', 'four'])
      expect(t.window).toBeNull()
      expect(t.total).toBe(4)
    })

    it('selects overlapping segments, inclusive, and reports the applied window', async () => {
      const { s, a } = await world()
      expect((await s.transcript(a.id, { fromMs: 1200, toMs: 2000 })).segments.map((x) => x.text)).toEqual([
        'two',
        'three',
      ])
      const t = await s.transcript(a.id, { fromMs: 3500 })
      expect(t.segments.map((x) => x.text)).toEqual(['four'])
      expect(t.window).toEqual({ fromMs: 3500, toMs: 5000 })
      expect(t.total).toBe(4)
      expect((await s.transcript(a.id, { toMs: 400 })).window).toEqual({ fromMs: 0, toMs: 400 })
    })

    it('filters by speaker (case-insensitive), track and quality', async () => {
      const { s, a, segs } = await world()
      expect((await s.transcript(a.id, { speaker: 'ana' })).segments.map((x) => x.text)).toEqual(['four'])
      expect((await s.transcript(a.id, { track: 'system' })).segments.map((x) => x.text)).toEqual([
        'two',
        'four',
      ])
      expect((await s.transcript(a.id, { quality: 'final' })).segments.map((x) => x.text)).toEqual([
        'two',
        'three',
      ])
      expect((await s.transcript(a.id, { quality: 'live' })).segments.map((x) => x.text)).toEqual([
        'one',
        'four',
      ])
      expect((await s.transcript(a.id, { quality: 'best' })).segments).toEqual(segs)
    })

    it('rejects an inverted window and an unknown session', async () => {
      const { s, a } = await world()
      await expect(s.transcript(a.id, { fromMs: 10, toMs: 5 })).rejects.toThrow(/toMs/)
      await expect(s.transcript('ses_missing')).rejects.toThrow(StoreError)
    })
  })

  describe(`[${dialect}] search`, () => {
    async function world() {
      let t = Date.parse('2026-09-01T09:00:00.000Z')
      const s = await make({
        now: () => {
          t += 60_000
          return new Date(t)
        },
      })
      const standup = await s.createSession({ title: 'Platform standup' })
      const secret = await s.createSession({ title: 'Salary review', private: true })
      const later = await s.createSession({ title: 'Roadmap sync' })
      let at = 0
      const add = (sessionId: string, text: string, track: 'mic' | 'system' = 'system', speaker = 'Ana') => {
        const startMs = at
        at += 1000
        return s.upsertSegment({
          id: `seg_s${String(at).padStart(10, '0')}`,
          sessionId,
          track,
          speaker: track === 'mic' ? 'me' : speaker,
          startMs,
          endMs: startMs + 900,
          text,
          quality: 'final',
          confidence: 0.9,
        })
      }
      const segs = {
        dense: await add(standup.id, 'retry budget retry budget retry budget'),
        once: await add(
          standup.id,
          'we talked about a lot of things today including the dashboard the migration the on-call rota and somewhere in there the retry budget came up once',
        ),
        me: await add(standup.id, 'I think the retry budget should be three attempts', 'mic'),
        priv: await add(secret.id, 'the retry budget for salaries is confidential'),
        later: await add(later.id, 'retry budget revisited after the incident', 'system', 'Ben'),
        accents: await add(later.id, 'Le café était naïve'),
      }
      return { s, standup, secret, later, segs }
    }

    it('ranks a dense short match before a passing mention; scores descend', async () => {
      const { s, segs } = await world()
      const r = await s.search({ q: 'retry budget' })
      expect(r.total).toBe(4)
      expect(r.hits[0]!.segmentId).toBe(segs.dense.id)
      expect(r.hits.at(-1)!.segmentId).toBe(segs.once.id)
      const scores = r.hits.map((h) => h.score)
      expect([...scores].sort((a, b) => b - a)).toEqual(scores)
      for (const h of r.hits) SearchHit.parse(h)
    })

    it('marks matches with [ ] and caps long snippets', async () => {
      const { s, segs, standup } = await world()
      const hit = (await s.search({ q: 'dashboard' })).hits[0]!
      expect(hit.segmentId).toBe(segs.once.id)
      expect(hit.snippet).toContain('[dashboard]')
      expect(hit.snippet.length).toBeLessThan(segs.once.text.length)
      expect(hit.snippet).toMatch(/…/)
      expect(hit.snippet.length).toBeLessThanOrEqual(SNIPPET_MAX_CHARS + 1)
      expect(hit).toMatchObject({ sessionId: standup.id, sessionTitle: 'Platform standup', speaker: 'Ana' })
      const accent = (await s.search({ q: 'cafe' })).hits[0]!
      expect(accent.snippet).toContain('[café]')
    })

    it('excludes private sessions unless includePrivate', async () => {
      const { s, secret } = await world()
      expect((await s.search({ q: 'salaries' })).hits).toEqual([])
      expect((await s.search({ q: 'salaries' })).total).toBe(0)
      expect((await s.search({ q: 'salaries', includePrivate: true })).hits.map((h) => h.sessionId)).toEqual([
        secret.id,
      ])
      expect((await s.search({ q: 'retry', includePrivate: true })).total).toBe(5)
    })

    it('filters by sessionId, speaker (case-insensitive) and since; limit caps hits but not total', async () => {
      const { s, later, segs } = await world()
      expect((await s.search({ q: 'retry', sessionId: later.id })).hits.map((h) => h.segmentId)).toEqual([
        segs.later.id,
      ])
      expect((await s.search({ q: 'retry', speaker: 'ME' })).hits.map((h) => h.segmentId)).toEqual([
        segs.me.id,
      ])
      expect(
        (await s.search({ q: 'retry', since: new Date(later.createdAt) })).hits.map((h) => h.segmentId),
      ).toEqual([segs.later.id])
      const limited = await s.search({ q: 'retry', limit: 2 })
      expect(limited.hits).toHaveLength(2)
      expect(limited.total).toBe(4)
    })

    it('matches without diacritics, by prefix, and by quoted phrase', async () => {
      const { s, segs } = await world()
      expect((await s.search({ q: 'cafe naive' })).hits.map((h) => h.segmentId)).toEqual([segs.accents.id])
      expect((await s.search({ q: 'CAFÉ' })).hits.map((h) => h.segmentId)).toEqual([segs.accents.id])
      expect((await s.search({ q: 'dash*' })).hits.map((h) => h.segmentId)).toEqual([segs.once.id])
      expect((await s.search({ q: 'dash' })).hits).toEqual([])
      expect((await s.search({ q: '"budget retry"' })).hits.map((h) => h.segmentId)).toEqual([segs.dense.id])
      // hyphenated words are split the same way on both dialects
      expect((await s.search({ q: 'on-call' })).hits.map((h) => h.segmentId)).toEqual([segs.once.id])
      expect((await s.search({ q: 'call' })).hits.map((h) => h.segmentId)).toEqual([segs.once.id])
    })

    it('never passes query syntax through: hostile input neither throws nor changes meaning', async () => {
      const { s } = await world()
      for (const q of [
        'NEAR(retry budget)',
        'retry OR salaries',
        '"',
        '***',
        '-retry',
        'text:retry',
        '(',
        'AND',
        '^retry',
        "'; DROP TABLE segments; --",
        'retry & budget | !x',
        "o'brien <-> x:*",
      ]) {
        await expect(s.search({ q }), q).resolves.toBeDefined()
      }
      expect((await s.search({ q: 'retry OR salaries', includePrivate: true })).total).toBe(0)
      expect(await s.search({ q: '***' })).toEqual({ hits: [], total: 0 })
      expect((await s.listSessions({ includePrivate: true })).length).toBe(3)
    })

    it('stays in sync as segments are revised and deleted', async () => {
      const { s, segs, standup } = await world()
      await s.upsertSegment({ ...segs.dense, text: 'completely different words' })
      expect((await s.search({ q: 'completely' })).hits.map((h) => h.segmentId)).toEqual([segs.dense.id])
      expect((await s.search({ q: 'retry' })).hits.map((h) => h.segmentId)).not.toContain(segs.dense.id)
      await s.deleteSession(standup.id)
      expect((await s.search({ q: 'completely' })).total).toBe(0)
    })
  })

  describe(`[${dialect}] replay reproduces the store`, () => {
    for (const seed of [1, 42]) {
      it(`random history, seed ${seed}`, async () => {
        const rnd = seededRandom(seed)
        const src = await make({ now: tickingClock() })
        const n = await randomHistory(src, rnd, 250)
        const events = await src.eventsAfter(0)
        expect(events.length).toBe(n)
        assertNoViolations(checkEventLog(events))

        const dst = await make({ now: () => new Date('2000-01-01T00:00:00Z') })
        expect(await dst.replay(events, 37)).toBe(events.length)
        expect(await dst.snapshot()).toEqual(await src.snapshot())
        expect(await dst.eventsAfter(0)).toEqual(events)

        // the segment table equals the fold of the log
        const folded = foldSegments(events)
        const snap = await src.snapshot()
        const live = new Set(snap.sessions.map((x) => x.id))
        expect(snap.segments).toEqual([...folded.values()].filter((g) => live.has(g.sessionId)).sort(byId))

        // and a replayed store keeps working: the next commit continues the sequence
        await dst.createSession({})
        expect(await dst.lastSeq()).toBe(events.length + 1)
      })
    }

    it('refuses to replay into a non-empty store, or a log with a gap', async () => {
      const src = await make()
      await src.createSession({})
      await src.createSession({})
      await src.createSession({})
      const events = await src.eventsAfter(0)
      await expect(src.replay(events)).rejects.toThrow(/empty/)
      const dst = await make()
      await expect(dst.replay([events[0]!, events[2]!])).rejects.toThrow(/gap/)
      const dst2 = await make()
      await expect(dst2.replay(events.slice(1))).rejects.toThrow(/gap/)
    })
  })

  describe(`[${dialect}] hybrid-sync ingest (H-7)`, () => {
    async function deviceLog(): Promise<DurableEvent[]> {
      // a "device": any store, driven by a random history; its log is what gets pushed
      const dev = await make({ now: tickingClock() })
      await randomHistory(dev, seededRandom(99), 180)
      return dev.eventsAfter(0)
    }
    const items = (es: DurableEvent[]): SyncItem[] => es.map((e) => ({ seq: e.seq, data: e.data }))

    it('applying a device log converges on the device state (minus device-local settings)', async () => {
      const log = await deviceLog()
      const dev = await make({ now: tickingClock() })
      await dev.replay(log)
      const srv = await make()
      const r = await srv.ingest('laptop', items(log))
      expect(r.cursor).toBe(log.at(-1)!.seq)
      expect(r.rejected).toEqual([])
      expect(r.applied + r.skipped).toBe(log.length)
      const a = await dev.snapshot()
      const b = await srv.snapshot()
      expect(b.sessions).toEqual(a.sessions)
      expect(b.segments).toEqual(a.segments)
      expect(b.qa).toEqual(a.qa)
      expect(b.settings).toBeNull()
      expect(await srv.syncCursor('laptop')).toBe(r.cursor)
      assertNoViolations(checkEventLog(await srv.eventsAfter(0)))
    })

    it('is idempotent and resumable: any split into batches, any number of re-pushes, same result', async () => {
      const log = await deviceLog()
      const once = await make()
      await once.ingest('d', items(log))
      const srv = await make()
      const rnd = seededRandom(5)
      let at = 0
      while (at < log.length) {
        const n = 1 + Math.floor(rnd() * 40)
        const batch = items(log.slice(at, at + n))
        // a lost response makes the device push the same batch again, maybe with an older prefix
        const back = Math.floor(rnd() * 10)
        const r = await srv.ingest('d', items(log.slice(Math.max(0, at - back), at + n)))
        if (rnd() < 0.3) await srv.ingest('d', batch)
        at += n
        expect(r.cursor).toBe(log[Math.min(at, log.length) - 1]!.seq)
      }
      const a = await once.snapshot()
      const b = await srv.snapshot()
      expect({ ...b, lastSeq: 0 }).toEqual({ ...a, lastSeq: 0 })
      expect(b.lastSeq).toBe(a.lastSeq) // no duplicate events were written by the re-pushes
    })

    it('keeps cursors per device, rejects invariant-breaking items without stopping, refuses disorder', async () => {
      const srv = await make()
      const ses = (await (await make()).createSession({ id: 'ses_dev000001', title: 'from device' })) as never
      const r1 = await srv.ingest('a', [
        { seq: 1, data: { type: 'session.upserted', session: ses } },
        {
          seq: 2,
          data: {
            type: 'segment.upserted',
            segment: { ...seg('ses_unknown'), revision: 1 },
          },
        },
        {
          seq: 3,
          data: {
            type: 'segment.upserted',
            segment: { ...seg('ses_dev000001', { id: 'seg_x' }), revision: 2 },
          },
        },
        // a stale revision of the same segment is a no-op, not an error
        {
          seq: 4,
          data: {
            type: 'segment.upserted',
            segment: { ...seg('ses_dev000001', { id: 'seg_x' }), revision: 1 },
          },
        },
        { seq: 5, data: { type: 'settings.updated', settings: defaultsForTest() } },
        { seq: 6, data: { type: 'session.deleted', sessionId: 'ses_never_existed' } },
      ])
      expect(r1).toMatchObject({ deviceId: 'a', cursor: 6, applied: 2, skipped: 3 })
      expect(r1.rejected).toEqual([{ seq: 2, type: 'segment.upserted', reason: 'no session ses_unknown' }])
      expect((await srv.getSegment('seg_x'))?.revision).toBe(2)
      expect(await srv.syncCursor('a')).toBe(6)
      expect(await srv.syncCursor('b')).toBe(0)
      await expect(
        srv.ingest('b', [
          { seq: 2, data: { type: 'session.deleted', sessionId: 'x' } },
          { seq: 1, data: { type: 'session.deleted', sessionId: 'x' } },
        ]),
      ).rejects.toThrow(/out of order/)
      expect(await srv.syncCursor('b')).toBe(0)
      // a failure mid-batch rolls back the whole batch, cursor included
      const seqBefore = await srv.lastSeq()
      await expect(
        srv.ingest('a', [
          {
            seq: 7,
            data: { type: 'session.upserted', session: { ...(ses as object), title: 'x' } as never },
          },
          { seq: 8, data: { type: 'session.upserted', session: { id: 'bad' } as never } },
        ]),
      ).rejects.toThrow()
      expect(await srv.lastSeq()).toBe(seqBefore)
      expect(await srv.syncCursor('a')).toBe(6)
      expect((await srv.getSession('ses_dev000001'))?.title).toBe('from device')
    })
  })

  describe(`[${dialect}] M7 notes, as a replica receives them`, () => {
    it('replay of a notes log reproduces heads, pending reviews, every version and templates', async () => {
      const { store: src, events } = notesLog()
      const ref = new SqliteStoreApi(src)
      const s = await make()
      await s.replay(events, 4)
      const want = await ref.snapshot()
      expect(await s.snapshot()).toEqual(want)
      expect(want.noteVersions.length).toBeGreaterThanOrEqual(7)
      expect(want.templates.map((t) => t.id)).toEqual(['one-on-one'])
      // the head was restored to version 1; the Retro enhancement still awaits review
      expect(await s.getNotes('ses_notes0001')).toEqual(await ref.getNotes('ses_notes0001'))
      expect((await s.getNotes('ses_notes0001')).markdown).toBe('# Standup\n\n- retry budget\n')
      expect((await s.getNotes('ses_notes0002')).pendingEnhancement).toBe(2)
      expect(await s.noteVersion('ses_notes0002', 2)).toEqual(await ref.noteVersion('ses_notes0002', 2))
      expect(await s.noteVersions('ses_notes0003')).toEqual([]) // deleted with its session
      expect(await s.getNotes('ses_nothing')).toEqual({
        sessionId: 'ses_nothing',
        version: 0,
        markdown: '',
        updatedAt: null,
        pendingEnhancement: null,
      })
      src.close()
    })

    it('ingest applies note versions once, rejects orphans, and keeps templates device-local', async () => {
      const { store: src, events } = notesLog()
      const s = await make()
      const items = events.map((e) => ({ seq: e.seq, data: e.data }))
      const r = await s.ingest('laptop', items)
      expect(r.rejected).toEqual([])
      // pushing the same notes again under a fresh device cursor changes nothing (versions are append-only)
      const seq = await s.lastSeq()
      const again = await s.ingest(
        'laptop-reinstalled',
        items.filter((i) => i.data.type === 'note.version'),
      )
      expect(again.applied).toBe(0)
      expect(await s.lastSeq()).toBe(seq)
      const ref = await new SqliteStoreApi(src).snapshot()
      const got = await s.snapshot()
      expect(got.noteVersions).toEqual(ref.noteVersions)
      expect(got.notes).toEqual(ref.notes)
      expect(got.templates).toEqual([])
      const first = items.map((i) => i.data).find((d) => d.type === 'note.version')
      if (first?.type !== 'note.version') throw new Error('no note version in the log')
      const r2 = await s.ingest('other', [
        { seq: 1, data: { type: 'note.version', version: { ...first.version, sessionId: 'ses_unknown' } } },
      ])
      expect(r2.rejected.map((x) => x.reason)).toEqual(['no session ses_unknown'])
      src.close()
    })
  })

  describe(`[${dialect}] hosted bookkeeping (H-3, H-6)`, () => {
    const t0 = new Date('2026-09-01T09:00:00.000Z')
    const later = (ms: number) => new Date(t0.getTime() + ms)

    it('pairs by user code exactly once, expires, and revokes', async () => {
      const s = await make()
      await s.createPairing({
        deviceCodeHash: 'h1',
        userCode: 'BCDFGHJK',
        name: 'phone',
        createdAt: t0.toISOString(),
        expiresAt: later(600_000).toISOString(),
      })
      expect(await s.claimPairing('h1', later(1000))).toEqual({ status: 'pending' })
      expect(await s.claimPairing('nope', later(1000))).toBeNull()
      expect(await s.approvePairing('XXXXXXXX', 'dev_1', later(2000))).toBeNull()
      const dev = await s.approvePairing('BCDFGHJK', 'dev_1', later(2000))
      expect(dev).toEqual({
        id: 'dev_1',
        name: 'phone',
        createdAt: later(2000).toISOString(),
        revokedAt: null,
      })
      expect(await s.approvePairing('BCDFGHJK', 'dev_2', later(3000))).toBeNull() // already approved
      expect(await s.claimPairing('h1', later(4000))).toEqual({
        status: 'approved',
        deviceId: 'dev_1',
        name: 'phone',
      })
      expect(await s.claimPairing('h1', later(5000))).toBeNull() // the token is handed out once
      expect(await s.getDevice('dev_1')).toEqual(dev)
      expect(await s.revokeDevice('dev_1', later(6000))).toBe(true)
      expect(await s.revokeDevice('dev_1', later(7000))).toBe(false)
      expect((await s.getDevice('dev_1'))?.revokedAt).toBe(later(6000).toISOString())

      await s.createPairing({
        deviceCodeHash: 'h2',
        userCode: 'MNPQRSTV',
        name: 'old',
        createdAt: t0.toISOString(),
        expiresAt: later(1000).toISOString(),
      })
      expect(await s.claimPairing('h2', later(2000))).toBeNull()
      expect(await s.approvePairing('MNPQRSTV', 'dev_3', later(2000))).toBeNull()
      // an expired request is purged, so its user code can be issued again
      await s.createPairing({
        deviceCodeHash: 'h3',
        userCode: 'MNPQRSTV',
        name: 'new',
        createdAt: later(5000).toISOString(),
        expiresAt: later(600_000).toISOString(),
      })
      expect(await s.claimPairing('h3', later(6000))).toEqual({ status: 'pending' })
    })

    it('records audio chunk receipts idempotently, and forgets them with the session', async () => {
      const s = await make()
      const a = await s.createSession({})
      const c = {
        sessionId: a.id,
        chunkSeq: 0,
        track: 'mic' as const,
        bytes: 160000,
        sha256: 'a'.repeat(64),
        blobKey: `audio/${a.id}/0`,
        receivedAt: t0.toISOString(),
      }
      expect(await s.putAudioChunk(c)).toBe('stored')
      expect(await s.putAudioChunk(c)).toBe('duplicate')
      expect(await s.putAudioChunk({ ...c, sha256: 'b'.repeat(64) })).toBe('conflict')
      expect(await s.putAudioChunk({ ...c, chunkSeq: 3, track: 'system' })).toBe('stored')
      expect((await s.audioChunks(a.id)).map((x) => [x.chunkSeq, x.track])).toEqual([
        [0, 'mic'],
        [3, 'system'],
      ])
      expect((await s.audioChunks(a.id))[0]).toEqual(c)
      const before = await s.lastSeq()
      expect(before).toBe(1) // receipts are bookkeeping, not events
      await s.deleteSession(a.id)
      expect(await s.audioChunks(a.id)).toEqual([])
    })
  })
}
