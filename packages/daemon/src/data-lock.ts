import { randomBytes } from 'node:crypto'
import {
  closeSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { platformPaths } from '@gnomeola/protocol'

// One owner per data dir. Everything that opens the store read-write and may run recovery (the daemon,
// in whatever process composes it) takes `<dataDir>/daemon.lock` first; a second owner is refused before
// it has opened the database, rotated a log or looked at a session.
//
// Why: on 2026-10-01 a second daemon started on the live data dir (the desktop window's fallback daemon,
// spawned because the real one answered /health slowly under load) ran recover() over a meeting that
// was still being recorded, marking it `recovered` and patching WAV headers that were still being written.
//
// The file holds who owns the dir: pid, start time, port and a random token. It is created atomically —
// written to a private temp file and hard-linked into place, so the lock never exists half-written (a
// plain `wx` create would leave a window where another process reads an empty file) — and `wx` is the
// fallback where hard links are not supported. A lock whose owner is gone (a crash, an OOM kill, a
// reboot) is stale and taken over; liveness is `kill(pid, 0)` plus, on Linux, the process's start time
// from /proc/<pid>/stat, so a recycled pid is not mistaken for the old owner.
//
// Taking over a stale lock: exactly one contender may remove a given stale lock, and it moves it aside
// to `daemon.lock.prev` instead of deleting it; whoever then creates the new lock reads `.prev` to learn
// whom it replaced and when that owner was last alive. (The remover is often not the winner — another
// contender's create can land first — so the winner cannot rely on having judged the stale lock itself.)
//
// While it runs, the owner touches the lock every few seconds (`heartbeat()`): after a crash its mtime
// says when the daemon was last alive, which the next one uses to measure the gap it resumes across.

export const LOCK_FILE = 'daemon.lock'

export type LockOwner = {
  pid: number
  /** ISO time the owner took the lock. */
  startedAt: string
  /** Listening port once known (null while starting). */
  port: number | null
  host: string | null
  /** /proc/<pid>/stat field 22 (start time in clock ticks since boot), Linux only. */
  procStart: string | null
  /** Distinguishes two owners in one process (in-process daemons in tests). */
  token: string
  /** argv of the owner, for the refusal message and diagnostics. */
  cmd: string
}

export class DataDirLockedError extends Error {
  override name = 'DataDirLockedError'
  readonly owner: LockOwner
  readonly dataDir: string
  constructor(dataDir: string, owner: LockOwner) {
    super(
      `another gnomeola daemon (pid ${owner.pid}${owner.port ? `, port ${owner.port}` : ''}) owns ${dataDir}`,
    )
    this.owner = owner
    this.dataDir = dataDir
  }
}

export type DataDirLock = {
  readonly dataDir: string
  readonly path: string
  readonly owner: LockOwner
  /** When the previous owner was last known alive, if this lock replaced a stale one. */
  readonly takenOverFrom: { owner: LockOwner | null; lastAliveAt: Date } | null
  /** True until release(), and only while the file on disk is still ours. */
  readonly held: boolean
  /** Record the listening address once bound. */
  setAddress(host: string, port: number): void
  /** Touch the file (the "last alive" mark). Cheap; call every few seconds. */
  heartbeat(): void
  /** Remove the lock if it is still ours. Idempotent. */
  release(): void
}

/** The database file the lock protects (see openWriters). */
export const DB_FILE = 'gnomeola.db'

/**
 * Other processes that have `file` (or its -wal / -journal) open for WRITING, from /proc/<pid>/fd and
 * fdinfo (Linux; [] elsewhere, or for processes we may not inspect — other users'). Readers (a
 * read-only Store, a backup) do not count.
 */
export function openWriters(file: string, selfPid = process.pid): { pid: number; cmd: string }[] {
  const targets = new Set([file, `${file}-wal`, `${file}-journal`].map((f) => resolve(f)))
  let pids: string[]
  try {
    pids = readdirSync('/proc').filter((d) => /^\d+$/.test(d))
  } catch {
    return []
  }
  const out: { pid: number; cmd: string }[] = []
  for (const p of pids) {
    const pid = Number(p)
    if (pid === selfPid) continue
    let fds: string[]
    try {
      fds = readdirSync(`/proc/${p}/fd`)
    } catch {
      continue
    }
    for (const fd of fds) {
      let target: string
      try {
        target = readlinkSync(`/proc/${p}/fd/${fd}`)
      } catch {
        continue
      }
      if (!targets.has(target)) continue
      let writable = true
      try {
        const flags = /^flags:\s*([0-7]+)/m.exec(readFileSync(`/proc/${p}/fdinfo/${fd}`, 'utf8'))?.[1]
        if (flags !== undefined) writable = (Number.parseInt(flags, 8) & 3) !== 0 // O_ACCMODE != O_RDONLY
      } catch {}
      if (!writable) continue
      let cmd = ''
      try {
        cmd = readFileSync(`/proc/${p}/cmdline`, 'utf8').split('\0').join(' ').trim().slice(0, 300)
      } catch {}
      out.push({ pid, cmd })
      break
    }
  }
  return out
}

export type AcquireOptions = {
  /**
   * Also refuse while another process has the database open for writing (a daemon from before this
   * lock, which holds no lock file). Default true.
   */
  checkOpenWriters?: boolean
  pid?: number
  /** Liveness of another process (tests inject). Default: kill(pid, 0) + /proc start time. */
  isAlive?: (owner: LockOwner) => boolean
  now?: () => Date
  /**
   * Refuse to lock the user's real data dir from inside a test run (VITEST set). Default true: the
   * belt-and-braces half of test isolation (scripts/test-env.ts is the other half).
   */
  guardTests?: boolean
  env?: NodeJS.ProcessEnv
}

/** /proc/<pid>/stat fields after comm (index 0 = field 3, state), or null off Linux / for a gone process. */
function procStat(pid: number): string[] | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    // comm (field 2) may contain spaces and parentheses: split after the LAST ')'
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')
  } catch {
    return null
  }
}

