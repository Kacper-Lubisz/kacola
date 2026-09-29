import { once } from 'node:events'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { HostedApp } from './app.ts'

// Node's (req, res) ⇄ the app's (Request) => Response. This one adapter serves three hosts: a
// self-hosted `gnomeola-server`, every test, and Vercel's Node runtime (whose function signature IS
// `(req: IncomingMessage, res: ServerResponse)`), so the code that runs in production is the code the
// tests drive.
//
// Streaming bodies are written as they are produced, honouring backpressure; when the client goes away
// the response stream is cancelled, which aborts the request signal the handlers watch.

export type NodeHandlerOptions = {
  /** Behind a proxy that sets X-Forwarded-Proto/Host (Vercel): build the request URL from them. */
  trustProxy?: boolean
  /** Hard cap while reading a body, before the app's own (smaller) JSON limit. */
  maxBodyBytes?: number
}

export type NodeHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

function headersOf(req: IncomingMessage): Headers {
  const h = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue
    if (Array.isArray(v)) for (const x of v) h.append(k, x)
    else h.set(k, v)
  }
  return h
}

async function readRaw(req: IncomingMessage, limit: number): Promise<Buffer | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const c of req as AsyncIterable<Buffer>) {
    size += c.length
    if (size > limit) return null
    chunks.push(c)
  }
  return Buffer.concat(chunks)
}

export function nodeHandler(app: HostedApp, opts: NodeHandlerOptions = {}): NodeHandler {
  const limit = opts.maxBodyBytes ?? 8 * 1024 * 1024
  return async (req, res) => {
    const ac = new AbortController()
    res.on('close', () => ac.abort())
    const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim()
    const proto = opts.trustProxy ? (first(req.headers['x-forwarded-proto']) ?? 'https') : 'http'
    const host =
      (opts.trustProxy ? first(req.headers['x-forwarded-host']) : undefined) ??
      req.headers.host ??
      'localhost'
    let url: string
    try {
      url = new URL(req.url ?? '/', `${proto}://${host}`).toString()
    } catch {
      res.writeHead(400).end()
      return
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const raw = hasBody ? await readRaw(req, limit) : undefined
    if (raw === null) {
      res.writeHead(413, { 'content-type': 'application/json', connection: 'close' })
      res.end(
        JSON.stringify({ error: { code: 'bad_request', message: `request body exceeds ${limit} bytes` } }),
      )
      return
    }
    const request = new Request(url, {
      method: req.method,
      headers: headersOf(req),
      ...(raw?.length ? { body: raw } : {}),
      signal: ac.signal,
    })
    const response = await app.fetch(request, { remoteAddress: req.socket.remoteAddress })
    const headers: Record<string, string> = {}
    response.headers.forEach((v, k) => {
      headers[k] = v
    })
    res.writeHead(response.status, headers)
    if (!response.body) {
      res.end()
      return
    }
    res.flushHeaders()
    const reader = response.body.getReader()
    const cancel = () => void reader.cancel().catch(() => {})
    ac.signal.addEventListener('abort', cancel, { once: true })
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (res.destroyed) break
        if (!res.write(value)) await Promise.race([once(res, 'drain'), once(res, 'close')])
      }
    } catch {
      // the client went away mid-stream: nothing to report to it
    } finally {
      ac.signal.removeEventListener('abort', cancel)
      if (!res.destroyed) res.end()
    }
  }
}

export type Served = { url: string; port: number; server: Server; close(): Promise<void> }

/** Listen on host:port (0 = any free port). */
export async function serve(
  app: HostedApp,
  opts: { host?: string; port?: number } & NodeHandlerOptions = {},
): Promise<Served> {
  const handle = nodeHandler(app, opts)
  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500).end()
      else res.destroy()
    })
  })
  server.keepAliveTimeout = 5_000
  const host = opts.host ?? '127.0.0.1'
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(opts.port ?? 0, host, () => {
      server.off('error', reject)
      resolve()
    })
  })
  const port = (server.address() as AddressInfo).port
  const urlHost = host.includes(':') ? `[${host}]` : host
  return {
    url: `http://${urlHost}:${port}`,
    port,
    server,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      }),
  }
}
