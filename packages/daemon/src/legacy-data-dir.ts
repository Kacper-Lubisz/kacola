import { existsSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { LEGACY_NAME, platformPaths } from '@kacola/protocol'
import { legacyDirPending, migrateLegacyDir, settleLegacyDir } from '@kacola/protocol/legacy-dirs'
import { settleSqliteFile } from '@kacola/store'
import {
  type AcquireOptions,
  acquireDataDirLock,
  type DataDirLock,
  DataDirLockedError,
  DB_FILE,
  LOCK_FILE,
  openWriters,
} from './data-lock.ts'

// The data dir's move from its gnomeola name (before 0.2) to its kacola name, on the first start of a
// kacola daemon. Compatibility code for one release (see @kacola/protocol legacy.ts).
//
//   ~/.local/share/gnomeola              → ~/.local/share/kacola              (Linux, install.sh)
//   ~/Library/Application Support/gnomeola → ~/Library/Application Support/kacola  (macOS)
//   gnomeola.db (+ its WAL)              → kacola.db                           (inside it)
//
// Only for the default data dir: an explicit --data-dir / KACOLA_DATA_DIR (or GNOMEOLA_DATA_DIR, adopted
// as it) is used as given. It runs under the data-dir locks — the OLD dir's first, so no old daemon
// (which honours the same daemon.lock, and is also caught holding gnomeola.db open for writing) can start
// on it meanwhile, then the new dir's when it exists — and only when no other daemon owns either. Moving
// is migrateLegacyDir's job (one atomic rename on one filesystem, else a journalled, verified,
// resumable copy); the database is first made one self-contained file (its WAL folded in) and renamed
// to kacola.db, so it can never be separated from its log.
//
// install.sh puts the app itself in ${PREFIX}/share/kacola/{app,desktop}, i.e. inside the default data
// dir: those entries are not data — they never move, and never make the new dir count as existing.

/** The database's name before the rename. */
export const LEGACY_DB_FILE = 'gnomeola.db'
/** install.sh's app and window, which live inside the default data dir. */
const INSTALL_ENTRIES = new Set(['app', 'desktop'])
const isLockFile = (name: string) => name.startsWith(LOCK_FILE)

export class LegacyMigrationRefused extends Error {
  override name = 'LegacyMigrationRefused'
  readonly reason: 'both-exist' | 'in-use'
  constructor(reason: 'both-exist' | 'in-use', message: string) {
    super(message)
    this.reason = reason
  }
}

/** The gnomeola data dir to migrate into `dataDir`, or null when `dataDir` is not the default one. */
export function legacyDataDirFor(
  dataDir: string,
  o: { env: Record<string, string | undefined>; platform: string; home?: string },
): string | null {
  if (o.env.KACOLA_DATA_DIR) return null
  const home = o.home ?? homedir()
  if (platformPaths({ platform: o.platform, env: o.env, home }).dataDir !== dataDir) return null
  return platformPaths({ platform: o.platform, env: o.env, home, name: LEGACY_NAME }).dataDir
}

/**
 * gnomeola.db → kacola.db in `dir`, with its write-ahead log folded in first. The caller owns the dir
 * (holds its lock). Throws when both exist: never pick one silently.
 */
export function renameLegacyDatabase(dir: string): boolean {
  const old = join(dir, LEGACY_DB_FILE)
  if (!existsSync(old)) return false
  const now = join(dir, DB_FILE)
  if (existsSync(now))
    throw new LegacyMigrationRefused(
      'both-exist',
      `both ${old} (gnomeola) and ${now} (kacola) exist; refusing to pick one. Move the one you do not want aside, then start again`,
    )
  settleSqliteFile(old)
  renameSync(old, now)
  return true
}

export type LegacyDataDirResult = {
  /** The lock on `to`, held: the daemon keeps it as its data-dir lock. */
  lock: DataDirLock
  migrated: boolean
}

/**
 * Migrate `from` (the gnomeola data dir) into `to`, then hold `to`'s lock. Throws DataDirLockedError when
 * a daemon (old or new) owns either dir, LegacyMigrationRefused when both hold data.
 */
export function migrateLegacyDataDir(o: {
  from: string
  to: string
  lock?: AcquireOptions
  /** Tests: the cross-filesystem path on one filesystem. */
  forceCopy?: boolean
  log?: (msg: string) => void
}): LegacyDataDirResult {
  const { from, to } = o
  const log = o.log ?? (() => {})
  if (!legacyDirPending(from)) {
    const lock = acquireDataDirLock(to, o.lock)
    try {
      renameLegacyDatabase(to)
    } catch (err) {
      lock.release()
      throw err
    }
    return { lock, migrated: false }
  }
  // the old dir first: refuses while a gnomeola daemon runs on it (its lock, or gnomeola.db open for writing)
  const fromLock = acquireDataDirLock(from, { ...o.lock, checkOpenWriters: false })
  let toLock: DataDirLock | null = null
  try {
    const writers = openWritersOf(from)
    if (writers) throw writers
    if (existsSync(to)) toLock = acquireDataDirLock(to, o.lock)
    const r = migrateLegacyDir({
      from,
      to,
      leave: (e) => INSTALL_ENTRIES.has(e),
      carry: isLockFile,
      ignore: (e) => INSTALL_ENTRIES.has(e) || isLockFile(e),
      prepare: () => {
        if (renameLegacyDatabase(from)) log(`renamed ${LEGACY_DB_FILE} to ${DB_FILE}`)
      },
      ...(o.forceCopy ? { forceCopy: true } : {}),
      log,
    })
    if (r.kind === 'refused') throw new LegacyMigrationRefused(r.reason, r.message)
    if (r.kind === 'migrated' && r.method === 'rename-dir') {
      // our lock travelled with the dir: it is now `to`'s lock, re-taken in place under our token
      const lock = acquireDataDirLock(to, { ...o.lock, replaceToken: fromLock.owner.token })
      return { lock, migrated: true }
    }
    fromLock.release()
    settleLegacyDir(from, to, isLockFile)
    toLock ??= acquireDataDirLock(to, o.lock)
    renameLegacyDatabase(to)
    return { lock: toLock, migrated: r.kind === 'migrated' }
  } catch (err) {
    fromLock.release()
    toLock?.release()
    throw err
  }
}

/** A gnomeola daemon from before the data-dir lock holds no lock file, but has gnomeola.db open for writing. */
function openWritersOf(dir: string): DataDirLockedError | null {
  const w = openWriters(join(dir, LEGACY_DB_FILE))[0] ?? openWriters(join(dir, DB_FILE))[0]
  if (!w) return null
  return new DataDirLockedError(dir, {
    pid: w.pid,
    startedAt: '',
    port: null,
    host: null,
    procStart: null,
    token: 'unlocked-writer',
    cmd: w.cmd,
  })
}
