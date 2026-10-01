import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { createDaemon, DataDirLockedError, MemoryKeyring } from '@gnomeola/daemon'
import { DAEMON_EXIT, type Session } from '@gnomeola/protocol'
import { Store } from '@gnomeola/store'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { assertNoViolations, checkEventLog, checkSegments } from '@gnomeola/testkit/invariants'
import { afterEach, describe, expect, it } from 'vitest'
import { gnomeola } from '../src/cli.ts'

// The 2026-10-01 incident, replayed against real daemon processes and the real CLI. The user was
// recording a meeting when (1) a second daemon started on the same data dir, ran crash recovery and
// marked the live meeting `recovered`, and then (2) `systemctl --user restart gnomeolad`, believing
// nothing was recording, stopped the rest of it. Now:
//
//   - a second daemon on a live data dir refuses (exit 75) before touching anything, and the meeting
//     stays `recording`;
//   - `gnomeola daemon restart` waits for the recording to finish, then the daemon exits 76 for its
//     supervisor (here: the test) to start it again; --now is refused while recording;
//   - a SIGTERM (or a crash) mid-recording and a new daemon within the resume window continue the SAME
//     session — a `restart` gap of the real length, the transcript growing again; after the window the
//     session is closed out as stopped, saying it was a restart.

const PIPE = JSON.stringify({
  segmentEveryMs: 200,
  finalizeAfterMs: 100,
  partialEveryMs: 50,
  levelEveryMs: 50,
})

const daemons: DaemonHandle[] = []
afterEach(async () => {
  for (const d of daemons.splice(0)) await d.stop().catch(() => {})
})

/** A fixed port, as under systemd: the restarted daemon answers on the same URL. */
const freePort = () =>
  new Promise<number>((resolve) => {
    const srv = createServer().listen(0, '127.0.0.1', () => {
      const p = (srv.address() as { port: number }).port
      srv.close(() => resolve(p))
    })
  })

async function daemon(
  env: Record<string, string> = {},
  o: { fixedPort?: boolean } = {},
): Promise<DaemonHandle> {
  const d = await startDaemon({
    env: { GNOMEOLA_FAKE_PIPELINE: PIPE, ...env },
    ...(o.fixedPort ? { args: ['--port', String(await freePort())] } : {}),
  })
  daemons.push(d)
  return d
}

async function recordUntil(d: DaemonHandle, segments: number, title = 'Weekly sync'): Promise<Session> {
  const s = await d.client.call('createSession', { body: { title } })
  await d.client.call('startSession', { params: { id: s.id } })
  await waitFor(
    async () => (await d.client.call('getTranscript', { params: { id: s.id } })).total >= segments,
    15_000,
    `${segments} segments`,
  )
  return d.client.call('getSession', { params: { id: s.id } })
}

const transcript = (d: DaemonHandle, id: string) => d.client.call('getTranscript', { params: { id } })

function assertReplayEqualsState(dataDir: string): void {
  const disk = Store.open(join(dataDir, 'gnomeola.db'), { readonly: true })
  try {
    const log = disk.eventsAfter(0)
    assertNoViolations(checkEventLog(log), 'on-disk log')
    const fresh = Store.open(':memory:')
    fresh.replay(log)
    expect(fresh.dump()).toBe(disk.dump())
  } finally {
    disk.close()
  }
}

