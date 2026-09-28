import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AnyEvent,
  AskStreamEvent,
  createClient,
  type GnomeolaClient,
  type RouteName,
  routes,
} from '@gnomeola/protocol'
import { waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDaemon, type Daemon, type Handlers } from '../src/daemon.ts'
import { FakePipeline } from '../src/fakes/pipeline.ts'
import { FakeDevices, FakeModels, FakeQaEngine } from '../src/fakes/providers.ts'
import { MemoryKeyring } from '../src/keyring.ts'

// T1 contract: the real server, driven through the typed protocol client, for every route in the
// table. The client validates every JSON response against the route's response schema, and every SSE
// message is parsed with the protocol's stream schemas here — so a server that drifts from the
// contract fails this test, not a widget three screens later.

// Compile-time exhaustiveness: a handler table missing a route must not typecheck.
// @ts-expect-error — `health` alone is not a complete handler table
const _incomplete: Handlers = { health: () => ({}) as never }
void _incomplete

describe('contract: every route, real server, typed client', () => {
  let dir: string
  let daemon: Daemon
  let c: GnomeolaClient

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'gnomeola-contract-'))
    daemon = await createDaemon({
      dataDir: dir,
      port: 0,
      pipeline: new FakePipeline({
        segmentEveryMs: 60,
        finalizeAfterMs: 30,
        partialEveryMs: 20,
        levelEveryMs: 20,
      }),
      devices: new FakeDevices(),
      models: new FakeModels({ stepMs: 5 }),
      qaEngine: new FakeQaEngine({ delayMs: 0 }),
      keyring: new MemoryKeyring(),
      env: {},
      heartbeatMs: 50,
    })
    c = createClient({ baseUrl: daemon.url, timeoutMs: 5_000 })
  })
  afterAll(async () => {
    await daemon?.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('handles every route with schema-valid responses', async () => {
    const seen = new Set<RouteName>()
    const s = await c.call('createSession', { body: { title: 'contract' } })
    const priv = await c.call('createSession', { body: { title: 'private', private: true } })
    const params = { id: s.id }

    // One entry per route: adding a route to the table without covering it here fails to compile.
    const calls: Record<RouteName, () => Promise<unknown>> = {
      health: () => c.call('health'),
      listDevices: () => c.call('listDevices'),
      listSessions: () => c.call('listSessions', { query: { limit: 10, includePrivate: true } }),
      createSession: () => c.call('createSession', { body: {} }),
      getSession: () => c.call('getSession', { params: { id: priv.id }, query: { includePrivate: true } }),
      updateSession: () => c.call('updateSession', { params, body: { title: 'renamed' } }),
      startSession: () => c.call('startSession', { params }),
      pauseSession: () => c.call('pauseSession', { params }),
      resumeSession: async () => {
        const r = await c.call('resumeSession', { params })
        await waitFor(async () => (await c.call('getTranscript', { params })).total >= 2, 5_000, 'segments')
        return r
      },
      stopSession: () => c.call('stopSession', { params }),
      getTranscript: () => c.call('getTranscript', { params, query: { fromMs: 0, toMs: 60_000 } }),
      getQaHistory: () => c.call('getQaHistory', { params }),
      search: () => c.call('search', { query: { q: 'retry' } }),
      ask: async () => {
        const events: AskStreamEvent[] = []
        for await (const e of c.ask({ question: 'what was decided?', sessionId: s.id }))
          events.push(AskStreamEvent.parse(e))
        expect(events[0]?.type).toBe('question')
        expect(events.at(-1)?.type).toBe('answer')
        expect(events.filter((e) => e.type === 'delta').length).toBeGreaterThan(0)
        return events
      },
      events: async () => {
        const ac = new AbortController()
        const got: AnyEvent[] = []
        for await (const m of c.stream('events', { query: { since: 0 }, signal: ac.signal })) {
          if (!m.data) continue
          got.push(AnyEvent.parse(JSON.parse(m.data)))
          if (got.some((e) => e.data.type === 'heartbeat')) break
        }
        ac.abort()
        expect(got[0]?.seq).toBe(1)
        return got
      },
      listModels: () => c.call('listModels'),
      downloadModel: () => c.call('downloadModel', { params: { id: 'whisper-small.en' } }),
      getSettings: () => c.call('getSettings'),
      updateSettings: () => c.call('updateSettings', { body: { retention: { days: 7 } } }),
      setApiKey: () => c.call('setApiKey', { body: { key: 'sk-ant-contract-test-0000' } }),
      diagnostics: () => c.call('diagnostics'),
      deleteSession: () => c.call('deleteSession', { params: { id: priv.id } }),
    }
    for (const [name, call] of Object.entries(calls) as [RouteName, () => Promise<unknown>][]) {
      await expect(call(), name).resolves.toBeDefined()
      seen.add(name)
    }
    expect([...seen].sort()).toEqual(Object.keys(routes).sort())
  })

  it('serves settings with the documented defaults and never the key', async () => {
    const dir2 = mkdtempSync(join(tmpdir(), 'gnomeola-contract-'))
    const d2 = await createDaemon({ dataDir: dir2, port: 0, keyring: new MemoryKeyring(), env: {} })
    try {
      const c2 = createClient({ baseUrl: d2.url })
      expect(await c2.call('getSettings')).toEqual({
        llm: {
          provider: 'anthropic',
          model: 'claude-opus-5',
          ollamaUrl: 'http://127.0.0.1:11434',
          apiKeyConfigured: false,
        },
        stt: { liveModel: expect.any(String), finalModel: expect.any(String), finalPass: 'during' },
        capture: { micDevice: 'default', systemDevice: 'default' },
        retention: { audio: 'keep', days: 30, archive: false },
      })
      const patched = await c2.call('updateSettings', {
        body: { llm: { model: 'claude-sonnet-5' }, stt: { finalPass: 'after' } },
      })
      expect(patched.llm).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-5' })
      expect(patched.stt.finalPass).toBe('after')
      expect(patched.retention.audio).toBe('keep')
      expect(await c2.call('setApiKey', { body: { key: 'sk-ant-abc-123456789' } })).toEqual({
        configured: true,
      })
      expect((await c2.call('getSettings')).llm.apiKeyConfigured).toBe(true)
      expect(await c2.call('setApiKey', { body: { key: null } })).toEqual({ configured: false })
      // the /ask default: no engine → an `error` event with code unavailable
      const s = await c2.call('createSession', {})
      const events: AskStreamEvent[] = []
      for await (const e of c2.ask({ question: 'anything?', sessionId: s.id })) events.push(e)
      expect(events.map((e) => e.type)).toEqual(['question', 'error'])
      expect(events[1]).toMatchObject({ type: 'error', error: { code: 'unavailable' } })
      expect(await c2.call('health')).toMatchObject({ llm: { provider: 'anthropic', ready: false } })
    } finally {
      await d2.close()
      rmSync(dir2, { recursive: true, force: true })
    }
  })

  it('closes SSE subscriptions without leaking bus listeners or connections', async () => {
    const base = daemon.bus.size
    for (let i = 0; i < 25; i++) {
      const ac = new AbortController()
      const it = c.stream('events', { query: { since: 0, ephemeral: i % 2 === 0 }, signal: ac.signal })
      await it.next()
      expect(daemon.sseClients).toBeGreaterThan(0)
      expect(daemon.bus.size).toBeGreaterThan(base)
      ac.abort()
      await it.return(undefined).catch(() => {})
    }
    await waitFor(() => daemon.bus.size === base && daemon.sseClients === 0, 5_000, 'listeners released')
    expect(daemon.bus.size).toBe(base)
  })
})
