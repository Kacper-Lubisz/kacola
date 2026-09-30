import { createClient, isDurable, newId, type Session } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'

// V-8 preview-deployment smoke test. Opt-in: runs only against a real Vercel preview whose URL and owner
// token you provide (never against the developer's account implicitly):
//
//   GNOMEOLA_PREVIEW_URL=https://gnomeola-git-branch-you.vercel.app \
//   GNOMEOLA_PREVIEW_ADMIN_TOKEN=… \
//   [VERCEL_AUTOMATION_BYPASS_SECRET=…]   (for a preview behind Vercel deployment protection)
//   [GNOMEOLA_PREVIEW_WRITE=1]            (also push, read back and delete a throwaway session)
//   pnpm test:e2e packages/vercel/test/preview.e2e.test.ts
//
// It checks the deployment the way the local harness checks the build: static viewer, auth on every
// route, pairing reachable, SSE streams that end before the platform's cap and resume by cursor.

const url = process.env.GNOMEOLA_PREVIEW_URL?.replace(/\/$/, '')
const token = process.env.GNOMEOLA_PREVIEW_ADMIN_TOKEN
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const headers: Record<string, string> = bypass ? { 'x-vercel-protection-bypass': bypass } : {}

describe.skipIf(!url || !token)('preview deployment smoke test', () => {
  const client = () => createClient({ baseUrl: url!, token, headers, timeoutMs: 30_000 })

  it('serves the viewer, and refuses unauthenticated API calls', async () => {
    const page = await fetch(`${url}/`, { headers })
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('/app.js')
    const anon = await fetch(`${url}/sessions`, { headers })
    expect(anon.status).toBe(401)
    expect(anon.headers.get('www-authenticate')).toMatch(/^Bearer/)
    const ev = await fetch(`${url}/events?since=0`, { headers: { ...headers, accept: 'text/event-stream' } })
    expect(ev.status).toBe(401)
    const pair = await fetch(`${url}/pair/start`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'preview smoke test' }),
    })
    expect(pair.status).toBe(200)
  })

  it('answers health with a token, and opens an event stream capped below maxDuration', async () => {
    const c = client()
    const h = await c.call('health')
    expect(h.ok).toBe(true)
    const res = await fetch(`${url}/events?since=${h.lastSeq}&ephemeral=true`, {
      headers: { ...headers, authorization: `Bearer ${token}`, accept: 'text/event-stream' },
    })
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
    const reader = res.body!.getReader()
    const first = new TextDecoder().decode((await reader.read()).value)
    await reader.cancel()
    const cap = Number(/maxStreamMs=(\d+)/.exec(first)?.[1])
    expect(cap).toBeGreaterThan(0)
    expect(cap).toBeLessThan(300_000) // ends itself before the function's 300 s cap
  })

  it.skipIf(process.env.GNOMEOLA_PREVIEW_WRITE !== '1')(
    'round-trips a throwaway session through sync and the event stream, then deletes it',
    async () => {
      const c = client()
      const { lastSeq } = await c.call('health')
      const now = new Date().toISOString()
      const session: Session = {
        id: newId('ses'),
        title: `preview smoke ${now}`,
        createdAt: now,
        startedAt: now,
        endedAt: now,
        status: 'stopped',
        private: false,
        durationMs: 1000,
        tracks: [],
        error: null,
      }
      const deviceId = `smoke-${Date.now()}`
      await c.call('syncPush', {
        body: { deviceId, items: [{ seq: 1, data: { type: 'session.upserted', session } }] },
      })
      const seen: string[] = []
      const ac = new AbortController()
      const sub = c.subscribe({
        since: lastSeq,
        signal: ac.signal,
        onEvent: (e) => {
          if (isDurable(e) && e.data.type === 'session.upserted') seen.push(e.data.session.id)
          if (seen.includes(session.id)) ac.abort()
        },
      })
      await Promise.race([sub, new Promise((r) => setTimeout(r, 20_000))])
      ac.abort()
      expect(seen).toContain(session.id)
      expect((await c.call('getSession', { params: { id: session.id } })).title).toBe(session.title)
      await c.call('deleteSession', { params: { id: session.id } })
    },
  )
})
