import { GnomeolaApiError, type GnomeolaClient } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// X-7 server side. Private sessions are hidden from every read path unless the caller passes
// includePrivate=true. This is a guard against *accidental* exposure to the agent surface (the CLI and
// the Claude skill never pass the flag), not a security boundary: any local process can pass it too.

async function code(p: Promise<unknown>): Promise<number> {
  try {
    await p
    return 200
  } catch (err) {
    if (err instanceof GnomeolaApiError) return err.status
    throw err
  }
}

async function record(c: GnomeolaClient, title: string, priv: boolean) {
  const s = await c.call('createSession', { body: { title, private: priv } })
  await c.call('startSession', { params: { id: s.id } })
  await waitFor(
    async () =>
      (await c.call('getTranscript', { params: { id: s.id }, query: { includePrivate: true } })).total >= 4,
    10_000,
  )
  await c.call('stopSession', { params: { id: s.id } })
  return s
}

describe('private sessions', () => {
  let d: DaemonHandle
  let pub: { id: string }
  let priv: { id: string }

  beforeAll(async () => {
    d = await startDaemon({
      env: {
        GNOMEOLA_FAKE_QA: '1',
        GNOMEOLA_FAKE_PIPELINE: JSON.stringify({ segmentEveryMs: 60, finalizeAfterMs: 30 }),
      },
    })
    pub = await record(d.client, 'Public standup', false)
    priv = await record(d.client, 'Private one-to-one', true)
    // Q&A on the private session, asked explicitly
    for await (const _ of d.client.ask({ question: 'secret?', sessionId: priv.id, includePrivate: true })) {
    }
  })
  afterAll(async () => {
    await d?.stop()
  })

  it('are left out of listings', async () => {
    const c = d.client
    expect((await c.call('listSessions')).sessions.map((s) => s.id)).toEqual([pub.id])
    expect(
      (await c.call('listSessions', { query: { includePrivate: false } })).sessions.map((s) => s.id),
    ).toEqual([pub.id])
    expect(
      (await c.call('listSessions', { query: { includePrivate: true } })).sessions.map((s) => s.id).sort(),
    ).toEqual([pub.id, priv.id].sort())
  })

  it('are indistinguishable from missing on get / transcript / qa history', async () => {
    const c = d.client
    const p = { id: priv.id }
    expect(await code(c.call('getSession', { params: p }))).toBe(404)
    expect(await code(c.call('getTranscript', { params: p }))).toBe(404)
    expect(await code(c.call('getTranscript', { params: p, query: { fromMs: 0, toMs: 1000 } }))).toBe(404)
    expect(await code(c.call('getQaHistory', { params: p }))).toBe(404)
    const missing = { id: 'ses_doesnotexist' }
    const [a, b] = await Promise.all([
      c.call('getSession', { params: p }).catch((e: GnomeolaApiError) => e.message.replace(priv.id, 'X')),
      c
        .call('getSession', { params: missing })
        .catch((e: GnomeolaApiError) => e.message.replace(missing.id, 'X')),
    ])
    expect(a).toBe(b)
    // and visible when asked for explicitly
    expect((await c.call('getSession', { params: p, query: { includePrivate: true } })).private).toBe(true)
    expect(
      (await c.call('getTranscript', { params: p, query: { includePrivate: true } })).total,
    ).toBeGreaterThan(0)
    expect(
      (await c.call('getQaHistory', { params: p, query: { includePrivate: true } })).messages.length,
    ).toBe(2)
  })

  it('are excluded from search, even when named by sessionId', async () => {
    const c = d.client
    const all = await c.call('search', { query: { q: 'retry', limit: 100 } })
    expect(all.hits.length).toBeGreaterThan(0)
    expect(all.hits.every((h) => h.sessionId === pub.id)).toBe(true)
    expect(await c.call('search', { query: { q: 'retry', sessionId: priv.id } })).toEqual({
      hits: [],
      total: 0,
    })
    const withPriv = await c.call('search', { query: { q: 'retry', limit: 100, includePrivate: true } })
    expect(new Set(withPriv.hits.map((h) => h.sessionId))).toEqual(new Set([pub.id, priv.id]))
  })

  it('cannot be asked about, directly or across sessions, unless explicitly included', async () => {
    const c = d.client
    expect(await code(collect(c.ask({ question: 'what?', sessionId: priv.id })))).toBe(404)
    const cross = await collect(c.ask({ question: 'what happened this week?', since: '7d' }))
    const answer = cross.find((e) => e.type === 'answer')
    expect(answer?.type).toBe('answer')
    if (answer?.type === 'answer') {
      expect(answer.message.citations.length).toBeGreaterThan(0)
      expect(answer.message.citations.every((x) => x.sessionId === pub.id)).toBe(true)
      expect(answer.message.text).not.toContain('Private')
    }
    const crossPriv = await collect(
      c.ask({ question: 'and including private?', since: '7d', includePrivate: true }),
    )
    const a2 = crossPriv.find((e) => e.type === 'answer')
    // newest first: with private included, the private session is what the engine sees first
    expect(a2?.type === 'answer' && a2.message.citations.some((x) => x.sessionId === priv.id)).toBe(true)
  })
})

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const x of it) out.push(x)
  return out
}
