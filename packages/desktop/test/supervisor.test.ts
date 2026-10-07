import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it } from 'vitest'
import { type ChildLike, DaemonSupervisor, type SupervisorOptions } from '../src/main/supervisor.ts'
import type { DaemonStatus } from '../src/shared/bridge.ts'
import { until } from './helpers.ts'

// The supervisor against a fake world: `up` is whether anything answers /health, spawned children are
// fakes the test can crash, and backoffs are milliseconds.

class FakeChild extends EventEmitter {
  pid: number
  exitCode: number | null = null
  killed: NodeJS.Signals[] = []
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  constructor(pid: number) {
    super()
    this.pid = pid
  }
  kill(sig: NodeJS.Signals = 'SIGTERM') {
    this.killed.push(sig)
    queueMicrotask(() => this.exit(null, sig))
    return true
  }
  exit(code: number | null, sig: NodeJS.Signals | null = null) {
    if (this.exitCode !== null) return
    this.exitCode = code ?? 1
    this.emit('exit', code, sig)
  }
}

const sups: DaemonSupervisor[] = []
afterEach(async () => {
  await Promise.all(sups.splice(0).map((s) => s.stop(50)))
})

function world(o: Partial<SupervisorOptions> & { up?: boolean | 'busy'; healthyAfterSpawn?: boolean } = {}) {
  const w = {
    up: (o.up ?? false) as boolean | 'busy',
    isRecording: false,
    askedToExitWhenIdle: 0,
    healthyAfterSpawn: o.healthyAfterSpawn ?? true,
    children: [] as FakeChild[],
    spawns: [] as { cmd: string; args: string[]; env: NodeJS.ProcessEnv }[],
    statuses: [] as DaemonStatus[],
  }
  const sup = new DaemonSupervisor({
    baseUrl: 'http://127.0.0.1:8787',
    loopback: true,
    entry: '/app/daemon.mjs',
    args: ['--data-dir', '/tmp/d'],
    execPath: '/app/electron',
    env: { HOME: '/home/u' },
    initialBackoffMs: 10,
    maxBackoffMs: 40,
    stableAfterMs: 10_000,
    watchMs: 10,
    startTimeoutMs: 300,
    health: async () => w.up,
    recording: async () => w.isRecording,
    exitWhenIdle: async () => {
      w.askedToExitWhenIdle++
      return true
    },
    spawn: (cmd, args, env) => {
      w.spawns.push({ cmd, args, env })
      const c = new FakeChild(1000 + w.children.length)
      w.children.push(c)
      if (w.healthyAfterSpawn) setTimeout(() => (w.up = c.exitCode === null), 5)
      c.once('exit', () => {
        w.up = false
      })
      return c as unknown as ChildLike
    },
    onStatus: (s) => w.statuses.push(s),
    ...o,
  })
  sups.push(sup)
  return { w, sup }
}

