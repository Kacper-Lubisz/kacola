import { type PostgresContainer, podmanPostgresAvailable, startPostgres } from '@gnomeola/testkit/postgres'
import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { StoreApi } from '../../src/api.ts'
import { SqliteStoreApi } from '../../src/index.ts'
import { openPostgres } from '../../src/pg/index.ts'
import { randomShareHistory } from '../share-history.ts'
import { pgliteStore } from './pglite.ts'

// Team sharing across dialects. The same multi-device history, driven through the planners on SQLite,
// PGlite and (when podman has it) a real Postgres 17 with one fixed clock, must give byte-identical logs
// and equal snapshots — the planners run inside each dialect's writer transaction, the statements in
// src/shares-apply.ts apply the events. And a SQLite log replays into Postgres (and back) to the same state.

// one instant: how often each dialect reads its clock (migrations, commits) must not matter
const fixed = () => () => new Date('2026-10-01T09:00:00.000Z')

const open: StoreApi[] = []
afterEach(async () => {
  await Promise.all(open.splice(0).map((s) => s.close()))
})

describe('team sharing: SQLite and Postgres agree', () => {
  for (const seed of [21, 22]) {
    it(`seed ${seed}: the same history gives the same log and state; replays both ways`, async () => {
      const a = SqliteStoreApi.open(':memory:', { now: fixed() })
      const b = await pgliteStore({ now: fixed() })
      open.push(a, b)
      await randomShareHistory(a, seed, 160, { revokeAtEnd: seed === 22 })
      await randomShareHistory(b, seed, 160, { revokeAtEnd: seed === 22 })
      const logA = await a.eventsAfter(0)
      expect(logA.some((e) => e.data.type === 'share.change')).toBe(true)
      expect(await b.eventsAfter(0)).toEqual(logA)
      const snap = await a.snapshot()
      expect(await b.snapshot()).toEqual(snap)

      const intoPg = await pgliteStore()
      open.push(intoPg)
      await intoPg.replay(logA, 25)
      expect(await intoPg.snapshot()).toEqual(snap)
      const back = SqliteStoreApi.open(':memory:')
      open.push(back)
      await back.replay(await intoPg.eventsAfter(0), 25)
      expect(await back.snapshot()).toEqual(snap)
    })
  }
})

const unavailable = await podmanPostgresAvailable()
if (unavailable) console.warn(`[skip] team sharing on real Postgres: ${unavailable}`)

describe.skipIf(unavailable !== null)('team sharing on a real Postgres (podman)', () => {
  let server: PostgresContainer
  let admin: pg.Client
  beforeAll(async () => {
    server = await startPostgres()
    admin = new pg.Client({ connectionString: server.url })
    await admin.connect()
  }, 120_000)
  afterAll(async () => {
    await admin?.end()
    await server?.stop()
  })

  it('the same history as on SQLite: same log, same state', async () => {
    await admin.query(`CREATE DATABASE shares_${process.pid}`)
    const p = await openPostgres(server.urlFor(`shares_${process.pid}`), { now: fixed() })
    const a = SqliteStoreApi.open(':memory:', { now: fixed() })
    open.push(p, a)
    await randomShareHistory(a, 31, 160)
    await randomShareHistory(p, 31, 160)
    expect(await p.eventsAfter(0)).toEqual(await a.eventsAfter(0))
    expect(await p.snapshot()).toEqual(await a.snapshot())
  })
})