describe('one owner per data dir', () => {
  it('a second daemon on the live data dir refuses before touching it; the meeting keeps recording', async () => {
    const a = await daemon()
    const s = await recordUntil(a, 4)
    const port = Number(new URL(a.baseUrl).port)

    // the second daemon (as the desktop window's fallback did): exits 75, says who owns the dir
    const b = startDaemon({ dataDir: a.dataDir, env: { GNOMEOLA_FAKE_PIPELINE: PIPE } })
    await expect(b).rejects.toThrow(new RegExp(`code ${DAEMON_EXIT.LOCKED}`))
    await expect(b).rejects.toThrow(
      `another gnomeola daemon (pid ${a.pid}, port ${port}) owns ${a.dataDir}; not starting`,
    )
    // …and an in-process daemon (createDaemon) is refused the same way, before recover()
    await expect(
      createDaemon({ dataDir: a.dataDir, port: 0, keyring: new MemoryKeyring(), env: {} }),
    ).rejects.toBeInstanceOf(DataDirLockedError)

    // the meeting was never touched: still recording, still growing, no recovery in the log
    const before = (await transcript(a, s.id)).total
    expect((await a.client.call('getSession', { params: { id: s.id } })).status).toBe('recording')
    await waitFor(async () => (await transcript(a, s.id)).total > before, 10_000, 'more segments')
    const log = readFileSync(join(a.dataDir, 'logs', 'gnomeolad.log'), 'utf8')
    expect(log.match(/"daemon starting"/g)).toHaveLength(1)
    expect(log).not.toMatch(/recovered interrupted session/)
    // and `daemon status` asks the daemon itself what it is recording
    const st = await gnomeola(['daemon', 'status'], a.baseUrl)
    expect(st.code, st.stderr).toBe(0)
    expect(JSON.parse(st.stdout)).toMatchObject({
      pid: a.pid,
      dataDir: a.dataDir,
      recording: [{ id: s.id, status: 'recording', title: 'Weekly sync' }],
    })
    const idle = await gnomeola(['daemon', 'idle'], a.baseUrl)
    expect(idle.code).toBe(5)
    expect(idle.stderr).toMatch(/recording "Weekly sync"/)
  }, 60_000)

  it('a private recording counts as recording, without its title', async () => {
    const a = await daemon()
    const s = await a.client.call('createSession', { body: { title: 'Secret 1:1', private: true } })
    await a.client.call('startSession', { params: { id: s.id } })
    const r = await gnomeola(['daemon', 'idle'], a.baseUrl)
    expect(r.code).toBe(5)
    expect(r.stderr).toMatch(/a private recording/)
    expect(r.stderr).not.toMatch(/Secret/)
  }, 30_000)
})

describe('restarts wait for the recording', () => {
  it('daemon restart (when idle) waits for the meeting to end, then exits 76; --now is refused', async () => {
    const a = await daemon()
    const s = await recordUntil(a, 2)
    const now = await gnomeola(['daemon', 'restart', '--now'], a.baseUrl)
    expect(now.code).toBe(5)
    expect(now.stderr).toMatch(/restarting now would interrupt it/)

    const r = await gnomeola(['daemon', 'restart', '--no-wait'], a.baseUrl)
    expect(r.code, r.stderr).toBe(0)
    expect(r.stderr).toMatch(new RegExp(`waiting for "Weekly sync" \\(${s.id}, recording\\) to finish`))
    const info = await a.client.call('daemonInfo')
    expect(info.restart).toMatchObject({ mode: 'when-idle', by: 'cli' })
    // still up, still recording, a while later
    await new Promise((res) => setTimeout(res, 1000))
    expect((await a.client.call('getSession', { params: { id: s.id } })).status).toBe('recording')

    await a.client.call('stopSession', { params: { id: s.id } })
    expect(await a.exited(15_000)).toEqual({ code: DAEMON_EXIT.RESTART, signal: null })
    // the supervisor starts it again: the meeting ended cleanly, nothing to recover
    await a.restart()
    const after = await a.client.call('getSession', { params: { id: s.id } })
    expect(after).toMatchObject({ status: 'stopped', error: null })
    assertNoViolations(
      checkSegments((await transcript(a, s.id)).segments, {
        durationMs: after.durationMs,
        requireFinal: true,
      }),
      'stopped transcript',
    )
  }, 60_000)

  it('with nothing recording it restarts at once; a waiting restart can be cancelled; SIGHUP waits too', async () => {
    const a = await daemon({}, { fixedPort: true })
    const s = await recordUntil(a, 1)
    process.kill(a.pid, 'SIGHUP') // systemctl --user reload gnomeolad
    await waitFor(async () => (await a.client.call('daemonInfo')).restart?.by === 'SIGHUP', 5_000, 'SIGHUP')
    const cancel = await gnomeola(['daemon', 'restart', '--cancel'], a.baseUrl)
    expect(cancel.stdout).toBe('{"cancelled":true}\n')
    await a.client.call('stopSession', { params: { id: s.id } })
    await new Promise((res) => setTimeout(res, 500))
    expect((await a.client.call('health')).ok).toBe(true) // cancelled: no restart

    const pid = a.pid
    const restart = gnomeola(['daemon', 'restart', '--timeout', '30s'], a.baseUrl)
    expect(await a.exited(10_000)).toEqual({ code: DAEMON_EXIT.RESTART, signal: null })
    await a.restart() // the supervisor
    const r = await restart
    expect(r.code, r.stderr).toBe(0)
    expect(JSON.parse(r.stdout)).toMatchObject({ restarted: true, from: pid, to: a.pid })
  }, 60_000)
})

