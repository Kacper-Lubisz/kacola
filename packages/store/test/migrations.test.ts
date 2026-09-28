import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { type Migration, migrate, migrations, SchemaError, Store, schemaVersion } from '../src/index.ts'

const dirs: string[] = []
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'gnomeola-mig-'))
  dirs.push(d)
  return join(d, 'db.sqlite')
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('migrations', () => {
  it('are numbered 1..n with unique names', () => {
    expect(migrations.map((m) => m.version)).toEqual(migrations.map((_, i) => i + 1))
    expect(new Set(migrations.map((m) => m.name)).size).toBe(migrations.length)
  })

  it('bring a fresh database to the latest version, and are a no-op on reopen', () => {
    const db = new Database(':memory:')
    expect(migrate(db)).toEqual({ from: 0, to: migrations.length, applied: migrations.map((m) => m.version) })
    expect(schemaVersion(db)).toBe(migrations.length)
    expect(migrate(db)).toEqual({ from: migrations.length, to: migrations.length, applied: [] })
  })

  it('upgrade an existing database forward and keep its data', () => {
    const path = tmp()
    const s = Store.open(path)
    const a = s.createSession({ title: 'kept' })
    s.close()
    const v2: Migration = {
      version: migrations.length + 1,
      name: 'add-session-notes',
      up: 'ALTER TABLE sessions ADD COLUMN notes TEXT',
    }
    const s2 = Store.open(path, { migrations: [...migrations, v2] })
    expect(schemaVersion(s2.db)).toBe(v2.version)
    expect(s2.getSession(a.id)?.title).toBe('kept')
    expect(s2.db.prepare('SELECT notes FROM sessions').get()).toEqual({ notes: null })
    s2.close()
  })

  it('refuse a database written by a newer build', () => {
    const path = tmp()
    const v2: Migration = { version: migrations.length + 1, name: 'future', up: 'CREATE TABLE future (x)' }
    Store.open(path, { migrations: [...migrations, v2] }).close()
    expect(() => Store.open(path)).toThrow(SchemaError)
    expect(() => Store.open(path)).toThrow(/newer than this build/)
  })

  it('refuse a database whose history disagrees with the code', () => {
    const db = new Database(':memory:')
    migrate(db)
    db.prepare("UPDATE schema_migrations SET name = 'renamed' WHERE version = 1").run()
    expect(() => migrate(db)).toThrow(/is 'renamed' on disk/)
  })

  it('roll back a failing migration completely — no half-applied schema', () => {
    const db = new Database(':memory:')
    migrate(db)
    const bad: Migration = {
      version: migrations.length + 1,
      name: 'broken',
      up: 'CREATE TABLE half (x); THIS IS NOT SQL;',
    }
    expect(() => migrate(db, [...migrations, bad])).toThrow()
    expect(schemaVersion(db)).toBe(migrations.length)
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'half'").get()).toBeUndefined()
  })

  it('reject a malformed migration list', () => {
    const db = new Database(':memory:')
    expect(() => migrate(db, [{ version: 2, name: 'x', up: '' }])).toThrow(SchemaError)
  })
})
