// first: GNOMEOLA_* deployment variables from before the rename are read as KACOLA_* (one release)
import '@kacola/protocol/legacy-env'
import {
  authConfigFromEnv,
  createHostedApp,
  type HostedApp,
  mailerFromEnv,
  type NodeHandler,
  nodeHandler,
} from '@kacola/server'
import { blobStoreFromEnv } from '@kacola/store/blob'
import type { StoreApi } from '@kacola/store/core'
import { openPostgres } from '@kacola/store/pg'
import { cloudSttFromEnv } from '@kacola/stt/cloud'

// H-5 — the hosted server as Vercel Node functions. One app per warm instance (built lazily on the first
// request and reused), three functions that differ only in their duration budget:
//
//   api       every JSON route                      maxDuration 30 s
//   events    GET /events (SSE)                      maxDuration 300 s — each stream ends itself
//                                                    MARGIN before the cap; clients resume by cursor
//   finalize  POST /sessions/:id/audio/finalize     maxDuration 300 s (cloud transcription)
//
// Configuration is the environment (Vercel project settings):
//   DATABASE_URL (or POSTGRES_URL, as the Neon integration names it)   required
//   KACOLA_AUTH_SECRET (>= 32 chars), KACOLA_ADMIN_TOKEN            required: remote ALWAYS needs a token
//   BLOB_READ_WRITE_TOKEN                                              Vercel Blob (audio, full offload)
//   DEEPGRAM_API_KEY                                                   cloud STT (full offload), optional
//   KACOLA_MAIL_WEBHOOK (+ _SECRET), KACOLA_PUBLIC_URL             team sharing: magic-link email, link base
//
// There is no anonymous mode here: without an auth secret every request is refused (503), and loopback
// is never trusted (a function has no loopback callers).

export type FunctionName = 'api' | 'events' | 'finalize'

/** Seconds; the build writes the same numbers into each function's .vc-config.json. */
export const MAX_DURATION: Record<FunctionName, number> = { api: 30, events: 300, finalize: 300 }
/** How long before the platform's cap an SSE stream ends itself. */
export const STREAM_MARGIN_MS = 15_000

type Env = Record<string, string | undefined>

async function openStore(url: string): Promise<StoreApi> {
  // `sqlite:` exists for the local harness (tests, a laptop without Postgres); a deployment uses Neon.
  if (url.startsWith('sqlite:')) {
    const { SqliteStoreApi } = await import('@kacola/store')
    return SqliteStoreApi.open(url.slice('sqlite:'.length))
  }
  // Serverless: few connections per instance; Neon pools on its side.
  return openPostgres(url, { max: 3 })
}

export async function appFromEnv(
  env: Env,
  fn: FunctionName,
  maxDurationS = MAX_DURATION[fn],
): Promise<HostedApp> {
  const url = env.DATABASE_URL || env.POSTGRES_URL
  const auth = authConfigFromEnv(env)
  if (!url) throw new Error('DATABASE_URL (or POSTGRES_URL) is not set')
  if (!auth) throw new Error('KACOLA_AUTH_SECRET is not set: a hosted kacola never runs without auth')
  const store = await openStore(url)
  return createHostedApp({
    store,
    blobs: blobStoreFromEnv(env, '/tmp/kacola-blobs'),
    auth,
    trustLoopback: false,
    stt: cloudSttFromEnv(env),
    maxStreamMs: Math.max(
      1000,
      maxDurationS * 1000 - Number(env.KACOLA_STREAM_MARGIN_MS ?? STREAM_MARGIN_MS),
    ),
    pollMs: Number(env.KACOLA_POLL_MS ?? 1000),
    heartbeatMs: 15_000,
    log: (level, msg, fields) => console[level](JSON.stringify({ msg, ...fields })),
    // team sharing: magic-link codes (KACOLA_MAIL_WEBHOOK); without one, shared pages are read-only
    mailer: mailerFromEnv(env),
    publicUrl: env.KACOLA_PUBLIC_URL || null,
  })
}

/**
 * The Vercel Node function: `(req, res)`. The app is created on the first request of an instance (so a
 * misconfiguration answers 503 with the reason instead of crashing the cold start) and reused while warm.
 */
export function vercelHandler(
  fn: FunctionName,
  maxDurationS = MAX_DURATION[fn],
  env: Env = process.env,
): NodeHandler {
  let handler: Promise<NodeHandler> | null = null
  return async (req, res) => {
    handler ??= appFromEnv(env, fn, maxDurationS).then((app) => nodeHandler(app, { trustProxy: true }))
    let h: NodeHandler
    try {
      h = await handler
    } catch (err) {
      handler = null // retry the setup on the next request
      res.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end(
        JSON.stringify({
          error: { code: 'unavailable', message: `server not configured: ${(err as Error).message}` },
        }),
      )
      return
    }
    await h(req, res)
  }
}
