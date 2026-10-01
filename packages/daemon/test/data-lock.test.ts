import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  acquireDataDirLock,
  assertNotRealDataDirInTests,
  DataDirLockedError,
  DB_FILE,
  LOCK_FILE,
  type LockOwner,
  lockOwner,
  openWriters,
  procStartTime,
  realDataDirs,
} from '../src/data-lock.ts'

// One owner per data dir (src/data-lock.ts): a live owner refuses everyone else, a dead one's lock is
// taken over, and when several processes race for a dir exactly one wins.

const dirs: string[] = []
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'gnomeola-lock-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const owner = (o: Partial<LockOwner>): LockOwner => ({
  pid: 999_999_999,
  startedAt: '2026-10-01T16:00:00.000Z',
  port: 8787,
  host: '127.0.0.1',
  procStart: null,
  token: 'tok-old',
  cmd: 'gnomeolad',
  ...o,
})

describe('the data dir lock', () => {
  it('a second owner is refused while the first holds it, with who and where', () => {
    const dir = tmp()
    const a = acquireDataDirLock(dir)
    a.setAddress('127.0.0.1', 8787)
    expect(a.held).toBe(true)
    let err: unknown
    try {
      acquireDataDirLock(dir)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(DataDirLockedError)
    expect((err as Error).message).toBe(`another gnomeola daemon (pid ${process.pid}, port 8787) owns ${dir}`)
    expect(lockOwner(dir)).toMatchObject({ pid: process.pid, port: 8787, token: a.owner.token })
    a.release()
    expect(existsSync(join(dir, LOCK_FILE))).toBe(false)
    const b = acquireDataDirLock(dir)
    expect(b.takenOverFrom).toBeNull() // a clean release leaves nothing stale
    b.release()
  })

  it('takes over a stale lock (dead owner) and reports when it was last alive', () => {
    const dir = tmp()
    writeFileSync(join(dir, LOCK_FILE), JSON.stringify(owner({ pid: 999_999_999 })))
    const lastAlive = new Date('2026-10-01T16:39:00.000Z')
    utimesSync(join(dir, LOCK_FILE), lastAlive, lastAlive)
    const l = acquireDataDirLock(dir)
    expect(l.takenOverFrom?.owner?.pid).toBe(999_999_999)
    expect(l.takenOverFrom?.lastAliveAt.toISOString()).toBe(lastAlive.toISOString())
    expect(JSON.parse(readFileSync(join(dir, LOCK_FILE), 'utf8')).token).toBe(l.owner.token)
    l.release()
  })

  it('a recycled pid (same pid, different process start time) is not the old owner', () => {
    const dir = tmp()
    // this very process, but "started" at another time: the pid was reused
    writeFileSync(
      join(dir, LOCK_FILE),
      JSON.stringify(owner({ pid: process.pid, procStart: '1', token: 'x' })),
    )
    const self = procStartTime(process.pid)
    if (process.platform === 'linux') expect(self).not.toBeNull()
    // in-process, our own pid is always alive; a different pid with a mismatching start time is stale
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'])
    try {
      writeFileSync(join(dir, LOCK_FILE), JSON.stringify(owner({ pid: child.pid!, procStart: '1' })))
      const l = acquireDataDirLock(dir)
      expect(l.takenOverFrom?.owner?.pid).toBe(child.pid)
      l.release()
      // the same live child with its real start time is a live owner
      writeFileSync(
        join(dir, LOCK_FILE),
        JSON.stringify(owner({ pid: child.pid!, procStart: procStartTime(child.pid!) })),
      )
      expect(() => acquireDataDirLock(dir)).toThrow(DataDirLockedError)
    } finally {
      child.kill('SIGKILL')
    }
  })

  it('an unreadable lock is garbage once it is old, and waited on while it is fresh', () => {
    const dir = tmp()
    const path = join(dir, LOCK_FILE)
    writeFileSync(path, '{"pid": 12') // torn
    const old = new Date(Date.now() - 60_000)
    utimesSync(path, old, old)
    const l = acquireDataDirLock(dir)
    expect(l.takenOverFrom).toMatchObject({ owner: null })
    l.release()
    writeFileSync(path, '') // a (non-atomic) writer mid-write, just now: give it its 2 s
    const t0 = Date.now()
    const again = acquireDataDirLock(dir)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(1900)
    expect(again.takenOverFrom).toMatchObject({ owner: null })
    again.release()
  })

  it('release() never removes a lock that is no longer ours', () => {
    const dir = tmp()
    const l = acquireDataDirLock(dir)
    writeFileSync(join(dir, LOCK_FILE), JSON.stringify(owner({ token: 'someone-else', pid: process.pid })))
    l.release()
    expect(JSON.parse(readFileSync(join(dir, LOCK_FILE), 'utf8')).token).toBe('someone-else')
  })

  it('heartbeat() moves the "last alive" mark', () => {
    const dir = tmp()
    let t = new Date('2026-10-01T16:00:00.000Z')
    const l = acquireDataDirLock(dir, { now: () => t })
    t = new Date('2026-10-01T16:05:00.000Z')
    l.heartbeat()
    l.release()
    writeFileSync(join(dir, LOCK_FILE), JSON.stringify(owner({})))
    utimesSync(join(dir, LOCK_FILE), t, t)
    expect(acquireDataDirLock(dir).takenOverFrom?.lastAliveAt.toISOString()).toBe(t.toISOString())
  })

  it('refuses the real data dir inside a test run (VITEST), whatever the platform default', () => {
    const real = realDataDirs({})
    expect(real).toContain(join(homedir(), '.local', 'share', 'gnomeola'))
    expect(real).toContain(join(homedir(), 'Library', 'Application Support', 'gnomeola'))
    expect(realDataDirs({ GNOMEOLA_TEST_REAL_XDG_DATA_HOME: '/xdg' })).toContain('/xdg/gnomeola')
    for (const d of real)
      expect(() => assertNotRealDataDirInTests(d, { VITEST: 'true' })).toThrow(/refusing to open the real/)
    expect(() => assertNotRealDataDirInTests(`${real[0]}/`, { VITEST: 'true' })).toThrow(/refusing/)
    expect(() => assertNotRealDataDirInTests(real[0]!, {})).not.toThrow() // the real daemon, of course
    expect(() => assertNotRealDataDirInTests(tmp(), { VITEST: 'true' })).not.toThrow()
  })
})

describe.skipIf(process.platform !== 'linux')('a daemon from before the lock (no lock file)', () => {
  /** A process holding `file` open (like a running pre-lock daemon's SQLite), until killed. */
  const holder = async (file: string, flag: 'r+' | 'r') => {
    const c = spawn(process.execPath, [
      '-e',
      `require('fs').openSync(${JSON.stringify(file)}, '${flag}'); console.log('open'); setInterval(() => {}, 1000)`,
    ])
    await new Promise<void>((r) => c.stdout.once('data', () => r()))
    return c
  }

  it('is found by the database it holds open for writing, and refused like a lock', async () => {
    const dir = tmp()
    writeFileSync(join(dir, DB_FILE), '')
    const c = await holder(join(dir, DB_FILE), 'r+')
    try {
      expect(openWriters(join(dir, DB_FILE)).map((w) => w.pid)).toEqual([c.pid])
      expect(() => acquireDataDirLock(dir)).toThrow(`another gnomeola daemon (pid ${c.pid}) owns ${dir}`)
      expect(existsSync(join(dir, LOCK_FILE))).toBe(false) // our attempt leaves nothing behind
    } finally {
      c.kill('SIGKILL')
    }
    await new Promise((r) => c.once('exit', r))
    acquireDataDirLock(dir).release()
  })

  it('a reader (a backup, a read-only store) does not count', async () => {
    const dir = tmp()
    writeFileSync(join(dir, DB_FILE), '')
    const c = await holder(join(dir, DB_FILE), 'r')
    try {
      expect(openWriters(join(dir, DB_FILE))).toEqual([])
      acquireDataDirLock(dir).release()
    } finally {
      c.kill('SIGKILL')
    }
  })
})

describe('racing for one data dir', () => {
  const contender = `
    import { acquireDataDirLock } from ${JSON.stringify(join(import.meta.dirname, '..', 'src', 'data-lock.ts'))}
    const dir = process.argv[1]
    // line up: everyone starts at the same wall-clock instant
    const at = Number(process.argv[2])
    while (Date.now() < at) {}
    try {
      const l = acquireDataDirLock(dir)
      process.stdout.write('WIN ' + (l.takenOverFrom ? 'takeover' : 'fresh'))
      setTimeout(() => { l.release(); process.exit(0) }, 1500)
    } catch (e) {
      process.stdout.write(e.name === 'DataDirLockedError' ? 'LOCKED' : 'ERROR ' + e.message)
    }
  `
  const race = async (dir: string, n: number) => {
    const at = Date.now() + 1500
    const runs = Array.from(
      { length: n },
      () =>
        new Promise<string>((resolve) => {
          const c = spawn(process.execPath, ['--input-type=module', '-e', contender, dir, String(at)], {
            env: { ...process.env, VITEST: '' },
          })
          let out = ''
          c.stdout.on('data', (d) => (out += d))
          c.stderr.on('data', (d) => (out += d))
          c.on('close', () => resolve(out.trim()))
        }),
    )
    return Promise.all(runs)
  }

  it('exactly one of eight simultaneous daemons gets a fresh dir', async () => {
    const results = await race(tmp(), 8)
    expect(
      results.filter((r) => r.startsWith('WIN')),
      results.join(' | '),
    ).toHaveLength(1)
    expect(results.filter((r) => r === 'LOCKED')).toHaveLength(7)
  }, 30_000)

  it('exactly one of eight takes over a stale lock; nobody steals the winner’s', async () => {
    const dir = tmp()
    writeFileSync(join(dir, LOCK_FILE), JSON.stringify(owner({ pid: 999_999_999 })))
    const results = await race(dir, 8)
    expect(
      results.filter((r) => r.startsWith('WIN')),
      results.join(' | '),
    ).toEqual(['WIN takeover'])
    expect(results.filter((r) => r === 'LOCKED')).toHaveLength(7)
  }, 30_000)
})
