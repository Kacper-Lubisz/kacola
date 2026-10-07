import { newId } from '@kacola/protocol'
import { assertNoViolations, checkEventLog } from '@kacola/testkit/invariants'
import { type PostgresContainer, podmanPostgresAvailable, startPostgres } from '@kacola/testkit/postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openPostgres, type PgStore } from '../../src/pg/index.ts'
import { storeContract } from './suite.ts'

// V-8: the dialect contract against a REAL Postgres 17 server (podman), the same engine family Neon
// runs. Skips, with its reason, where podman or the image is unavailable. Also the one place with real
// cross-connection concurrency: many pooled connections committing at once must keep seq gap-free.

const unavailable = await podmanPostgresAvailable()
if (unavailable) console.warn(`[skip] real-Postgres contract: ${unavailable}`)

describe.skipIf(unavailable !== null)('real Postgres (podman)', () => {
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

  let n = 0
  /** A fresh database per store: CREATE DATABASE is ~10 ms on a local server. */
  async function fresh(opts: { now?: () => Date; max?: number } = {}): Promise<PgStore> {
    const name = `t${process.pid}_${++n}`
    await admin.query(`CREATE DATABASE ${name}`)
    return openPostgres(server.urlFor(name), opts)
  }

  storeContract('postgres/server', (o) => fresh(o))

  it('many connections committing at once: seq stays gap-free, commit order == seq order', async () => {
    const WRITERS = 8
    const COUNT = 60
    const stores = await (async () => {
      const first = await fresh({ max: 2 })
      const name = `t${process.pid}_${n}`
      const rest = await Promise.all(
        Array.from({ length: WRITERS - 1 }, () =>
          openPostgres(server.urlFor(name), { max: 2, migrate: false }),
        ),
      )
      return [first, ...rest]
    })()
    let reading = true
    let reader: Promise<void> = Promise.resolve()
    try {
      const session = await stores[0]!.createSession({ title: 'concurrency' })
      // a reader tails the log while writers race: it must never see seq n+1 before seq n
      let cursor = 0
      let readerViolations = 0
      reader = (async () => {
        while (reading) {
          const page = await stores[0]!.eventsAfter(cursor)
          for (const e of page) {
            if (e.seq !== cursor + 1) readerViolations++
            cursor = e.seq
          }
        }
      })()
      const seqs = await Promise.all(
        stores.map(async (s, w) => {
          const mine: number[] = []
          for (let i = 0; i < COUNT; i++) {
            await s.upsertSegment({
              id: newId('seg'),
              sessionId: session.id,
              track: 'mic',
              speaker: 'me',
              startMs: i,
              endMs: i + 1,
              text: `writer ${w} line ${i}`,
              quality: 'live',
              confidence: null,
            })
            mine.push(await s.lastSeq())
          }
          return mine
        }),
      )
      reading = false
      await reader
      const events = await stores[0]!.eventsAfter(0)
      assertNoViolations(checkEventLog(events))
      expect(events).toHaveLength(1 + WRITERS * COUNT)
      expect(readerViolations).toBe(0)
      expect(await stores[0]!.segments(session.id)).toHaveLength(WRITERS * COUNT)
      expect(seqs.flat().length).toBe(WRITERS * COUNT)
    } finally {
      reading = false
      await reader.catch(() => {})
      await Promise.all(stores.map((s) => s.close()))
    }
  })
})