/** /proc/<pid>/stat field 22, or null off Linux / for a gone process. */
export function procStartTime(pid: number): string | null {
  return procStat(pid)?.[19] ?? null // field 22 overall = index 19 after state (field 3)
}

export function defaultIsAlive(owner: Pick<LockOwner, 'pid' | 'procStart'>): boolean {
  try {
    process.kill(owner.pid, 0)
  } catch (err) {
    // EPERM: it exists but is not ours to signal — alive (and not a gnomeola of this user, but still
    // not something to take the dir from)
    if ((err as NodeJS.ErrnoException).code !== 'EPERM') return false
  }
  if (owner.pid === process.pid) return true
  // a zombie (exited, not yet reaped by its parent) still answers kill(pid, 0), but it is dead
  if (procStat(owner.pid)?.[0] === 'Z') return false
  if (owner.procStart !== null) {
    const now = procStartTime(owner.pid)
    // a different start time is a recycled pid; null means /proc vanished between the two checks
    if (now !== null && now !== owner.procStart) return false
    if (now === null && process.platform === 'linux') return false
  }
  return true
}

/** The directories a test run must never take: the user's real default data dir(s). */
export function realDataDirs(env: NodeJS.ProcessEnv = process.env): string[] {
  const home = homedir()
  const dirs = new Set<string>()
  for (const platform of ['linux', 'darwin'])
    dirs.add(resolve(platformPaths({ platform, env: {}, home }).dataDir))
  // scripts/test-env.ts records the real XDG_DATA_HOME before pointing the tiers at a temp one
  const realXdg = env.GNOMEOLA_TEST_REAL_XDG_DATA_HOME
  if (realXdg) dirs.add(resolve(join(realXdg, 'gnomeola')))
  return [...dirs]
}

export function assertNotRealDataDirInTests(dataDir: string, env: NodeJS.ProcessEnv = process.env): void {
  if (!env.VITEST) return
  const dir = resolve(dataDir)
  if (realDataDirs(env).includes(dir))
    throw new Error(
      `refusing to open the real gnomeola data dir ${dir} from a test run (VITEST is set): ` +
        'pass a temp --data-dir (scripts/test-env.ts points XDG_DATA_HOME at a temp dir for every tier)',
    )
}

function readOwner(path: string): LockOwner | null | 'missing' {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 'missing'
    throw err
  }
  try {
    const o = JSON.parse(text) as Partial<LockOwner>
    if (typeof o.pid !== 'number' || typeof o.token !== 'string') return null
    return {
      pid: o.pid,
      startedAt: String(o.startedAt ?? ''),
      port: typeof o.port === 'number' ? o.port : null,
      host: typeof o.host === 'string' ? o.host : null,
      procStart: typeof o.procStart === 'string' ? o.procStart : null,
      token: o.token,
      cmd: String(o.cmd ?? ''),
    }
  } catch {
    return null
  }
}

