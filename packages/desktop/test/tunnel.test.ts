import { createClient } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import { resolveRoute } from '../src/main/tunnel.ts'
import { TUNNEL_ORIGIN } from '../src/shared/bridge.ts'
import { tunnel } from './tunnel-harness.ts'

describe('route validation', () => {
  it('accepts exactly the protocol routes', () => {
    expect(resolveRoute('GET', '/health')).toBe('health')
    expect(resolveRoute('get', '/sessions?includePrivate=true')).toBe('listSessions')
    expect(resolveRoute('POST', '/sessions/ses_1/start')).toBe('startSession')
    expect(resolveRoute('GET', '/events?since=4')).toBe('events')
    expect(resolveRoute('POST', '/ask')).toBe('ask')
  })
  it('refuses anything else', () => {
    expect(resolveRoute('GET', '/nope')).toBeNull()
    expect(resolveRoute('DELETE', '/health')).toBeNull() // right path, wrong method
    expect(resolveRoute('GET', 'http://evil.example/health')).toBeNull()
    expect(resolveRoute('GET', '//evil.example/health')).toBeNull()
    expect(resolveRoute('GET', '/sessions/../health')).toBeNull()
    expect(resolveRoute('GET', '/sessions/%2e%2e/health')).toBeNull()
    expect(resolveRoute('GET', 'health')).toBeNull()
  })
})

const fakeNet = (handler: (url: string, init: RequestInit) => Response | Promise<Response>) => {
  const calls: { url: string; init: RequestInit }[] = []
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return handler(url, init)
  }) as unknown as typeof fetch
  return { f, calls }
}

describe('serveTunnel', () => {
  it('prefixes the base URL, forwards only allow-listed headers, and adds the token itself', async () => {
    const net = fakeNet(() => Response.json({ ok: true }))
    const t = tunnel({ baseUrl: 'http://127.0.0.1:9/', token: 'sekrit', fetch: net.f })
    const res = await t.fetch(`${TUNNEL_ORIGIN}/sessions?limit=1`, {
      headers: {
        accept: 'application/json',
        authorization: 'Bearer forged',
        cookie: 'a=b',
        origin: 'https://evil',
        'x-y': '1',
      },
    })
    expect(await res.json()).toEqual({ ok: true })
    expect(net.calls[0]!.url).toBe('http://127.0.0.1:9/sessions?limit=1')
    expect(net.calls[0]!.init.headers).toEqual({ accept: 'application/json', authorization: 'Bearer sekrit' })
    expect(net.calls[0]!.init.redirect).toBe('error')
    // the token never went back across
    expect(JSON.stringify(t.seen)).not.toContain('sekrit')
  })

  it('answers a non-route with 403 without touching the network', async () => {
    const net = fakeNet(() => Response.json({}))
    const t = tunnel({ baseUrl: 'http://127.0.0.1:9', fetch: net.f })
    const client = createClient({ baseUrl: TUNNEL_ORIGIN, fetch: t.fetch })
    const res = await t.fetch(`${TUNNEL_ORIGIN}/admin/secrets`)
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('forbidden')
    expect(net.calls).toHaveLength(0)
    // and a hand-built request that smuggles a foreign URL is refused before it leaves
    await expect(t.fetch('https://evil.example/health')).rejects.toThrow(/only carries daemon requests/)
    await expect(client.call('health')).rejects.toThrow() // fake net returns {}: fails schema, not tunnel
  })

  it('streams the body chunk by chunk (SSE works through it)', async () => {
    const enc = new TextEncoder()
    let push: (s: string) => void = () => {}
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        push = (s) => c.enqueue(enc.encode(s))
      },
    })
    const net = fakeNet(() => new Response(body, { headers: { 'content-type': 'text/event-stream' } }))
    const t = tunnel({ baseUrl: 'http://127.0.0.1:9', fetch: net.f })
    const res = await t.fetch(`${TUNNEL_ORIGIN}/events?since=0`, { headers: { accept: 'text/event-stream' } })
    expect(res.headers.get('content-type')).toBe('text/event-stream')
    const reader = res.body!.getReader()
    push('id: 1\ndata: {"a":1}\n\n')
    const first = await reader.read()
    expect(new TextDecoder().decode(first.value)).toContain('"a":1')
    push('id: 2\ndata: {"a":2}\n\n')
    const second = await reader.read()
    expect(new TextDecoder().decode(second.value)).toContain('"a":2')
    await reader.cancel()
  })

  it('aborting the renderer fetch cancels the request in main', async () => {
    let aborted = false
    const net = fakeNet(
      (_u, init) =>
        new Promise<Response>(() => {
          init.signal?.addEventListener('abort', () => {
            aborted = true
          })
        }),
    )
    const t = tunnel({ baseUrl: 'http://127.0.0.1:9', fetch: net.f })
    const ac = new AbortController()
    const p = t.fetch(`${TUNNEL_ORIGIN}/health`, { signal: ac.signal })
    await new Promise((r) => setTimeout(r, 20))
    ac.abort()
    await expect(p).rejects.toThrow(/abort/i)
    await new Promise((r) => setTimeout(r, 20))
    expect(aborted).toBe(true)
  })

  it('an unreachable daemon is a fetch TypeError, which the client reports as unreachable', async () => {
    const net = fakeNet(() => {
      throw new TypeError('fetch failed')
    })
    const t = tunnel({ baseUrl: 'http://127.0.0.1:9', fetch: net.f })
    await expect(t.fetch(`${TUNNEL_ORIGIN}/health`)).rejects.toThrow(TypeError)
    const client = createClient({ baseUrl: TUNNEL_ORIGIN, fetch: t.fetch })
    await expect(client.call('health')).rejects.toMatchObject({ name: 'DaemonUnreachableError' })
  })

  it('carries a JSON body and the method', async () => {
    const net = fakeNet(() => new Response(null, { status: 204 }))
    const t = tunnel({ baseUrl: 'http://127.0.0.1:9', fetch: net.f })
    const res = await t.fetch(`${TUNNEL_ORIGIN}/sessions/ses_1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{"title":"x"}',
    })
    expect(res.status).toBe(204)
    expect(net.calls[0]!.init).toMatchObject({ method: 'PATCH', body: '{"title":"x"}' })
  })
})
