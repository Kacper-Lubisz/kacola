import { seededRandom } from '@gnomeola/testkit/daemon'
import { afterEach, describe, expect, it } from 'vitest'
import type { StoreApi } from '../../src/api.ts'
import { SqliteStoreApi } from '../../src/index.ts'
import { randomHistory, tickingClock, WORDS } from './history.ts'
import { pgliteStore } from './pglite.ts'

// V-8 dialect parity, the strong form: the SAME operations, driven independently on SQLite and on
// Postgres (not one replaying the other's log), must produce the SAME event log, byte for byte, and the
// same state. And each dialect must be able to rebuild itself from the other's log.

const open: StoreApi[] = []
afterEach(async () => {
  await Promise.all(open.splice(0).map((s) => s.close()))
})
const sqlite = (now = tickingClock()) => {
  // Opening a SQLite store stamps its migrations with the clock; the PGlite template is migrated
  // already. Keep the shared clock out of that, so both dialects see the same ticks for commits.
  let clock: () => Date = () => new Date(0)
  const s = SqliteStoreApi.open(':memory:', { now: () => clock() })
  clock = now
  open.push(s)
  return s
}
const postgres = async (now = tickingClock()) => {
  const s = await pgliteStore({ now })
  open.push(s)
  return s
}

describe('SQLite and Postgres agree', () => {
  for (const seed of [3, 1234]) {
    it(`the same random history yields identical logs and state (seed ${seed})`, async () => {
      const a = sqlite()
      const b = await postgres()
      await randomHistory(a, seededRandom(seed), 300)
      await randomHistory(b, seededRandom(seed), 300)
      expect(await b.eventsAfter(0)).toEqual(await a.eventsAfter(0))
      expect(await b.snapshot()).toEqual(await a.snapshot())

      // search: same matching set and totals for every word and some phrases/prefixes (ranking is
      // allowed to differ — bm25 vs ts_rank — but never which segments match)
      const queries = [...WORDS, 'retry budget', '"retry budget"', 'dash*', 'ca*', 'naive cafe', 'call']
      for (const q of queries) {
        for (const includePrivate of [false, true]) {
          const ra = await a.search({ q, includePrivate, limit: 100 })
          const rb = await b.search({ q, includePrivate, limit: 100 })
          expect(rb.total, q).toBe(ra.total)
          expect(rb.hits.map((h) => h.segmentId).sort(), q).toEqual(ra.hits.map((h) => h.segmentId).sort())
        }
      }
    })
  }

  it('each dialect rebuilds itself from the other dialect’s log', async () => {
    const a = sqlite()
    await randomHistory(a, seededRandom(77), 200)
    const b = await postgres()
    await b.replay(await a.eventsAfter(0), 50)
    expect(await b.snapshot()).toEqual(await a.snapshot())
    const c = sqlite()
    await c.replay(await b.eventsAfter(0), 50)
    expect(await c.snapshot()).toEqual(await a.snapshot())
  })
})