/** Read who owns a data dir right now (null: nobody, or a stale lock). For status and diagnostics. */
export function lockOwner(dataDir: string, isAlive = defaultIsAlive): LockOwner | null {
  const o = readOwner(join(dataDir, LOCK_FILE))
  if (o === 'missing' || o === null) return null
  return isAlive(o) ? o : null
}

function writeFileDurably(path: string, text: string, flag: 'wx' | 'w'): void {
  const fd = openSync(path, flag, 0o600)
  try {
    writeSync(fd, text)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}

/** Create `path` with `text`, failing with EEXIST if it exists. Never leaves a partial file at `path`. */
function createExclusive(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  writeFileDurably(tmp, text, 'wx')
  try {
    linkSync(tmp, path)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'EPERM' && code !== 'ENOTSUP' && code !== 'EOPNOTSUPP' && code !== 'ENOSYS') throw err
    // no hard links here (some FUSE / network filesystems): the plain exclusive create
    writeFileDurably(path, text, 'wx')
  } finally {
    try {
      unlinkSync(tmp)
    } catch {}
  }
}

const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** Where a takeover moves the stale lock it replaced (read and removed by the next owner). */
export const PREV_LOCK_SUFFIX = '.prev'

type Claim = { pid: number; procStart: string | null }

function readClaim(path: string): Claim | null | 'missing' {
  try {
    const o = JSON.parse(readFileSync(path, 'utf8')) as Partial<Claim>
    if (typeof o.pid !== 'number') return null
    return { pid: o.pid, procStart: typeof o.procStart === 'string' ? o.procStart : null }
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : null
  }
}

/**
 * Move the stale lock we judged — and only that one — aside to `daemon.lock.prev`.
 *
 * Moving a lock away by name is not atomic with checking what it holds, so removal must be exclusive:
 * the remover re-reads the lock and moves it only if it is still the one judged stale. That is safe
 * because nobody can create a new lock while the stale one exists, and only the one holder of the
 * claim for THIS stale lock may move it, so the file cannot change between its re-read and its rename.
 *
 * The claim is `daemon.lock.takeover.<stale token>.<n>`, created exclusively. It is never cleared on a
 * timer: an earlier version cleared a 5 s old claim, which let a second remover in beside a stalled
 * first one, and the stalled one would then delete the new owner's live lock. A claim whose holder has
 * died is skipped instead (the next contender takes claim n+1). Claims are keyed by the stale lock's
 * token, which never comes back once that lock is gone, so a late contender that claims afresh only
 * re-reads a different lock and leaves it alone.
 */
function removeStale(path: string, judged: LockOwner | null, judgedIno: number): void {
  const id = (judged ? `t-${judged.token}` : `ino-${judgedIno}`).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80)
  const claimPath = (n: number) => `${path}.takeover.${id}.${n}`
  const me = JSON.stringify({ pid: process.pid, procStart: procStartTime(process.pid) })
  let n = 0
  for (let tries = 0; ; tries++) {
    if (tries > 1000) return // pathological churn: the caller's loop (and its deadline) retries
    try {
      createExclusive(claimPath(n), me)
      break
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    }
    const holder = readClaim(claimPath(n))
    if (holder === 'missing') continue // its holder just finished: claim it again (and find the lock moved)
    let fresh = true
    try {
      fresh = Date.now() - statSync(claimPath(n)).mtimeMs < 2000
    } catch {}
    // A live holder is moving the lock right now: back off and look again. An unreadable claim (only
    // possible from the non-atomic wx fallback) gets the same 2 s grace as an unreadable lock.
    if (holder === null ? fresh : defaultIsAlive(holder)) {
      pause(10)
      return
    }
    n++ // its holder died mid-takeover: the next claim
  }
  try {
    let again: LockOwner | null | 'missing'
    let ino: number
    try {
      again = readOwner(path)
      ino = statSync(path).ino
    } catch {
      return // gone already
    }
    if (again === 'missing') return
    const same = again === null ? judged === null && ino === judgedIno : again.token === judged?.token
    // rename keeps the file's mtime (the stale owner's last heartbeat) for whoever wins next
    if (same) renameSync(path, `${path}${PREV_LOCK_SUFFIX}`)
  } finally {
    for (let i = 0; i <= n; i++)
      try {
        unlinkSync(claimPath(i))
      } catch {}
  }
}

