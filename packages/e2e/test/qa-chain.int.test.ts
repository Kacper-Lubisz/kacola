import { join } from 'node:path'
import type { Segment } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { gnomeola } from '../src/cli.ts'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'

// The whole question-answering chain, for real: gnomeola(1) → gnomeolad (child process) → @gnomeola/llm
// → @anthropic-ai/sdk → HTTP. Only the far end is a replay of recorded Messages API responses.

const CASSETTES = join(import.meta.dirname, '..', '..', 'llm', 'test', 'fixtures', 'cassettes')
const KEY = 'sk-ant-e2e-planted-key-0123456789'

let api: FakeAnthropic
let d: DaemonHandle
let sessionId = ''
let segments: Segment[] = []

beforeAll(async () => {
  api = await startFakeAnthropic()
  d = await startDaemon({
    env: {
      ANTHROPIC_API_KEY: KEY,
      ANTHROPIC_BASE_URL: api.url,
      GNOMEOLA_FAKE_PIPELINE: JSON.stringify({
        speed: 20,
        segmentEveryMs: 4000,
        finalizeAfterMs: 30,
        tickMs: 20,
      }),
    },
  })
  const s = await d.client.call('createSession', { body: { title: 'Platform standup' } })
  sessionId = s.id
  await d.client.call('startSession', { params: { id: s.id } })
  await waitFor(
    async () => (await d.client.call('getTranscript', { params: { id: s.id } })).segments.length >= 8,
    15_000,
    'eight segments from the fake pipeline',
  )
  await d.client.call('stopSession', { params: { id: s.id } })
  segments = (await d.client.call('getTranscript', { params: { id: s.id } })).segments
}, 60_000)

afterEach(() => api.reset())
afterAll(async () => {
  await d?.stop()
  await api?.close()
})

describe('Q&A chain: CLI → daemon → llm → SDK → API', () => {
  it('answers with citations that resolve to real segments of this session', async () => {
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    const r = await gnomeola(
      ['ask', 'what did we decide about the retry budget?', '--session', sessionId],
      d.baseUrl,
    )
    expect(r.stderr).toBe('')
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(out.answer).toMatch(/three attempts, then dead-letter \[1\]/)
    expect(out.stopReason).toBe('end_turn')
    expect(out.model).toBe('claude-opus-5')
    const ids = new Set(segments.map((s) => s.id))
    expect(out.citations.length).toBe(2)
    for (const c of out.citations) {
      expect(c.sessionId).toBe(sessionId)
      expect(ids.has(c.segmentId), `citation ${c.segmentId} must be a real segment`).toBe(true)
    }
  })

  it('sent the request shape the plan specifies', async () => {
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    await gnomeola(['ask', 'retries?', '--session', sessionId, '--effort', 'medium'], d.baseUrl)
    expect(api.seen).toHaveLength(1)
    const req = api.seen[0]!
    expect(req.method).toBe('POST')
    expect(req.path).toMatch(/^\/v1\/messages/)
    expect(req.headers['x-api-key']).toBe(KEY)
    expect(String(req.headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01')
    const body = req.body as {
      model: string
      stream: boolean
      thinking: unknown
      output_config: { effort: string }
      fallbacks: string
      messages: { role: string; content: { type: string; text: string }[] }[]
    }
    expect(body).toMatchObject({
      model: 'claude-opus-5',
      stream: true,
      thinking: { type: 'adaptive' },
      fallbacks: 'default',
    })
    expect(body.output_config.effort).toBe('medium')
    // The transcript the model saw is this session's, and the question comes last.
    const blocks = body.messages[0]!.content
    const all = blocks.map((b) => b.text).join('\n')
    for (const s of segments.slice(0, 3)) expect(all).toContain(s.text)
    expect(blocks.at(-1)!.text).toMatch(/<question>\s*retries\?\s*<\/question>/)
  })

  it('persists the exchange as Q&A history', async () => {
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    await gnomeola(['ask', 'history check', '--session', sessionId], d.baseUrl)
    const { messages } = await d.client.call('getQaHistory', { params: { id: sessionId } })
    const last = messages.slice(-2)
    expect(last.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(last[0]!.text).toBe('history check')
    expect(last[1]!.usage!.inputTokens).toBeGreaterThan(0)
  })

  it('surfaces a refusal as a refusal — empty answer, clear note — never as a half answer', async () => {
    api.enqueue(...loadCassette(join(CASSETTES, 'refusal.json')))
    const json = await gnomeola(['ask', 'something refused', '--session', sessionId], d.baseUrl)
    expect(json.code).toBe(0)
    expect(JSON.parse(json.stdout)).toMatchObject({ answer: '', stopReason: 'refusal', citations: [] })
    api.enqueue(...loadCassette(join(CASSETTES, 'refusal.json')))
    const text = await gnomeola(['ask', 'something refused', '--session', sessionId], d.baseUrl, {
      tty: true,
    })
    expect(text.stdout).toMatch(/model declined to answer this question — disregard the partial text above/)
  })

  it('maps a provider outage to exit 6 with the reason, after the SDK has retried', async () => {
    const [overloaded] = loadCassette(join(CASSETTES, 'overloaded.json'))
    api.always(overloaded!)
    const r = await gnomeola(['ask', 'anyone there?', '--session', sessionId], d.baseUrl)
    expect(r.code).toBe(6)
    // the provider is busy: retry, never "add an API key", never the raw JSON body
    expect(r.stderr).toMatch(/Anthropic is busy right now\. Try again in a minute\./)
    expect(r.stderr).not.toMatch(/API key|overloaded_error|\{"type"/)
    expect(api.seen.length).toBeGreaterThan(1) // retried before giving up
  }, 60_000)

  it('never leaks the API key into any output', async () => {
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    const r = await gnomeola(['ask', 'leak check', '--session', sessionId], d.baseUrl)
    const diag = await d.client.call('diagnostics')
    for (const text of [r.stdout, r.stderr, d.output(), JSON.stringify(diag)]) expect(text).not.toContain(KEY)
  })
})

describe('Q&A chain without a key', () => {
  it('reports the capability as unavailable (exit 6) instead of failing obscurely', async () => {
    const bare = await startDaemon({ env: { ANTHROPIC_BASE_URL: 'http://127.0.0.1:9' } })
    try {
      const s = await bare.client.call('createSession', { body: { title: 'x' } })
      const r = await gnomeola(['ask', 'q', '--session', s.id], bare.baseUrl)
      expect(r.code).toBe(6)
      expect(r.stderr).toMatch(/Anthropic needs an API key\. Add it in Preferences\./)
      expect(r.stderr).not.toMatch(/not ready|none provider/)
    } finally {
      await bare.stop()
    }
  })
})