describe('DaemonSupervisor', () => {
  it('attaches to a daemon that already answers, and spawns nothing', async () => {
    const { w, sup } = world({ up: true })
    expect(await sup.start()).toEqual({ kind: 'attached' })
    expect(w.spawns).toHaveLength(0)
  })

  it('spawns the entry on this runtime with ELECTRON_RUN_AS_NODE when nothing answers', async () => {
    const { w, sup } = world()
    const s = await sup.start()
    expect(s).toEqual({ kind: 'spawned', pid: 1000 })
    expect(w.spawns[0]).toEqual({
      cmd: '/app/electron',
      args: ['/app/daemon.mjs', '--host', '127.0.0.1', '--port', '8787', '--data-dir', '/tmp/d'],
      env: { HOME: '/home/u', ELECTRON_RUN_AS_NODE: '1', KACOLA_SUPERVISED: '1' },
    })
    expect(w.statuses.map((x) => x.kind)).toEqual(['starting', 'spawned'])
  })

  it('restarts a crashed daemon with doubling backoff, capped', async () => {
    const { w, sup } = world({ healthyAfterSpawn: false })
    // never healthy: every attempt times out → restarting 10, 20, 40, 40 …
    void sup.start()
    await until(() => w.statuses.filter((s) => s.kind === 'restarting').length >= 4, 5000)
    const delays = w.statuses.flatMap((s) => (s.kind === 'restarting' ? [s.inMs] : []))
    expect(delays.slice(0, 4)).toEqual([10, 20, 40, 40])
    // each failed child was killed, not leaked
    for (const c of w.children.slice(0, 3)) expect(c.exitCode).not.toBeNull()
  })

  it('restarts after a crash of a healthy daemon, reporting why', async () => {
    const { w, sup } = world()
    await sup.start()
    w.children[0]!.exit(134, null)
    await until(() => w.statuses.some((s) => s.kind === 'spawned' && s.pid === 1001))
    const r = w.statuses.find((s) => s.kind === 'restarting')
    expect(r).toMatchObject({ attempt: 1, lastError: 'daemon exited (code 134, signal null)' })
  })

  it('attaches instead of respawning when something else took the port meanwhile', async () => {
    const { w, sup } = world()
    await sup.start()
    w.healthyAfterSpawn = false
    w.children[0]!.exit(1)
    w.up = true // e.g. the user started kacolad from systemd
    await until(() => sup.status.kind === 'attached')
    expect(w.spawns).toHaveLength(1)
  })

  it('takes over when an attached daemon goes away', async () => {
    const { w, sup } = world({ up: true })
    await sup.start()
    w.up = false
    await until(() => sup.status.kind === 'spawned')
    expect(w.spawns).toHaveLength(1)
  })

  it('never spawns for a remote URL: unreachable, then attached when it answers', async () => {
    const { w, sup } = world({ baseUrl: 'https://kacola.example.com', loopback: false })
    expect(await sup.start()).toMatchObject({ kind: 'unreachable' })
    w.up = true
    await until(() => sup.status.kind === 'attached')
    expect(w.spawns).toHaveLength(0)
  })

  it('is unreachable when there is no entry to start', async () => {
    const { sup } = world({ entry: null })
    expect(await sup.start()).toMatchObject({
      kind: 'unreachable',
      error: expect.stringContaining('no daemon to start'),
    })
  })

  it('a busy daemon (slow /health) is attached to, never replaced', async () => {
    const { w, sup } = world({ up: 'busy' })
    expect(await sup.start()).toEqual({ kind: 'attached' })
    // it stays busy for many watch periods: still attached, still nothing spawned
    await new Promise((r) => setTimeout(r, 100))
    expect(sup.status).toEqual({ kind: 'attached' })
    expect(w.spawns).toHaveLength(0)
  })

  it('a child that exits for a requested restart (76) is started again at once, not as a crash', async () => {
    const { w, sup } = world()
    await sup.start()
    w.children[0]!.exit(76)
    await until(() => w.statuses.some((s) => s.kind === 'spawned' && s.pid === 1001))
    expect(w.statuses.find((s) => s.kind === 'restarting')).toEqual({
      kind: 'restarting',
      attempt: 0,
      inMs: 0,
      lastError: 'restart requested',
    })
  })

  it('a child refused the data dir (75: another daemon owns it) says so', async () => {
    const { w, sup } = world({ healthyAfterSpawn: false })
    void sup.start()
    await until(() => w.children.length >= 1)
    w.children[0]!.exit(75)
    await until(() => w.statuses.some((s) => s.kind === 'restarting'))
    expect(w.statuses.find((s) => s.kind === 'restarting')).toMatchObject({
      lastError: expect.stringContaining('another kacola daemon owns the data dir'),
    })
  })

  it('quitting while our daemon records leaves it running, asked to exit once the recording ends', async () => {
    const { w, sup } = world()
    await sup.start()
    w.isRecording = true
    await sup.stop(50)
    expect(w.children[0]!.killed).toEqual([])
    expect(w.askedToExitWhenIdle).toBe(1)
    expect(sup.left).toEqual({ pid: 1000, asked: true })
    expect(sup.status).toEqual({ kind: 'stopped' })
  })

  it('stop() terminates the daemon it started, and only that', async () => {
    const { w, sup } = world()
    await sup.start()
    await sup.stop(50)
    expect(w.children[0]!.killed).toEqual(['SIGTERM'])
    expect(sup.status).toEqual({ kind: 'stopped' })
    const attached = world({ up: true })
    await attached.sup.start()
    await attached.sup.stop(50)
    expect(attached.w.children).toHaveLength(0)
  })
})
