import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Segment } from '@gnomeola/protocol'
import { Store } from '@gnomeola/store'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { assertNoViolations, checkEventLog, checkSegments, foldSegments } from '@gnomeola/testkit/invariants'
import { afterEach, describe, expect, it } from 'vitest'
import { durable, readEvents } from './helpers.ts'

// Chaos: the recorder must never silently lose a meeting. SIGKILL the daemon mid-session and restart it
// on the same data dir: interrupted sessions are closed out as `recovered`, everything that was
// committed is still there, the log continues gap-free, and the tables still equal a replay of the log.

const PIPE = JSON.stringify({
  segmentEveryMs: 50,
  finalizeAfterMs: 200,
  partialEveryMs: 20,
  levelEveryMs: 20,
})

let d: DaemonHandle | undefined
afterEach(async () => {
  await d?.stop()
  d = undefined
})

function openDisk(dataDir: string): Store {
  return Store.open(join(dataDir, 'gnomeola.db'))
}

/** Replay the on-disk log into an empty store and compare every table. */
function assertReplayEqualsState(dataDir: string): void {
  const disk = openDisk(dataDir)
  try {
    const log = disk.eventsAfter(0)
    assertNoViolations(checkEventLog(log), 'on-disk log')
    const fresh = Store.open(':memory:')
    fresh.replay(log)
    expect(fresh.dump()).toBe(disk.dump())
    disk.checkFts()
  } finally {
    disk.close()
  }
}

