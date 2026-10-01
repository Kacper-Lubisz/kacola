#!/usr/bin/env node
// A local stand-in for the Vercel edge + Node runtime, driving the EXACT build output (.vercel/output):
//
//   - routes from config.json, in order: `headers`+`continue`, `src`→`dest` rewrites, `handle: filesystem`
//   - static files from static/ (`/` → index.html)
//   - each function's bundled index.mjs, imported once (a warm instance), called as (req, res) — the
//     launcherType "Nodejs" signature — with the headers Vercel's proxy adds (x-forwarded-*)
//   - each function's maxDuration from its .vc-config.json, ENFORCED: a response still open at the cap
//     is destroyed, as the platform does (times scaled by HARNESS_TIME_SCALE)
//
// Runs as its own process (tests spawn it) so the functions see only the environment given to them.
// Prints {"event":"listening","url":…} when ready. GET /__harness/stats reports invocations and kills.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'

type Route =
  | { src: string; dest?: string; headers?: Record<string, string>; continue?: boolean }
  | { handle: 'filesystem' }
type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void

const out = process.argv[2]
if (!out) throw new Error('usage: harness-server.ts <.vercel/output dir>')
const scale = Number(process.env.HARNESS_TIME_SCALE ?? '1')
const config = JSON.parse(readFileSync(join(out, 'config.json'), 'utf8')) as { routes: Route[] }
const stats = { invocations: {} as Record<string, number>, kills: {} as Record<string, number>, open: 0 }
const fns = new Map<string, Promise<{ handler: Handler; maxDuration: number }>>()

function fn(name: string) {
  let f = fns.get(name)
  if (!f) {
    const dir = join(out!, 'functions', '_fn', `${name}.func`)
    const vc = JSON.parse(readFileSync(join(dir, '.vc-config.json'), 'utf8')) as {
      handler: string
      maxDuration: number
      launcherType: string
    }
    if (vc.launcherType !== 'Nodejs') throw new Error(`${name}: unsupported launcher ${vc.launcherType}`)
    f = import(pathToFileURL(join(dir, vc.handler)).href).then((m: { default: Handler }) => ({
      handler: m.default,
      maxDuration: vc.maxDuration,
    }))
    fns.set(name, f)
  }
  return f
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

function serveStatic(path: string, res: ServerResponse, headers: Record<string, string>): boolean {
  const rel = normalize(path === '/' ? '/index.html' : path)
  if (rel.includes('..')) return false
  const file = join(out!, 'static', rel)
  if (!existsSync(file) || !statSync(file).isFile()) return false
  res.writeHead(200, { ...headers, 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
  return true
}

async function invoke(
  name: string,
  req: IncomingMessage,
  res: ServerResponse,
  headers: Record<string, string>,
) {
  const { handler, maxDuration } = await fn(name)
  stats.invocations[name] = (stats.invocations[name] ?? 0) + 1
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  // what Vercel's proxy tells a function about the original request
  req.headers['x-forwarded-for'] = req.socket.remoteAddress ?? '203.0.113.1'
  req.headers['x-forwarded-proto'] = 'https'
  req.headers['x-forwarded-host'] = req.headers.host ?? 'localhost'
  req.headers['x-vercel-id'] = `harness::${Date.now()}`
  stats.open++
  const kill = setTimeout(
    () => {
      if (res.writableEnded) return
      stats.kills[name] = (stats.kills[name] ?? 0) + 1
      res.destroy() // the platform's hard stop at maxDuration
    },
    maxDuration * 1000 * scale,
  )
  res.on('close', () => {
    clearTimeout(kill)
    stats.open--
  })
  await handler(req, res)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://harness')
  if (url.pathname === '/__harness/stats') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(stats))
    return
  }
  const headers: Record<string, string> = {}
  try {
    for (const r of config.routes) {
      if ('handle' in r) {
        if (req.method === 'GET' && serveStatic(url.pathname, res, headers)) return
        continue
      }
      if (!new RegExp(r.src).test(url.pathname)) continue
      Object.assign(headers, r.headers ?? {})
      if (r.dest?.startsWith('/_fn/')) return await invoke(r.dest.slice(5), req, res, headers)
      // a rewrite to a static file (Vercel then serves it from the filesystem)
      if (r.dest && req.method === 'GET' && serveStatic(r.dest, res, headers)) return
      if (!r.continue) break
    }
    res.writeHead(404, { ...headers, 'content-type': 'text/plain' })
    res.end('not found')
  } catch (err) {
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' })
    res.end(`harness: function crashed: ${(err as Error).stack}`)
  }
})
server.listen(0, '127.0.0.1', () => {
  process.stdout.write(
    `${JSON.stringify({ event: 'listening', url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })}\n`,
  )
})
process.on('SIGTERM', () => {
  server.closeAllConnections()
  server.close(() => process.exit(0))
})
