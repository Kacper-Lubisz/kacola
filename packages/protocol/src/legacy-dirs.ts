// Moving a directory from its gnomeola name to its kacola name (the 0.2 rename), once, safely. Node-only
// (a subpath export, `@kacola/protocol/legacy-dirs`, that the web client never imports); used by the
// daemon for the data dir (under its data-dir locks: packages/daemon/src/legacy-data-dir.ts) and by the
// window and the daemon for the config and state dirs. Removed with legacy.ts in the release after 0.2.
//
// The rules:
//   - nothing to do when the old dir does not exist, or is already the compatibility symlink to the new one;
//   - refused while something still uses the old dir (`inUse`: an old daemon, the old window);
//   - refused when both exist and the new one already holds data — never merged, never guessed: the
//     message names both and says how to resolve it;
//   - same filesystem and nothing to leave behind: ONE atomic rename of the whole dir;
//   - otherwise entry by entry, with a journal (`.kacola-migration.json` in the new dir) so an
//     interrupted migration resumes where it stopped: each entry is renamed (atomic) or, across
//     filesystems, copied to `<entry>.kacola-partial`, verified byte for byte, renamed into place, and
//     only then removed from the old dir. Data is never deleted without a verified copy;
//   - afterwards the old path becomes a symlink to the new one (or, when entries had to stay behind — the
//     installed app lives inside the data dir — gets a note saying where everything went).
import { createHash } from 'node:crypto'
import {
  closeSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  readSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { hostname } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { LEGACY_NAME } from './legacy.ts'
import { platformPaths } from './platform.ts'

export const MIGRATION_JOURNAL = '.kacola-migration.json'
export const MOVED_NOTE = 'MOVED-TO-KACOLA.txt'
const PARTIAL = '.kacola-partial'

export type MigrateDirOptions = {
  from: string
  to: string
  /** Entries of `from` that stay where they are and are not data (the installed app/ and desktop/). */
  leave?: (name: string) => boolean
  /**
   * Entries that travel with a whole-dir rename but are otherwise left in `from` and never count as data
   * (the caller's lock file, held across the move).
   */
  carry?: (name: string) => boolean
  /** Entries of `to` that do not count as data there (the installed app, the new daemon's lock). */
  ignore?: (name: string) => boolean
  /** Something still uses `from`: a description of it, else null. Checked before anything moves. */
  inUse?: () => string | null
  /** Runs once nothing uses `from`, before anything moves (e.g. fold the database's WAL in). */
  prepare?: () => void
  /** Copy instead of rename even on one filesystem (tests: the cross-filesystem path). */
  forceCopy?: boolean
  log?: (msg: string) => void
}

export type MigrateDirResult =
  | { kind: 'none' }
  | { kind: 'migrated'; method: 'rename-dir' | 'rename' | 'copy'; moved: string[] }
  | { kind: 'refused'; reason: 'both-exist' | 'in-use'; message: string }

const isDir = (p: string) => {
  try {
    return lstatSync(p).isDirectory()
  } catch {
    return false
  }
}
const lexists = (p: string) => {
  try {
    lstatSync(p)
    return true
  } catch {
    return false
  }
}

/** The old dir is already handled: missing, or the compatibility symlink. */
export function legacyDirPending(from: string): boolean {
  return isDir(from)
}

function sha256(file: string): string {
  const h = createHash('sha256')
  const fd = openSync(file, 'r')
  try {
    const buf = Buffer.allocUnsafe(1 << 20)
    for (;;) {
      const n = readSync(fd, buf, 0, buf.length, null)
      if (n === 0) break
      h.update(buf.subarray(0, n))
    }
  } finally {
    closeSync(fd)
  }
  return h.digest('hex')
}

/** Is `b` a faithful copy of `a`: the same tree, the same symlinks, the same bytes? */
export function sameTree(a: string, b: string): boolean {
  let sa: ReturnType<typeof lstatSync>
  let sb: ReturnType<typeof lstatSync>
  try {
    sa = lstatSync(a)
    sb = lstatSync(b)
  } catch {
    return false
  }
  if (sa.isSymbolicLink() || sb.isSymbolicLink())
    return sa.isSymbolicLink() && sb.isSymbolicLink() && readlinkSync(a) === readlinkSync(b)
  if (sa.isDirectory() !== sb.isDirectory()) return false
  if (sa.isDirectory()) {
    const ea = readdirSync(a).sort()
    const eb = readdirSync(b).sort()
    return ea.length === eb.length && ea.every((e, i) => e === eb[i] && sameTree(join(a, e), join(b, e)))
  }
  return sa.size === sb.size && sha256(a) === sha256(b)
}

function sameFilesystem(from: string, to: string): boolean {
  try {
    return statSync(from).dev === statSync(existsSync(to) ? to : dirname(to)).dev
  } catch {
    return false
  }
}

type Journal = {
  from: string
  startedAt: string
  method: 'rename' | 'copy'
  /** Copied, verified and in place in the new dir; what is left of the source may go. */
  verified?: string[]
}

function readJournal(to: string): Journal | null {
  try {
    return JSON.parse(readFileSync(join(to, MIGRATION_JOURNAL), 'utf8')) as Journal
  } catch {
    return null
  }
}

/**
 * Turn the emptied old dir into a symlink to the new one, or — when entries stayed behind — leave a note
 * there. Entries matching `drop` (stale lock files) are removed first. Safe to call more than once.
 */
export function settleLegacyDir(
  from: string,
  to: string,
  drop: (name: string) => boolean = () => false,
): void {
  if (!isDir(from)) return
  for (const e of readdirSync(from)) if (drop(e)) rmSync(join(from, e), { recursive: true, force: true })
  const rest = readdirSync(from).filter((e) => e !== MOVED_NOTE)
  if (rest.length === 0) {
    rmSync(join(from, MOVED_NOTE), { force: true })
    rmdirSync(from)
    symlinkSync(resolve(to), from)
    return
  }
  writeFileSync(
    join(from, MOVED_NOTE),
    `kacola (formerly gnomeola) moved this directory's contents to\n  ${resolve(to)}\n` +
      `What is left here (${rest.join(', ')}) is not data; it goes once the old install is removed.\n`,
  )
}

/** Move `from` to `to` by the rules at the top of this file. */
export function migrateLegacyDir(o: MigrateDirOptions): MigrateDirResult {
  const { from, to } = o
  const leave = o.leave ?? (() => false)
  const carry = o.carry ?? (() => false)
  const ignore = o.ignore ?? (() => false)
  const log = o.log ?? (() => {})
  if (!isDir(from)) return { kind: 'none' }
  if (lexists(to) && !isDir(to))
    return {
      kind: 'refused',
      reason: 'both-exist',
      message: `${to} exists and is not a directory; move it aside so ${from} can be migrated there`,
    }
  const user = o.inUse?.() ?? null
  if (user)
    return {
      kind: 'refused',
      reason: 'in-use',
      message: `${from} is still in use (${user}); it is migrated to ${to} once that has stopped`,
    }
  const journal = isDir(to) ? readJournal(to) : null
  if (isDir(to) && !journal) {
    const data = readdirSync(to).filter(
      (e) => !ignore(e) && !carry(e) && !e.startsWith(MIGRATION_JOURNAL) && !e.endsWith(PARTIAL),
    )
    if (data.length > 0)
      return {
        kind: 'refused',
        reason: 'both-exist',
        message:
          `both ${from} (gnomeola, before the rename) and ${to} (kacola) hold data (${data.slice(0, 5).join(', ')}` +
          `${data.length > 5 ? ', …' : ''}); refusing to merge them. Keep the one you want: move the other ` +
          `aside (e.g. mv ${to} ${to}.unused), then start again`,
      }
  }
  o.prepare?.()

  const sources = readdirSync(from)
  const leftBehind = sources.filter((e) => leave(e))
  const copy = o.forceCopy === true || !sameFilesystem(from, to)
  if (!copy && !journal && !lexists(to) && leftBehind.length === 0) {
    mkdirSync(dirname(to), { recursive: true })
    renameSync(from, to)
    symlinkSync(resolve(to), from)
    log(`moved ${from} to ${to} (one rename)`)
    return { kind: 'migrated', method: 'rename-dir', moved: sources.filter((e) => !carry(e)) }
  }

  const method: Journal['method'] = journal?.method ?? (copy ? 'copy' : 'rename')
  mkdirSync(to, { recursive: true, mode: 0o700 })
  const state: Journal = journal ?? { from: resolve(from), startedAt: new Date().toISOString(), method }
  const saveJournal = () => {
    const tmp = join(to, `${MIGRATION_JOURNAL}.tmp`)
    writeFileSync(tmp, `${JSON.stringify(state)}\n`)
    renameSync(tmp, join(to, MIGRATION_JOURNAL))
  }
  if (!journal) saveJournal()
  else log(`resuming the interrupted migration of ${from} to ${to}`)
  const moved: string[] = []
  for (const e of sources) {
    if (leave(e) || carry(e) || e === MOVED_NOTE) continue
    const src = join(from, e)
    const dst = join(to, e)
    rmSync(`${dst}${PARTIAL}`, { recursive: true, force: true }) // an interrupted copy starts again
    if (lexists(dst)) {
      // resuming: a verified copy whose source was not (completely) removed yet
      if (journal && (state.verified?.includes(e) || sameTree(src, dst))) {
        rmSync(src, { recursive: true, force: true })
        moved.push(e)
        continue
      }
      return {
        kind: 'refused',
        reason: 'both-exist',
        message: `both ${src} and ${dst} exist and differ; refusing to overwrite either. Move one aside and start again`,
      }
    }
    if (method === 'rename' && !copy) renameSync(src, dst)
    else {
      try {
        cpSync(src, `${dst}${PARTIAL}`, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true })
      } catch (err) {
        rmSync(`${dst}${PARTIAL}`, { recursive: true, force: true })
        throw err
      }
      if (!sameTree(src, `${dst}${PARTIAL}`)) {
        rmSync(`${dst}${PARTIAL}`, { recursive: true, force: true })
        throw new Error(`copying ${src} to ${dst} did not verify; nothing was removed`)
      }
      renameSync(`${dst}${PARTIAL}`, dst)
      state.verified = [...(state.verified ?? []), e]
      saveJournal()
      rmSync(src, { recursive: true, force: true })
    }
    moved.push(e)
  }
  rmSync(join(to, MIGRATION_JOURNAL), { force: true })
  settleLegacyDir(from, to, () => false)
  log(
    `moved ${moved.length} entries of ${from} to ${to} (${method}${leftBehind.length ? `; left ${leftBehind.join(', ')}` : ''})`,
  )
  return { kind: 'migrated', method, moved }
}