describe('crash recovery', () => {
  it('SIGKILL mid-recording: sessions recovered, segments intact, log gap-free, replay == state', async () => {
    d = await startDaemon({ env: { GNOMEOLA_FAKE_PIPELINE: PIPE } })
    const c = d.client
    const recording = await c.call('createSession', { body: { title: 'recording when killed' } })
    const paused = await c.call('createSession', { body: { title: 'paused when killed' } })
    const stopped = await c.call('createSession', { body: { title: 'finished before' } })
    const idle = await c.call('createSession', { body: { title: 'never started' } })
    for (const s of [recording, paused, stopped]) await c.call('startSession', { params: { id: s.id } })
    await waitFor(
      async () => (await c.call('getTranscript', { params: { id: recording.id } })).total >= 8,
      10_000,
    )
    await c.call('pauseSession', { params: { id: paused.id } })
    await c.call('stopSession', { params: { id: stopped.id } })
    await waitFor(
      async () => (await c.call('getTranscript', { params: { id: recording.id } })).total >= 12,
      10_000,
    )
    // a live subscriber's cursor, to resume from after the restart
    const { lastSeq: cursor } = await c.call('health')
    await readEvents(c, { since: cursor - 1, untilSeq: cursor })

    const exit = await d.kill('SIGKILL')
    expect(exit.signal).toBe('SIGKILL')

    // What survived on disk is what the daemon must serve after restart — nothing more, nothing less.
    const disk = openDisk(d.dataDir)
    const atKill = {
      lastSeq: disk.lastSeq(),
      segments: new Map([recording, paused, stopped].map((s) => [s.id, disk.segments(s.id)])),
      lastEventAt: disk.lastEventAt(recording.id),
      statuses: new Map([recording, paused, stopped, idle].map((s) => [s.id, disk.getSession(s.id)!.status])),
    }
    disk.close()
    expect(atKill.statuses.get(recording.id)).toBe('recording')
    expect(atKill.statuses.get(paused.id)).toBe('paused')
    expect(atKill.lastSeq).toBeGreaterThanOrEqual(cursor)
    assertReplayEqualsState(d.dataDir)

    await d.restart()
    const c2 = d.client
    const r = await c2.call('getSession', { params: { id: recording.id } })
    expect(r.status).toBe('recovered')
    expect(r.endedAt).toBe(atKill.lastEventAt)
    expect(r.error).toMatch(/interrupted/)
    const segs = (await c2.call('getTranscript', { params: { id: recording.id } })).segments
    expect(segs).toEqual(atKill.segments.get(recording.id))
    expect(r.durationMs).toBeGreaterThanOrEqual(Math.max(...segs.map((s) => s.endMs)))
    assertNoViolations(checkSegments(segs, { durationMs: r.durationMs }), 'recovered transcript')
    for (const t of r.tracks) expect(existsSync(t.audioPath!)).toBe(true)

    expect((await c2.call('getSession', { params: { id: paused.id } })).status).toBe('recovered')
    expect((await c2.call('getSession', { params: { id: stopped.id } })).status).toBe('stopped')
    expect((await c2.call('getSession', { params: { id: idle.id } })).status).toBe('idle')
    expect((await c2.call('getTranscript', { params: { id: stopped.id } })).segments).toEqual(
      atKill.segments.get(stopped.id),
    )

    // the log continues exactly where it stopped: one recovery event per interrupted session
    const { lastSeq } = await c2.call('health')
    expect(lastSeq).toBe(atKill.lastSeq + 2)
    const resumed = durable(await readEvents(c2, { since: cursor, untilSeq: lastSeq }))
    assertNoViolations(checkEventLog(resumed, cursor), 'resumed after restart')
    const tail = resumed
      .slice(-2)
      .map((e) => (e.data.type === 'session.upserted' ? e.data.session.status : e.data.type))
    expect(tail).toEqual(['recovered', 'recovered'])

    // recovered is terminal, but the session can be managed
    await expect(c2.call('startSession', { params: { id: recording.id } })).rejects.toMatchObject({
      status: 409,
    })
    await c2.call('updateSession', { params: { id: recording.id }, body: { title: 'renamed after crash' } })

    // a restart without a crash recovers nothing further
    await d.restart()
    expect((await d.client.call('health')).lastSeq).toBe(lastSeq + 1)

    await d.kill('SIGTERM')
    assertReplayEqualsState(d.dataDir)
    const disk2 = openDisk(d.dataDir)
    const folded = foldSegments(disk2.eventsAfter(0))
    const table: Segment[] = [recording, paused, stopped].flatMap((s) => disk2.segments(s.id))
    expect(table.length).toBe(folded.size)
    for (const g of table) expect(folded.get(g.id)).toEqual(g)
    disk2.close()
  })

  it('SIGTERM is a clean shutdown: running sessions are stopped and flushed, not recovered', async () => {
    d = await startDaemon({ env: { GNOMEOLA_FAKE_PIPELINE: PIPE } })
    const c = d.client
    const s = await c.call('createSession', {})
    await c.call('startSession', { params: { id: s.id } })
    await waitFor(async () => (await c.call('getTranscript', { params: { id: s.id } })).total >= 6, 10_000)
    // an open SSE stream must not hold shutdown up
    const ac = new AbortController()
    const stream = c.stream('events', { query: { since: 0 }, signal: ac.signal })
    await stream.next()
    const exit = await d.kill('SIGTERM')
    expect(exit).toEqual({ code: 0, signal: null })
    ac.abort()

    const log = readFileSync(join(d.dataDir, 'logs', 'gnomeolad.log'), 'utf8')
    expect(log).toMatch(/"signal received".*"SIGTERM"/)
    expect(log).toMatch(/"msg":"stopped"/)

    await d.restart()
    const after = await d.client.call('getSession', { params: { id: s.id } })
    expect(after.status).toBe('stopped')
    expect(after.error).toBeNull()
    const t = await d.client.call('getTranscript', { params: { id: s.id } })
    assertNoViolations(
      checkSegments(t.segments, { durationMs: after.durationMs, requireFinal: true }),
      'flushed',
    )
    await d.kill('SIGTERM')
    assertReplayEqualsState(d.dataDir)
  })

  it('refuses a data dir written by a newer schema, loudly', async () => {
    d = await startDaemon()
    await d.kill('SIGTERM')
    const s = openDisk(d.dataDir)
    s.db.prepare("INSERT INTO schema_migrations VALUES (2, 'from-the-future', '2030-01-01T00:00:00Z')").run()
    s.close()
    await expect(d.restart()).rejects.toThrow(/newer than this build/)
  })
})
