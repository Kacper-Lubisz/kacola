import { matchPath, type RouteName, routes } from '@kacola/protocol'
import type { TunnelControl, TunnelFrame, TunnelRequest } from '../shared/bridge.ts'

// The main-process half of the fetch tunnel (docs/desktop-app.md, "Fetch tunnel"). The renderer has
// no network (CSP connect-src 'none'); every daemon request arrives here as a TunnelRequest and is:
//
//   1. checked against the protocol route table — method + path must be a real route, else 403;
//   2. stripped to a header allow-list (the renderer cannot set Authorization, Cookie, Origin, Host…);
//   3. sent to the configured base URL with the M8 bearer token added here, never in the renderer;
//   4. streamed back frame by frame over a MessagePort, so SSE (/events), /ask and enhance stream.
//
// Node's fetch sends no Origin header, so the daemon's CSRF / DNS-rebinding guard stays as strict as
// it is for the CLI.

/** The port as this module sees it: Electron's MessagePortMain in the app, a Node port in tests. */
export type TunnelPort = {
  post(frame: TunnelFrame): void
  onControl(cb: (c: TunnelControl) => void): void
  /** Called when the other side goes away without a cancel (renderer reload, crash). */
  onClose(cb: () => void): void
  close(): void
}

export type TunnelDeps = {
  baseUrl: string
  token?: string
  fetch?: typeof fetch
}

const FORWARD_REQUEST_HEADERS = new Set(['accept', 'content-type', 'last-event-id'])
const FORWARD_RESPONSE_HEADERS = new Set(['content-type', 'allow', 'cache-control'])

const table = (Object.entries(routes) as [RouteName, { method: string; path: string }][]).map(
  ([name, def]) => ({ name, method: def.method, path: def.path }),
)

/** The route a request targets, or null when it is not in the protocol's route table. */
export function resolveRoute(method: string, path: string): RouteName | null {
  if (!path.startsWith('/') || path.startsWith('//')) return null
  let pathname: string
  try {
    // parse against a dummy origin: rejects nothing useful, but normalises and splits the query off
    const u = new URL(path, 'http://x')
    if (u.origin !== 'http://x') return null
    pathname = u.pathname
  } catch {
    return null
  }
  // no dot segments: the daemon would never see them anyway, and a check that normalises differently
  // from the server is how path-confusion bugs start
  if (pathname !== path.split('?')[0]) return null
  const m = method.toUpperCase()
  for (const r of table) if (r.method === m && matchPath(r.path, pathname)) return r.name
  return null
}

function refusal(status: number, code: string, message: string): TunnelFrame[] {
  const body = new TextEncoder().encode(JSON.stringify({ error: { code, message } }))
  return [
    { type: 'head', status, statusText: code, headers: [['content-type', 'application/json']] },
    { type: 'chunk', data: body },
    { type: 'end' },
  ]
}

export async function serveTunnel(req: TunnelRequest, port: TunnelPort, deps: TunnelDeps): Promise<void> {
  const ac = new AbortController()
  let finished = false
  const finish = () => {
    finished = true
    port.close()
  }
  port.onControl((c) => {
    if (c.type === 'cancel') ac.abort()
  })
  port.onClose(() => ac.abort())

  const route =
    typeof req?.method === 'string' && typeof req.path === 'string'
      ? resolveRoute(req.method, req.path)
      : null
  if (!route) {
    for (const f of refusal(
      403,
      'forbidden',
      `not a kacola route: ${String(req?.method)} ${String(req?.path)}`,
    ))
      port.post(f)
    finish()
    return
  }

  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(req.headers ?? {})) {
    if (typeof v === 'string' && FORWARD_REQUEST_HEADERS.has(k.toLowerCase())) headers[k.toLowerCase()] = v
  }
  if (deps.token) headers.authorization = `Bearer ${deps.token}`
  const url = deps.baseUrl.replace(/\/+$/, '') + req.path
  const f = deps.fetch ?? globalThis.fetch

  let res: Response
  try {
    res = await f(url, {
      method: req.method.toUpperCase(),
      headers,
      body: typeof req.body === 'string' ? req.body : undefined,
      signal: ac.signal,
      redirect: 'error',
    })
  } catch (err) {
    if (!ac.signal.aborted) port.post({ type: 'error', message: (err as Error).message })
    finish()
    return
  }
  port.post({
    type: 'head',
    status: res.status,
    statusText: res.statusText,
    headers: [...res.headers].filter(([k]) => FORWARD_RESPONSE_HEADERS.has(k.toLowerCase())),
  })
  try {
    if (res.body) {
      for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
        if (ac.signal.aborted) break
        port.post({ type: 'chunk', data: chunk })
      }
    }
    if (!ac.signal.aborted) port.post({ type: 'end' })
  } catch (err) {
    if (!ac.signal.aborted) port.post({ type: 'error', message: (err as Error).message })
  } finally {
    if (!finished) finish()
  }
}
