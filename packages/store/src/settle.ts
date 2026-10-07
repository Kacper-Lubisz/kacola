import { existsSync, rmSync, statSync } from 'node:fs'
import Database from 'better-sqlite3'

/**
 * Fold a WAL-mode database's write-ahead log into the main file and close it, so the database is one
 * self-contained file that can be renamed or copied on its own (the gnomeola → kacola data migration
 * renames gnomeola.db to kacola.db). The caller must own the database: nothing else may have it open.
 * Throws, leaving every file as it was, when the log could not be folded in completely.
 */
export function settleSqliteFile(path: string): void {
  const db = new Database(path, { fileMustExist: true })
  try {
    const [r] = db.pragma('wal_checkpoint(TRUNCATE)') as { busy: number; log: number; checkpointed: number }[]
    if (r && r.busy !== 0) throw new Error(`${path} is busy: another connection holds it open`)
  } finally {
    db.close()
  }
  // the last connection to close removes -wal and -shm; an empty leftover is harmless, a non-empty one is not
  const wal = `${path}-wal`
  if (existsSync(wal) && statSync(wal).size > 0)
    throw new Error(`${path} still has an unmerged write-ahead log (${wal})`)
  rmSync(wal, { force: true })
  rmSync(`${path}-shm`, { force: true })
}
