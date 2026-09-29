import { PGlite } from '@electric-sql/pglite'
import { createClient, type GnomeolaClient } from '@gnomeola/protocol'
import { SqliteStoreApi } from '@gnomeola/store'
import { MemoryBlobStore } from '@gnomeola/store/blob'
import type { StoreApi } from '@gnomeola/store/core'
import { migratePg, openPglite, openPostgres, pgliteDialect } from '@gnomeola/store/pg'
import { Kysely } from 'kysely'
import { createHostedApp, type HostedApp, type HostedAppOptions } from '../src/app.ts'
import { type Served, serve } from '../src/node.ts'

export type Dialect = 'sqlite' | 'pglite' | { postgresUrl: string }

let template: Promise<Blob> | null = null
async function pglite(): Promise<PGlite> {
  template ??= (async () => {
    const pg = new PGlite()
    const db = new Kysely({ dialect: pgliteDialect(pg) })
    await migratePg(db)
    const dump = await pg.dumpDataDir('none')
    await db.destroy()
    return dump
  })()
  const pg = new PGlite({ loadDataDir: await template })
  await pg.waitReady
  return pg
}

export async function openStore(d: Dialect, now?: () => Date): Promise<StoreApi> {
  if (d === 'sqlite') return SqliteStoreApi.open(':memory:', now ? { now } : {})
  if (d === 'pglite') return openPglite(await pglite(), now ? { now } : {})
  return openPostgres(d.postgresUrl, now ? { now } : {})
}

export type Hosted = {
  app: HostedApp
  served: Served
  url: string
  store: StoreApi
  blobs: MemoryBlobStore
  client: GnomeolaClient
  close(): Promise<void>
}

/** A hosted server on a random loopback port, over the chosen dialect and in-memory blobs. */
export async function startHosted(
  opts: Partial<HostedAppOptions> & { dialect?: Dialect; token?: string } = {},
): Promise<Hosted> {
  const store = opts.store ?? (await openStore(opts.dialect ?? 'sqlite'))
  const blobs = (opts.blobs as MemoryBlobStore | undefined) ?? new MemoryBlobStore()
  const app = createHostedApp({ auth: null, ...opts, store, blobs })
  const served = await serve(app)
  return {
    app,
    served,
    url: served.url,
    store,
    blobs,
    client: createClient({
      baseUrl: served.url,
      timeoutMs: 10_000,
      ...(opts.token ? { token: opts.token } : {}),
    }),
    async close() {
      await served.close()
      await store.close()
    },
  }
}

/**
 * A fetch that kills each streaming response after a random number of bytes (so, often mid-message),
 * as a dropped network connection would.
 */
export function cuttingFetch(rnd: () => number, minBytes: number, maxBytes: number, pUncut = 0) {
  const stats = { cuts: 0, connections: 0 }
  const f: typeof fetch = async (input, init) => {
    const res = await fetch(input, init)
    const accept = new Headers(init?.headers).get('accept')
    if (!res.body || accept !== 'text/event-stream') return res
    stats.connections++
    // some connections are left alone, so they live long enough to meet the server's duration cap
    const budget =
      rnd() < pUncut ? Number.POSITIVE_INFINITY : minBytes + Math.floor(rnd() * (maxBytes - minBytes))
    let seen = 0
    const reader = res.body.getReader()
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read()
        if (done) return controller.close()
        if (seen + value.length >= budget) {
          const keep = budget - seen
          if (keep > 0) controller.enqueue(value.slice(0, keep))
          stats.cuts++
          await reader.cancel()
          controller.error(new Error('connection cut by test'))
          return
        }
        seen += value.length
        controller.enqueue(value)
      },
      cancel: () => reader.cancel(),
    })
    return new Response(body, { status: res.status, headers: res.headers })
  }
  return { fetch: f, stats }
}

export async function waitFor(
  cond: () => boolean | Promise<boolean>,
  ms: number,
  what: string,
): Promise<void> {
  const end = Date.now() + ms
  while (!(await cond())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await sleep(10)
  }
}

export const SECRET = 'test-secret-0123456789abcdef0123456789'
export const ADMIN = 'admin-token-0123456789'
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