describe('a recording survives a restart', () => {
  it('SIGTERM mid-meeting + a new daemon within the window: the same session resumes after a real gap', async () => {
    const a = await daemon({ GNOMEOLA_RESUME_WINDOW_MS: '60000' })
    const s = await recordUntil(a, 6)
    const lease = await a.client.call('createAgentLease', {
      params: { id: s.id },
      body: { name: 'claude', mode: 'observe' },
    })
    expect(lease.token).toBeTruthy()

    expect(await a.kill('SIGTERM')).toEqual({ code: 0, signal: null })
    const suspended = Store.open(join(a.dataDir, 'gnomeola.db'), { readonly: true })
    const atStop = suspended.getSession(s.id)!
    const segsAtStop = suspended.segments(s.id)
    suspended.close()
    expect(atStop.status).toBe('paused') // suspended for the restart, not stopped
    expect(atStop.error).toMatch(/restarting/)
    expect(existsSync(join(a.dataDir, 'sessions', s.id, 'suspended.json'))).toBe(true)

    const downMs = 1500
    await new Promise((res) => setTimeout(res, downMs))
    await a.restart()
    await waitFor(
      async () => (await a.client.call('getSession', { params: { id: s.id } })).status === 'recording',
      10_000,
      'the session to be recording again',
    )
    const resumed = await a.client.call('getSession', { params: { id: s.id } })
    expect(resumed.error).toBeNull()
    expect(existsSync(join(a.dataDir, 'sessions', s.id, 'suspended.json'))).toBe(false)
    // one restart gap per track, as long as the daemon was really away, where the audio stopped
    const lastEnd = Math.max(...segsAtStop.map((g) => g.endMs))
    for (const t of resumed.tracks) {
      const gaps = t.gaps.filter((g) => g.reason === 'restart')
      expect(gaps, t.kind).toHaveLength(1)
      expect(gaps[0]!.durationMs).toBeGreaterThanOrEqual(downMs)
      expect(gaps[0]!.durationMs).toBeLessThan(downMs + 8_000)
      expect(gaps[0]!.atMs).toBeGreaterThanOrEqual(lastEnd)
    }
    const gap = resumed.tracks[0]!.gaps.find((g) => g.reason === 'restart')!
    const info = await a.client.call('daemonInfo')
    expect(info.resumed).toEqual([{ id: s.id, gapMs: expect.any(Number) }])

    // the transcript keeps growing, after the gap, with everything from before intact
    await waitFor(
      async () => (await transcript(a, s.id)).total >= segsAtStop.length + 4,
      15_000,
      'new segments after the restart',
    )
    const t = (await transcript(a, s.id)).segments
    const before = new Set(segsAtStop.map((g) => g.id))
    const fresh = t.filter((g) => !before.has(g.id))
    expect(fresh.length).toBeGreaterThan(0)
    for (const g of fresh) expect(g.startMs).toBeGreaterThanOrEqual(gap.atMs + gap.durationMs)
    for (const g of segsAtStop) expect(t.find((x) => x.id === g.id)?.text).toBeTruthy()

    // agents carry on: the old lease died with the old daemon, a new one is granted on the live session
    const again = await a.client.call('createAgentLease', {
      params: { id: s.id },
      body: { name: 'claude', mode: 'observe' },
    })
    expect(again.lease.sessionId).toBe(s.id)

    const stopped = await a.client.call('stopSession', { params: { id: s.id } })
    expect(stopped.status).toBe('stopped')
    expect(stopped.durationMs).toBeGreaterThanOrEqual(gap.atMs + gap.durationMs)
    assertNoViolations(
      checkSegments((await transcript(a, s.id)).segments, {
        durationMs: stopped.durationMs,
        requireFinal: true,
      }),
      'resumed transcript',
    )
    await a.kill('SIGTERM')
    assertReplayEqualsState(a.dataDir)
  }, 90_000)

  it('a crash (SIGKILL) mid-meeting resumes too, measured from the last sign of life', async () => {
    const a = await daemon({ GNOMEOLA_RESUME_WINDOW_MS: '60000' })
    const s = await recordUntil(a, 4)
    await a.kill('SIGKILL')
    await new Promise((res) => setTimeout(res, 1000))
    await a.restart()
    await waitFor(
      async () => (await a.client.call('getSession', { params: { id: s.id } })).status === 'recording',
      10_000,
      'the session to be recording again',
    )
    const r = await a.client.call('getSession', { params: { id: s.id } })
    const gap = r.tracks[0]!.gaps.find((g) => g.reason === 'restart')!
    expect(gap.durationMs).toBeGreaterThanOrEqual(900)
    const n = (await transcript(a, s.id)).total
    await waitFor(async () => (await transcript(a, s.id)).total > n, 10_000, 'more segments')
  }, 60_000)

  it('a paused meeting comes back paused, and can be resumed', async () => {
    const a = await daemon({ GNOMEOLA_RESUME_WINDOW_MS: '60000' })
    const s = await recordUntil(a, 2)
    await a.client.call('pauseSession', { params: { id: s.id } })
    await a.kill('SIGTERM')
    await a.restart()
    await a.client.call('daemonInfo') // up
    await waitFor(async () => (await a.client.call('daemonInfo')).resumed.length === 1, 10_000, 'resumed')
    const r = await a.client.call('getSession', { params: { id: s.id } })
    expect(r).toMatchObject({ status: 'paused', error: null })
    expect(r.tracks.flatMap((t) => t.gaps).filter((g) => g.reason === 'restart')).toEqual([]) // paused: no gap
    expect((await a.client.call('resumeSession', { params: { id: s.id } })).status).toBe('recording')
    const n = (await transcript(a, s.id)).total
    await waitFor(async () => (await transcript(a, s.id)).total > n, 10_000, 'more segments')
  }, 60_000)

  it('restart --now --force suspends the meeting; the next daemon resumes it', async () => {
    const a = await daemon({ GNOMEOLA_RESUME_WINDOW_MS: '60000' })
    const s = await recordUntil(a, 2)
    const r = await gnomeola(['daemon', 'restart', '--now', '--force', '--no-wait'], a.baseUrl)
    expect(r.code, r.stderr).toBe(0)
    expect(await a.exited(15_000)).toEqual({ code: DAEMON_EXIT.RESTART, signal: null })
    await a.restart()
    await waitFor(
      async () => (await a.client.call('getSession', { params: { id: s.id } })).status === 'recording',
      10_000,
      'recording again',
    )
  }, 60_000)

  it('after the window, the meeting is closed out as stopped, saying it was a restart (not a crash)', async () => {
    const a = await daemon({ GNOMEOLA_RESUME_WINDOW_MS: '1000' })
    const s = await recordUntil(a, 3)
    await a.kill('SIGTERM')
    const stoppedAt = Date.now()
    await new Promise((res) => setTimeout(res, 2000))
    await a.restart()
    const r = await a.client.call('getSession', { params: { id: s.id } })
    expect(r.status).toBe('stopped')
    expect(r.error).toMatch(/stopped when the daemon restarted, and the daemon was not back within 1 s/)
    expect(r.error).not.toMatch(/crash|interrupt/)
    expect(Math.abs(Date.parse(r.endedAt!) - stoppedAt)).toBeLessThan(1500)
    expect(existsSync(join(a.dataDir, 'sessions', s.id, 'suspended.json'))).toBe(false)
    assertNoViolations(
      checkSegments((await transcript(a, s.id)).segments, { durationMs: r.durationMs }),
      'closed-out transcript',
    )
  }, 60_000)
})
