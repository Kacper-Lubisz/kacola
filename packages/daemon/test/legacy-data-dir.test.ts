import { type ChildProcess, spawn } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { MIGRATION_JOURNAL, MOVED_NOTE } from '@kacola/protocol/legacy-dirs'
import { afterEach, describe, expect, it } from 'vitest'
import { DataDirLockedError, DB_FILE, LOCK_FILE } from '../src/data-lock.ts'
import {
  LEGACY_DB_FILE,
  LegacyMigrationRefused,
  legacyDataDirFor,
  migrateLegacyDataDir,
} from '../src/legacy-data-dir.ts'

// The first kacola daemon moves the gnomeola data dir (src/legacy-data-dir.ts): a fresh install, a
// migration (one rename; entry by entry beside an installed app; across filesystems, interrupted and
// resumed), and the refusals — both dirs hold data, or an old daemon still runs on the old one.

const roots: string[] = []
const children: ChildProcess[] = []
afterEach(async () => {
  for (const c of children.splice(0)) {
    c.kill('SIGKILL')
    if (c.exitCode === null) await new Promise((r) => c.once('exit', r))
  }
  for (const d of roots.splice(0)) {
    chmodTree(d)
    rmSync(d, { recursive: true, force: true })
  }
})
function chmodTree(d: string) {
  try {
    for (const e of readdirSync(d, { recursive: true }) as string[])
      try {
        chmodSync(join(d, e), 0o700)
      } catch {}
  } catch {}
}

/** <root>/share/{gnomeola,kacola}: the old and the new default data dirs. */
function layout() {
  const root = mkdtempSync(join(tmpdir(), 'kacola-legacy-'))
  roots.push(root)
  const from = join(root, 'share', 'gnomeola')
  const to = join(root, 'share', 'kacola')
  return { root, from, to }
}

/**
 * An old data dir as a crash leaves it: gnomeola.db whose last rows are still only in its WAL, a
 * recording and a model. Returns the rows to expect.
 */
function oldDataDir(from: string): string[] {
  mkdirSync(join(from, 'recordings', 's1'), { recursive: true })
  writeFileSync(join(from, 'recordings', 's1', 'mic.wav'), Buffer.alloc(64 * 1024, 7))
  mkdirSync(join(from, 'models'), { recursive: true })
  writeFileSync(join(from, 'models', 'm.bin'), Buffer.alloc(32 * 1024, 3))
  writeFileSync(join(from, 'auth-secret'), 'secret\n')
  // write through a live connection with checkpoints off, snapshot db + -wal + -shm (a crash), then close
  const live = join(from, '..', 'live')
  mkdirSync(live, { recursive: true })
  const db = new DatabaseSync(join(live, LEGACY_DB_FILE))
  db.exec('pragma journal_mode = WAL')
  db.exec('pragma wal_autocheckpoint = 0')
  db.exec('create table sessions (title text)')
  const titles = ['standup', '1:1 with Ana', 'retro']
  for (const t of titles) db.prepare('insert into sessions values (?)').run(t)
  for (const f of [LEGACY_DB_FILE, `${LEGACY_DB_FILE}-wal`, `${LEGACY_DB_FILE}-shm`])
    copyFileSync(join(live, f), join(from, f))
  db.close()
  rmSync(live, { recursive: true, force: true })
  expect(readFileSync(join(from, `${LEGACY_DB_FILE}-wal`)).length).toBeGreaterThan(0)
  return titles
}

const titlesIn = (dir: string) => {
  const db = new DatabaseSync(join(dir, DB_FILE), { readOnly: true })
  try {
    return (db.prepare('select title from sessions').all() as { title: string }[]).map((r) => r.title)
  } finally {
    db.close()
  }
}

function expectMigratedData(to: string, titles: string[]) {
  expect(titlesIn(to)).toEqual(titles)
  expect(existsSync(join(to, LEGACY_DB_FILE))).toBe(false)
  expect(
    existsSync(join(to, `${DB_FILE}-wal`)) && readFileSync(join(to, `${DB_FILE}-wal`)).length,
  ).toBeFalsy()
  expect(readFileSync(join(to, 'recordings', 's1', 'mic.wav'))).toEqual(Buffer.alloc(64 * 1024, 7))
  expect(readFileSync(join(to, 'models', 'm.bin'))).toEqual(Buffer.alloc(32 * 1024, 3))
  expect(readFileSync(join(to, 'auth-secret'), 'utf8')).toBe('secret\n')
  expect(existsSync(join(to, MIGRATION_JOURNAL))).toBe(false)
}

