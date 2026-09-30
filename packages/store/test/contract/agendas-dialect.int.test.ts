import { afterEach, describe, expect, it } from 'vitest'
import type { StoreApi } from '../../src/api.ts'
import { SqliteStoreApi, Store } from '../../src/index.ts'
import { randomHistory } from '../agenda-history.ts'
import { pgliteStore } from './pglite.ts'

// Agendas across dialects: an agenda history made on the local (SQLite) store — every agenda event,
// session deletions scrubbing evidence included — replays into Postgres to the same snapshot, and back.
// The two dialects apply agenda events with the very same statements (src/agendas-apply.ts); this is
// what proves those statements mean the same thing on both.

const open: StoreApi[] = []
afterEach(async () => {
  await Promise.all(open.splice(0).map((s) => s.close()))
})

describe('agendas: SQLite and Postgres agree', () => {
  for (const seed of [11, 12]) {
    it(`a random agenda history replays into Postgres and back to the same state (seed ${seed})`, async () => {
      const { s } = randomHistory(seed, 250)
      const a = new SqliteStoreApi(s)
      open.push(a)
      const log = await a.eventsAfter(0)
      const pg = await pgliteStore()
      open.push(pg)
      await pg.replay(log, 40)
      const snapA = await a.snapshot()
      const snapB = await pg.snapshot()
      expect(snapA.agendas.length).toBeGreaterThan(0)
      expect(snapA.agendaHistory.length).toBeGreaterThan(0)
      expect(snapB).toEqual(snapA)
      expect(await pg.eventsAfter(0)).toEqual(log)

      const back = new SqliteStoreApi(Store.open(':memory:'))
      open.push(back)
      await back.replay(await pg.eventsAfter(0), 40)
      expect(await back.snapshot()).toEqual(snapA)
    })
  }
})