/** The stale lock the last takeover moved aside, and when its owner was last alive. Consumed. */
function takePrevious(path: string): DataDirLock['takenOverFrom'] {
  const prev = `${path}${PREV_LOCK_SUFFIX}`
  let lastAliveAt: Date
  try {
    lastAliveAt = statSync(prev).mtime
  } catch {
    return null
  }
  const o = readOwner(prev)
  try {
    unlinkSync(prev)
  } catch {}
  return { owner: o === 'missing' ? null : o, lastAliveAt }
}

/**
 * Take the data dir, or throw DataDirLockedError naming its live owner. Stale locks are taken over;
 * a race between two starting daemons is decided by the atomic create (exactly one wins).
 */
export function acquireDataDirLock(dataDir: string, o: AcquireOptions = {}): DataDirLock {
  const env = o.env ?? process.env
  if (o.guardTests ?? true) assertNotRealDataDirInTests(dataDir, env)
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  const path = join(dataDir, LOCK_FILE)
  const pid = o.pid ?? process.pid
  const isAlive = o.isAlive ?? defaultIsAlive
  const now = o.now ?? (() => new Date())
  const owner: LockOwner = {
    pid,
    startedAt: now().toISOString(),
    port: null,
    host: null,
    procStart: procStartTime(pid),
    token: randomBytes(12).toString('hex'),
    cmd: process.argv.slice(1).join(' ').slice(0, 300),
  }
  const giveUpAt = Date.now() + 10_000
  for (;;) {
    if (Date.now() > giveUpAt) throw new Error(`could not lock ${dataDir}: the lock kept changing under us`)
    try {
      createExclusive(path, JSON.stringify(owner))
      break
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    }
    const cur = readOwner(path)
    if (cur === 'missing') continue // released between our create and our read: try again
    if (cur !== null && isAlive(cur)) throw new DataDirLockedError(dataDir, cur)
    // Stale (dead owner) or unreadable. Unreadable is only possible from a non-atomic writer (the wx
    // fallback, mid-write): give such a file a moment before declaring it garbage.
    let st: { mtime: Date; ino: number }
    try {
      st = statSync(path)
    } catch {
      continue
    }
    if (cur === null && now().getTime() - st.mtime.getTime() < 2000) {
      pause(50)
      continue
    }
    // Moved aside to .prev, where whoever wins the dir next (often not us: another contender's create
    // can land first) learns whom it replaced and when that owner was last alive.
    removeStale(path, cur, st.ino)
  }
  // A daemon from before this lock existed (the one running while this version is installed) holds no
  // lock file, but it does hold the database open for writing: ask the kernel who has it open.
  if (o.checkOpenWriters ?? true) {
    const writer = openWriters(join(dataDir, DB_FILE), pid)[0]
    if (writer) {
      try {
        unlinkSync(path)
      } catch {}
      throw new DataDirLockedError(dataDir, {
        pid: writer.pid,
        startedAt: '',
        port: null,
        host: null,
        procStart: procStartTime(writer.pid),
        token: 'unlocked-writer',
        cmd: writer.cmd,
      })
    }
  }
  // only now, with the dir ours (a refusal above leaves .prev for whoever does win it)
  const takenOverFrom = takePrevious(path)
  let held = true
  const stillOurs = () => {
    const cur = readOwner(path)
    return cur !== 'missing' && cur !== null && cur.token === owner.token
  }
  const lock: DataDirLock = {
    dataDir,
    path,
    owner,
    takenOverFrom,
    get held() {
      return held
    },
    setAddress(host, port) {
      if (!held || !stillOurs()) return
      owner.host = host
      owner.port = port
      // replace atomically: write a temp file and rename it over the lock (we own it)
      const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
      writeFileDurably(tmp, JSON.stringify(owner), 'wx')
      renameSync(tmp, path)
    },
    heartbeat() {
      if (!held) return
      try {
        const t = now()
        utimesSync(path, t, t)
      } catch {}
    },
    release() {
      if (!held) return
      held = false
      try {
        if (stillOurs()) unlinkSync(path)
      } catch {}
    },
  }
  return lock
}