/** The old window's Chromium profile lock in `dir` (SingletonLock → "<host>-<pid>"), if its owner is alive. */
export function chromiumProfileInUse(dir: string, host = hostname()): string | null {
  let target: string
  try {
    target = readlinkSync(join(dir, 'SingletonLock'))
  } catch {
    return null
  }
  const m = /^(.*)-(\d+)$/.exec(target)
  if (!m || m[1] !== host) return null
  try {
    process.kill(Number(m[2]), 0)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EPERM') return null
  }
  return `the gnomeola window, pid ${m[2]}`
}

export type UserDirsInput = {
  platform: string
  env: Record<string, string | undefined>
  home: string
  log?: (msg: string) => void
}

/** The small files worth carrying over when the new dir already exists (both-exist is not fatal here). */
const KEEP: Record<'configDir' | 'stateDir', string[]> = {
  configDir: ['hosts.json', 'autostart.json'],
  stateDir: ['ui-state.json'],
}

/**
 * Linux (and Flatpak): move the config dir (paired hosts, the window's Chromium profile and autostart
 * choice) and the state dir (ui-state.json) from their gnomeola names. Both are conveniences, not
 * recordings, so this never stops anything from starting: while the old window still runs, it waits for
 * a later start; when the new dirs exist already, it copies over just the files that matter and are
 * missing. macOS keeps all of it inside the data dir, which the daemon migrates.
 */
