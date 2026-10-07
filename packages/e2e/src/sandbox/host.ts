#!/usr/bin/env node
// The sandbox's hosted sharing server: the real hosted app (packages/server, as `kacola-server` runs
// it, on SQLite under the sandbox dir) plus the shared agenda page (packages/web's agenda.html at
// /a/<token>, as the Vercel deployment rewrites it), so "Send the agenda" in the sandbox window gives a
// http://127.0.0.1:… link that opens in any browser. Magic-link codes are not mailed: they are appended
// to <dir>/mail.log, which `pnpm sandbox mail` prints.
//
//   node packages/e2e/src/sandbox/host.ts --dir <sandbox>/host --port 8791 --admin-token <token>
//
// Prints {"event":"listening","url":…} on stdout when ready.
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { parseArgs } from 'node:util'
import { consoleMailer, createHostedApp, nodeHandler } from '@kacola/server'
import { SqliteStoreApi } from '@kacola/store'
import { FsBlobStore } from '@kacola/store/blob'
import { buildViewer } from '../../../web/scripts/build.ts'

const { values } = parseArgs({
  options: {
    dir: { type: 'string' },
    port: { type: 'string' },
    'admin-token': { type: 'string' },
    secret: { type: 'string' },
  },
})
const dir = values.dir
const adminToken = values['admin-token']
if (!dir || !adminToken) throw new Error('usage: host.ts --dir DIR --port N --admin-token T [--secret S]')
mkdirSync(dir, { recursive: true, mode: 0o700 })
const webDir = join(dir, 'web')
await buildViewer(webDir)
const mailLog = join(dir, 'mail.log')

const store = SqliteStoreApi.open(join(dir, 'server.db'))
const app = createHostedApp({
  store,
  blobs: new FsBlobStore(join(dir, 'blobs')),
  auth: { secret: values.secret ?? `sandbox-${adminToken}`.padEnd(40, 's'), adminToken },
  trustLoopback: false,
  mailer: consoleMailer((m) =>
    appendFileSync(mailLog, `${JSON.stringify({ at: new Date().toISOString(), ...m })}\n`),
  ),
  log: (level, msg, fields) => process.stderr.write(`${JSON.stringify({ level, msg, ...fields })}\n`),
})
const api = nodeHandler(app)

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

/** The shared agenda page and its assets; everything else is the hosted API. */
function staticFile(path: string): string | null {
  if (/^\/a\/[A-Za-z0-9_-]{16,128}\/?$/.test(path)) return join(webDir, 'agenda.html')
  if (!TYPES[extname(path)] || path.includes('..')) return null
  const file = join(webDir, normalize(path))
  return existsSync(file) && statSync(file).isFile() ? file : null
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://sandbox')
  const file = req.method === 'GET' ? staticFile(url.pathname) : null
  if (file) {
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
    return
  }
  api(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500).end()
    else res.destroy()
  })
})
server.keepAliveTimeout = 5_000
server.listen(Number(values.port ?? 8791), '127.0.0.1', () => {
  const port = (server.address() as { port: number }).port
  process.stdout.write(
    `${JSON.stringify({ event: 'listening', url: `http://127.0.0.1:${port}`, port, pid: process.pid })}\n`,
  )
})
const stop = () => {
  server.closeAllConnections()
  server.close(() => {
    void store.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
