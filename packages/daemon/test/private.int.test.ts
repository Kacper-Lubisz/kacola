import { KacolaApiError, type KacolaClient } from '@kacola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@kacola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// X-7 server side. Private sessions are hidden from every read path unless the caller passes
// includePrivate=true. This is a guard against *accidental* exposure to the agent surface (the CLI and
// the Claude skill never pass the flag), not a security boundary: any local process can pass it too.

async function code(p: Promise<unknown>): Promise<number> {
  try {
    await p
    return 200
  } catch (err) {
    if (err instanceof KacolaApiError) return err.status
    throw err
  }
}

async function record(c: KacolaClient, title: string, priv: boolean) {
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
        KACOLA_FAKE_QA: '1',
        KACOLA_FAKE_PIPELINE: JSON.stringify({ segmentEveryMs: 60, finalizeAfterMs: 30 }),
      },
    })
    pub = await record(d.client, 'Public standup', false)
    priv = await record(d.client, 'Private one-to-one', true)
    // Q&A on the private session, asked explicitly, with an on-device provider (private never goes to
    // the cloud: see 'private means never sent to the cloud' below)
    await d.client.call('updateSettings', { body: { llm: { provider: 'ollama' } } })
    for await (const _ of d.client.ask({ question: 'secret?', sessionId: priv.id, includePrivate: true })) {
    }
    await d.client.call('updateSettings', { body: { llm: { provider: 'anthropic' } } })
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
      c.call('getSession', { params: p }).catch((e: KacolaApiError) => e.message.replace(priv.id, 'X')),
      c
        .call('getSession', { params: missing })
        .catch((e: KacolaApiError) => e.message.replace(missing.id, 'X')),
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
    // includePrivate with a cloud provider: private meetings are still left out (the regression: the
    // window always passes includePrivate, and private meetings went to the provider)
    const crossPriv = await collect(
      c.ask({ question: 'and including private?', since: '7d', includePrivate: true }),
    )
    const q2 = crossPriv.find((e) => e.type === 'question')
    expect(q2?.type === 'question' && q2.scope).toEqual({
      sessionIds: [pub.id],
      excludedPrivate: 1,
      provider: 'anthropic',
      onDevice: false,
    })
    const a2 = crossPriv.find((e) => e.type === 'answer')
    expect(a2?.type).toBe('answer')
    if (a2?.type === 'answer') expect(a2.message.citations.every((x) => x.sessionId === pub.id)).toBe(true)
  })

  describe('private means never sent to the cloud', () => {
    const settle = async (llm: Record<string, unknown>) => {
      await d.client.call('updateSettings', { body: { llm } })
    }

    it('refuses Ask on one private meeting with a cloud provider: typed 409, nothing sent or stored', async () => {
      const c = d.client
      const before = (await c.call('getQaHistory', { params: priv, query: { includePrivate: true } }))
        .messages
      for (const llm of [
        { provider: 'anthropic' },
        { provider: 'openai' },
        // Ollama on another machine is not on this computer
        { provider: 'ollama', ollamaUrl: 'http://192.168.1.20:11434' },
      ]) {
        await settle(llm)
        const err = await collect(
          c.ask({ question: 'salary?', sessionId: priv.id, includePrivate: true }),
        ).catch((e: unknown) => e)
        expect(err).toBeInstanceOf(KacolaApiError)
        const e = err as KacolaApiError
        expect(e.status).toBe(409)
        expect(e.code).toBe('conflict')
        expect(e.detail.reason).toBe('private-meeting')
        expect(e.message).toMatch(/private, so kacola won't send it to/)
      }
      await settle({ provider: 'anthropic', ollamaUrl: 'http://127.0.0.1:11434' })
      const after = (await c.call('getQaHistory', { params: priv, query: { includePrivate: true } })).messages
      expect(after).toEqual(before)
    })

    it('allows it with Ollama on this computer, and says nothing left the machine', async () => {
      const c = d.client
      await settle({ provider: 'ollama', ollamaUrl: 'http://localhost:11434' })
      try {
        const one = await collect(c.ask({ question: 'salary?', sessionId: priv.id, includePrivate: true }))
        const q = one.find((e) => e.type === 'question')
        expect(q?.type === 'question' && q.scope?.onDevice).toBe(true)
        expect(one.some((e) => e.type === 'answer')).toBe(true)
        const cross = await collect(c.ask({ question: 'everything', since: '7d', includePrivate: true }))
        const cq = cross.find((e) => e.type === 'question')
        expect(cq?.type === 'question' && cq.scope?.excludedPrivate).toBe(0)
        expect(cq?.type === 'question' && new Set(cq.scope?.sessionIds)).toEqual(new Set([pub.id, priv.id]))
      } finally {
        await settle({ provider: 'anthropic' })
      }
    })

    it('agents cannot attach to a private recording the user has not opened to them', async () => {
      const c = d.client
      const live = await c.call('createSession', { body: { title: 'Private live', private: true } })
      await c.call('startSession', { params: { id: live.id } })
      try {
        expect(
          await code(
            c.call('createAgentLease', {
              params: { id: live.id },
              body: { name: 'claude', mode: 'suggest' },
            }),
          ),
        ).toBe(404)
        expect((await c.call('listLiveSessions')).sessions.map((s) => s.sessionId)).not.toContain(live.id)
      } finally {
        await c.call('stopSession', { params: { id: live.id } })
      }
    })
  })
})

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const x of it) out.push(x)
  return out
}
