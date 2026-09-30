import { join } from 'node:path'
import { type AnyEvent, createClient, type GnomeolaClient } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TUNNEL_ORIGIN } from '../../desktop/src/shared/bridge.ts'
import { tunnel } from '../../desktop/test/tunnel-harness.ts'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'

// The Electron window's fetch tunnel against the REAL daemon (child process, pairing auth on): the
// renderer's fetch → preload port relay → main's serveTunnel (route check, header allow-list, bearer
// token) → gnomeolad, and the body streamed back. Everything but Electron's IPC transport is the
// shipping code; the transport is Node MessageChannels, which is what MessagePortMain wraps.

const CASSETTES = join(import.meta.dirname, '..', '..', 'llm', 'test', 'fixtures', 'cassettes')

let api: FakeAnthropic
let d: DaemonHandle
let token = ''
let sessionId = ''

beforeAll(async () => {
  api = await startFakeAnthropic()
  d = await startDaemon({
    env: {
      ANTHROPIC_API_KEY: 'sk-ant-e2e-planted-key-0123456789',
      ANTHROPIC_BASE_URL: api.url,
      GNOMEOLA_AUTH_SECRET: 'desktop-tunnel-secret-0123456789abcdef0123',
      GNOMEOLA_FAKE_PIPELINE: JSON.stringify({
        speed: 20,
        segmentEveryMs: 4000,
        finalizeAfterMs: 30,
        tickMs: 20,
      }),
    },
  })
  // pair a device the way `gnomeola pair` does: start, approve from loopback, collect the token
  const start = await d.client.call('pairStart', { body: { name: 'desktop test' } })
  await d.client.call('pairApprove', { body: { userCode: start.userCode } })
  const t = await d.client.call('pairToken', { body: { deviceCode: start.deviceCode } })
  if (t.status !== 'approved') throw new Error('pairing did not approve')
  token = t.token

  const s = await d.client.call('createSession', { body: { title: 'Tunnel standup' } })
  sessionId = s.id
  await d.client.call('startSession', { params: { id: s.id } })
  await waitFor(
    async () => (await d.client.call('getTranscript', { params: { id: s.id } })).segments.length >= 4,
    15_000,
    'segments from the fake pipeline',
  )
  await d.client.call('stopSession', { params: { id: s.id } })
}, 60_000)

afterAll(async () => {
  await d?.stop()
  await api?.close()
})

function tunnelled(tok: string | undefined) {
  const t = tunnel({ baseUrl: d.baseUrl, ...(tok ? { token: tok } : {}) })
  const client: GnomeolaClient = createClient({ baseUrl: TUNNEL_ORIGIN, fetch: t.fetch, timeoutMs: 10_000 })
  return { ...t, client }
}

describe('desktop fetch tunnel ↔ real daemon', () => {
  it('carries JSON calls, with the token added in main', async () => {
    const t = tunnelled(token)
    const { sessions } = await t.client.call('listSessions', { query: { includePrivate: true } })
    expect(sessions.map((s) => s.title)).toContain('Tunnel standup')
    // the token is really sent: a wrong one is refused by the daemon (401 even on loopback)
    await expect(tunnelled('not-a-real-token').client.call('health')).rejects.toMatchObject({ status: 401 })
  })

  it('streams live /events through the tunnel', async () => {
    const t = tunnelled(token)
    const { lastSeq } = await t.client.call('health')
    const got: AnyEvent[] = []
    const ac = new AbortController()
    // subscribing from the cursor: whether the session is created before or after the stream is up,
    // it must arrive exactly once
    const sub = t.client.subscribe({
      since: lastSeq,
      signal: ac.signal,
      ephemeral: false,
      onEvent: (e) => got.push(e),
    })
    await new Promise((r) => setTimeout(r, 200))
    const created = await d.client.call('createSession', { body: { title: 'Arrived live' } })
    await waitFor(
      () => got.some((e) => e.data.type === 'session.upserted' && e.data.session.id === created.id),
      5000,
      'the new session to arrive over the tunnel',
    )
    ac.abort()
    await sub
    expect(
      got.filter((e) => e.data.type === 'session.upserted' && e.data.session.id === created.id),
    ).toHaveLength(1)
    // it came as a stream of frames, not one buffered body
    expect(t.seen.filter((f) => f.type === 'chunk').length).toBeGreaterThan(1)
  })

  it('streams an ask answer (question, deltas, answer)', async () => {
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    const t = tunnelled(token)
    const types: string[] = []
    let text = ''
    for await (const e of t.client.ask({
      question: 'what did we decide about the retry budget?',
      sessionId,
      effort: 'low',
    })) {
      types.push(e.type)
      if (e.type === 'delta') text += e.text
    }
    expect(types[0]).toBe('question')
    expect(types.at(-1)).toBe('answer')
    expect(types.filter((x) => x === 'delta').length).toBeGreaterThan(0)
    expect(text).toMatch(/three attempts/)
  })

  it('refuses a path that is not a protocol route before it reaches the daemon', async () => {
    const t = tunnelled(token)
    const res = await t.fetch(`${TUNNEL_ORIGIN}/../../etc/passwd`)
    expect(res.status).toBe(403)
    const res2 = await t.fetch(`${TUNNEL_ORIGIN}/sessions`, { method: 'DELETE' })
    expect(res2.status).toBe(403)
    expect(t.requests).toHaveLength(2)
  })

  it('never lets the token cross back into the renderer', async () => {
    const t = tunnelled(token)
    await t.client.call('health')
    await t.client.call('listSessions', { query: { includePrivate: true } })
    const unauthorized = tunnelled('wrong-token-value')
    await unauthorized.client.call('health').catch(() => {})
    for (const x of [t, unauthorized]) {
      const everything = JSON.stringify([
        x.requests,
        x.seen.map((f) => (f.type === 'chunk' ? new TextDecoder().decode(f.data) : f)),
      ])
      expect(everything).not.toContain(token)
      expect(everything).not.toContain('wrong-token-value')
      expect(everything.toLowerCase()).not.toContain('authorization')
    }
  })
})
