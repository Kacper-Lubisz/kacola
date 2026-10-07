#!/usr/bin/env node
// kacola-server: the hosted server on plain Node — a self-hosted box, or the "remote" that hybrid-sync
// tests push to. Vercel runs the same app through packages/vercel instead.
//
//   kacola-server [--host 127.0.0.1] [--port 8788] [--db sqlite:PATH | postgres://…] [--blobs DIR]
//
// Prints one JSON line when listening: {"event":"listening","url":…,"port":…,"pid":…}.
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { FsBlobStore } from '@kacola/store/blob'
import type { StoreApi } from '@kacola/store/core'
import { cloudSttFromEnv } from '@kacola/stt/cloud'
import { createHostedApp } from '../app.ts'
import { authConfigFromEnv, isLoopbackRequest } from '../auth.ts'
import { serve } from '../node.ts'

const USAGE = `usage: kacola-server [--host H] [--port N] [--db sqlite:PATH|postgres://URL] [--blobs DIR]

environment:
  KACOLA_AUTH_SECRET   HMAC key for device tokens (>= 32 chars); required to listen beyond loopback
  KACOLA_ADMIN_TOKEN   owner token: approves pairings (>= 16 chars)
  DATABASE_URL           used when --db is not given
  DEEPGRAM_API_KEY       enables full-offload transcription (DEEPGRAM_URL overrides the endpoint)
  KACOLA_MAX_STREAM_MS end each /events stream after this long (default 240000)
`

async function openStore(spec: string): Promise<StoreApi> {
  if (spec.startsWith('postgres://') || spec.startsWith('postgresql://')) {
    const { openPostgres } = await import('@kacola/store/pg')
    return openPostgres(spec)
  }
  const path = spec.replace(/^sqlite:/, '')
  const { SqliteStoreApi } = await import('@kacola/store')
  return SqliteStoreApi.open(path)
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      host: { type: 'string' },
      port: { type: 'string' },
      db: { type: 'string' },
      blobs: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    process.stdout.write(USAGE)
    return
  }
  const env = process.env
  const host = values.host ?? '127.0.0.1'
  const auth = authConfigFromEnv(env)
  if (!auth && !isLoopbackRequest({ remoteAddress: '127.0.0.1', host }))
    throw new Error(
      `refusing to listen on ${host} without KACOLA_AUTH_SECRET: remote requests need pairing auth`,
    )
  const base = join(env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'kacola-server')
  mkdirSync(base, { recursive: true, mode: 0o700 })
  const store = await openStore(values.db ?? env.DATABASE_URL ?? `sqlite:${join(base, 'server.db')}`)
  const app = createHostedApp({
    store,
    blobs: new FsBlobStore(values.blobs ?? join(base, 'blobs')),
    auth,
    stt: cloudSttFromEnv(env),
    maxStreamMs: env.KACOLA_MAX_STREAM_MS ? Number(env.KACOLA_MAX_STREAM_MS) : undefined,
    pollMs: env.KACOLA_POLL_MS ? Number(env.KACOLA_POLL_MS) : undefined,
    log: (level, msg, fields) => process.stderr.write(`${JSON.stringify({ level, msg, ...fields })}\n`),
  })
  const served = await serve(app, { host, port: values.port ? Number(values.port) : 8788 })
  process.stdout.write(
    `${JSON.stringify({ event: 'listening', url: served.url, port: served.port, pid: process.pid })}\n`,
  )
  const stop = () => {
    served
      .close()
      .then(() => store.close())
      .finally(() => process.exit(0))
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}

main().catch((err: unknown) => {
  process.stderr.write(`kacola-server failed to start: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