export function migrateLegacyUserDirs(i: UserDirsInput): void {
  if (i.platform === 'darwin') return
  const log = i.log ?? (() => {})
  const now = platformPaths({ platform: i.platform, env: i.env, home: i.home })
  const old = platformPaths({ platform: i.platform, env: i.env, home: i.home, name: LEGACY_NAME })
  for (const key of ['configDir', 'stateDir'] as const) {
    const from = old[key]
    const to = now[key]
    try {
      const r = migrateLegacyDir({ from, to, inUse: () => chromiumProfileInUse(from), log })
      if (r.kind === 'refused' && r.reason === 'both-exist')
        for (const f of KEEP[key])
          if (existsSync(join(from, f)) && !existsSync(join(to, f))) {
            cpSync(join(from, f), join(to, f), { preserveTimestamps: true })
            log(`copied ${join(from, f)} to ${to}`)
          }
      if (r.kind === 'refused' && r.reason === 'in-use') log(r.message)
    } catch (err) {
      log(`could not migrate ${from} to ${to}: ${(err as Error).message}`)
    }
  }
}

/** A daemon still holding `dir` (its daemon.lock names a live pid), if any. */
export function daemonLockInUse(dir: string): string | null {
  let pid: unknown
  try {
    pid = (JSON.parse(readFileSync(join(dir, 'daemon.lock'), 'utf8')) as { pid?: unknown }).pid
  } catch {
    return null
  }
  if (typeof pid !== 'number') return null
  try {
    process.kill(pid, 0)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EPERM') return null
  }
  return `a gnomeola daemon, pid ${pid}`
}

/**
 * macOS: the old app kept everything (data, config, its Chromium profile) in Application
 * Support/gnomeola. The window moves it before Chromium creates the new one; the daemon it then starts
 * finds nothing left to move, and renames the database under its lock.
 */
export function migrateLegacyMacDir(i: UserDirsInput): MigrateDirResult {
  if (i.platform !== 'darwin' || i.env.KACOLA_DATA_DIR) return { kind: 'none' }
  const from = platformPaths({ platform: 'darwin', env: {}, home: i.home, name: LEGACY_NAME }).dataDir
  const to = platformPaths({ platform: 'darwin', env: {}, home: i.home }).dataDir
  return migrateLegacyDir({
    from,
    to,
    inUse: () => chromiumProfileInUse(from) ?? daemonLockInUse(from),
    ...(i.log ? { log: i.log } : {}),
  })
}