const lockToken = (dir: string) =>
  (JSON.parse(readFileSync(join(dir, LOCK_FILE), 'utf8')) as { token: string }).token

describe('the gnomeola → kacola data dir migration', () => {
  it('a fresh install: nothing to move, the new dir is locked and the old one never created', () => {
    const { from, to } = layout()
    const r = migrateLegacyDataDir({ from, to })
    try {
      expect(r.migrated).toBe(false)
      expect(lockToken(to)).toBe(r.lock.owner.token)
      expect(existsSync(from)).toBe(false)
    } finally {
      r.lock.release()
    }
  })

  it('moves the whole dir in one rename, folds the WAL into kacola.db and leaves a symlink', () => {
    const { from, to } = layout()
    const titles = oldDataDir(from)
    const notes: string[] = []
    const r = migrateLegacyDataDir({ from, to, log: (m) => notes.push(m) })
    try {
      expect(r.migrated).toBe(true)
      expectMigratedData(to, titles)
      expect(lstatSync(from).isSymbolicLink()).toBe(true)
      expect(readlinkSync(from)).toBe(resolve(to))
      // the lock travelled with the dir and is held, under our token, as the new dir's lock
      expect(r.lock.held).toBe(true)
      expect(lockToken(to)).toBe(r.lock.owner.token)
      expect(notes.join('\n')).toMatch(/one rename/)
    } finally {
      r.lock.release()
    }
    expect(existsSync(join(to, LOCK_FILE))).toBe(false)
    // a second start finds nothing left to do
    const again = migrateLegacyDataDir({ from, to })
    expect(again.migrated).toBe(false)
    again.lock.release()
    expectMigratedData(to, titles)
  })

  it('beside an installed app (install.sh puts app/ and desktop/ in the data dir): moves data only', () => {
    const { from, to } = layout()
    const titles = oldDataDir(from)
    mkdirSync(join(from, 'app'))
    writeFileSync(join(from, 'app', 'old.txt'), 'old app')
    // the new install is already in place in the new dir
    mkdirSync(join(to, 'app'), { recursive: true })
    writeFileSync(join(to, 'app', 'new.txt'), 'new app')
    mkdirSync(join(to, 'desktop'))
    const r = migrateLegacyDataDir({ from, to })
    try {
      expect(r.migrated).toBe(true)
      expectMigratedData(to, titles)
      expect(readFileSync(join(to, 'app', 'new.txt'), 'utf8')).toBe('new app')
      expect(readFileSync(join(from, 'app', 'old.txt'), 'utf8')).toBe('old app')
      expect(readdirSync(from).sort()).toEqual([MOVED_NOTE, 'app'])
      expect(readFileSync(join(from, MOVED_NOTE), 'utf8')).toContain(resolve(to))
      expect(lockToken(to)).toBe(r.lock.owner.token)
    } finally {
      r.lock.release()
    }
  })

  it('across filesystems: copies, verifies, and an interrupted copy resumes where it stopped', () => {
    const { from, to } = layout()
    const titles = oldDataDir(from)
    // interrupt the first run: one entry cannot be read
    chmodSync(join(from, 'models', 'm.bin'), 0o000)
    expect(() => migrateLegacyDataDir({ from, to, forceCopy: true })).toThrow()
    // what has been copied so far is in the new dir; nothing was lost from the old one
    expect(existsSync(join(to, MIGRATION_JOURNAL))).toBe(true)
    expect(existsSync(join(from, 'models', 'm.bin'))).toBe(true)
    expect(existsSync(join(to, 'models'))).toBe(false)
    expect(readdirSync(to).some((e) => e.endsWith('.kacola-partial'))).toBe(false)
    // and neither dir is locked by the failed attempt
    expect(existsSync(join(from, LOCK_FILE)) || existsSync(join(to, LOCK_FILE))).toBe(false)

    chmodSync(join(from, 'models', 'm.bin'), 0o600)
    const r = migrateLegacyDataDir({ from, to, forceCopy: true })
    try {
      expect(r.migrated).toBe(true)
      expectMigratedData(to, titles)
      expect(lstatSync(from).isSymbolicLink()).toBe(true)
    } finally {
      r.lock.release()
    }
  })

  it('a copy whose source removal was cut short is finished from the journal', () => {
    const { from, to } = layout()
    const titles = oldDataDir(from)
    // the state a crash leaves right after `recordings` was verified in place, mid-way removing its source
    mkdirSync(to, { recursive: true })
    cpSync(join(from, 'recordings'), join(to, 'recordings'), { recursive: true })
    rmSync(join(from, 'recordings', 's1', 'mic.wav'))
    writeFileSync(
      join(to, MIGRATION_JOURNAL),
      JSON.stringify({ from, startedAt: '', method: 'copy', verified: ['recordings'] }),
    )
    writeFileSync(join(to, 'models.kacola-partial'), 'half a copy')
    const r = migrateLegacyDataDir({ from, to, forceCopy: true })
    try {
      expectMigratedData(to, titles)
      expect(existsSync(join(to, 'models.kacola-partial'))).toBe(false)
    } finally {
      r.lock.release()
    }
  })

  it('refuses when both dirs hold data, and moves nothing', () => {
    const { from, to } = layout()
    oldDataDir(from)
    mkdirSync(to, { recursive: true })
    writeFileSync(join(to, DB_FILE), 'a kacola database')
    const before = readdirSync(from).sort()
    let err: unknown
    try {
      migrateLegacyDataDir({ from, to })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(LegacyMigrationRefused)
    expect((err as LegacyMigrationRefused).reason).toBe('both-exist')
    expect((err as Error).message).toContain(`both ${from}`)
    expect((err as Error).message).toContain('move the other aside')
    expect(readdirSync(from).sort()).toEqual(before)
    expect(readFileSync(join(to, DB_FILE), 'utf8')).toBe('a kacola database')
    expect(existsSync(join(from, LOCK_FILE)) || existsSync(join(to, LOCK_FILE))).toBe(false)
  })

  const sleeper = async (code: string) => {
    const c = spawn(process.execPath, ['-e', `${code}; console.log('ready'); setInterval(() => {}, 1000)`])
    children.push(c)
    await new Promise<void>((r) => c.stdout!.once('data', () => r()))
    return c
  }

  it('refuses while a gnomeola daemon holds the old dir (its lock), and moves nothing', async () => {
    const { from, to } = layout()
    oldDataDir(from)
    const old = await sleeper('')
    writeFileSync(
      join(from, LOCK_FILE),
      JSON.stringify({
        pid: old.pid,
        startedAt: '',
        port: 8787,
        host: '127.0.0.1',
        procStart: null,
        token: 't',
        cmd: 'gnomeolad',
      }),
    )
    expect(() => migrateLegacyDataDir({ from, to })).toThrow(DataDirLockedError)
    expect(existsSync(to)).toBe(false)
    expect(existsSync(join(from, LEGACY_DB_FILE))).toBe(true)
  })

  it('refuses while a gnomeola daemon from before the lock has gnomeola.db open for writing', async () => {
    const { from, to } = layout()
    oldDataDir(from)
    const old = await sleeper(`require('fs').openSync(${JSON.stringify(join(from, LEGACY_DB_FILE))}, 'r+')`)
    let err: unknown
    try {
      migrateLegacyDataDir({ from, to })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(DataDirLockedError)
    expect((err as DataDirLockedError).owner.pid).toBe(old.pid)
    expect(existsSync(to)).toBe(false)
    expect(existsSync(join(from, LEGACY_DB_FILE))).toBe(true)
    expect(existsSync(join(from, LOCK_FILE))).toBe(false)
  })

  it('refuses while a kacola daemon already owns the new dir', async () => {
    const { from, to } = layout()
    oldDataDir(from)
    mkdirSync(to, { recursive: true })
    const other = await sleeper('')
    writeFileSync(
      join(to, LOCK_FILE),
      JSON.stringify({
        pid: other.pid,
        startedAt: '',
        port: 8787,
        host: '127.0.0.1',
        procStart: null,
        token: 'k',
        cmd: 'kacolad',
      }),
    )
    expect(() => migrateLegacyDataDir({ from, to })).toThrow(DataDirLockedError)
    expect(existsSync(join(from, LEGACY_DB_FILE))).toBe(true)
    expect(existsSync(join(from, LOCK_FILE))).toBe(false)
  })

  it('applies only to the default data dir', () => {
    const env = { XDG_DATA_HOME: '/x' }
    expect(legacyDataDirFor('/x/kacola', { env, platform: 'linux', home: '/h' })).toBe('/x/gnomeola')
    expect(legacyDataDirFor('/elsewhere', { env, platform: 'linux', home: '/h' })).toBeNull()
    expect(
      legacyDataDirFor('/x/kacola', {
        env: { ...env, KACOLA_DATA_DIR: '/x/kacola' },
        platform: 'linux',
        home: '/h',
      }),
    ).toBeNull()
    expect(
      legacyDataDirFor('/h/Library/Application Support/kacola', { env: {}, platform: 'darwin', home: '/h' }),
    ).toBe('/h/Library/Application Support/gnomeola')
  })
})
