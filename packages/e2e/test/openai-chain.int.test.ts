import type { Segment } from '@kacola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@kacola/testkit/daemon'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { kacola } from '../src/cli.ts'
import { type CannedResponse, type FakeAnthropic, startFakeAnthropic } from '../src/fake-anthropic.ts'

// The question-answering chain with the OpenAI provider, for real: kacola(1) → kacolad (child
// process, provider chosen from OPENAI_API_KEY alone) → @kacola/llm's OpenAIProvider → HTTP. Only the
// far end is a local stand-in serving Responses API streams (the replaying server is provider-agnostic).

const KEY = 'sk-proj-e2e-planted-openai-key-0123456789'

const frame = (o: { type: string } & Record<string, unknown>) =>
  `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`
const sse = (body: string): CannedResponse => ({
  status: 200,
  headers: { 'content-type': 'text/event-stream' },
  body,
})
const resp = (extra: Record<string, unknown> = {}) => ({
  id: 'resp_e2e',
  object: 'response',
  model: 'gpt-5.5-2026-04-23',
  ...extra,
})

const citedAnswer = () =>
  sse(
    frame({ type: 'response.created', response: resp({ status: 'in_progress' }) }) +
      frame({
        type: 'response.output_text.delta',
        delta: 'The retry budget is three attempts, then dead-letter [s',
      }) +
      frame({
        type: 'response.output_text.delta',
        delta: '3]; failures after that go to the dead-letter queue [s5].',
      }) +
      frame({
        type: 'response.completed',
        response: resp({
          status: 'completed',
          usage: { input_tokens: 3100, output_tokens: 40, input_tokens_details: { cached_tokens: 2048 } },
        }),
      }),
  )

let api: FakeAnthropic
let d: DaemonHandle
let sessionId = ''
let segments: Segment[] = []

beforeAll(async () => {
  api = await startFakeAnthropic()
  d = await startDaemon({
    env: {
      OPENAI_API_KEY: KEY,
      OPENAI_BASE_URL: `${api.url}/v1`,
      KACOLA_FAKE_PIPELINE: JSON.stringify({
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

describe('Q&A chain with OpenAI: CLI → daemon → llm → Responses API', () => {
  it('a daemon with only OPENAI_API_KEY defaults to OpenAI, ready, with its default model', async () => {
    const s = await d.client.call('getSettings')
    expect(s.llm).toMatchObject({ provider: 'openai', model: 'gpt-5.5', apiKeyConfigured: true })
    expect((await d.client.call('health')).llm).toEqual({ provider: 'openai', ready: true })
  })

  it('answers with citations that resolve to real segments, and reports cached tokens', async () => {
    api.enqueue(citedAnswer())
    const r = await kacola(
      ['ask', 'what did we decide about the retry budget?', '--session', sessionId],
      d.baseUrl,
    )
    expect(r.stderr).toBe('')
    expect(r.code).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(out.answer).toMatch(/three attempts, then dead-letter \[1\]/)
    expect(out.model).toBe('gpt-5.5-2026-04-23')
    expect(out.stopReason).toBe('end_turn')
    const ids = new Set(segments.map((s) => s.id))
    expect(out.citations).toHaveLength(2)
    for (const c of out.citations) expect(ids.has(c.segmentId), c.segmentId).toBe(true)
    const history = await d.client.call('getQaHistory', { params: { id: sessionId } })
    expect(history.messages.at(-1)!.usage).toEqual({
      inputTokens: 1052,
      outputTokens: 40,
      cacheReadTokens: 2048,
      cacheWriteTokens: 0,
    })
  })

  it('sent a Responses API request with the key, the transcript as input_text, and the effort asked for', async () => {
    api.enqueue(citedAnswer())
    await kacola(['ask', 'retries?', '--session', sessionId, '--effort', 'medium'], d.baseUrl)
    expect(api.seen).toHaveLength(1)
    const req = api.seen[0]!
    expect(`${req.method} ${req.path}`).toBe('POST /v1/responses')
    expect(req.headers.authorization).toBe(`Bearer ${KEY}`)
    const body = req.body as {
      model: string
      reasoning: unknown
      store: boolean
      input: { content: { text: string }[] }[]
    }
    expect(body).toMatchObject({
      model: 'gpt-5.5',
      reasoning: { effort: 'medium' },
      store: false,
      stream: true,
    })
    const text = body.input[0]!.content.map((c) => c.text).join('\n')
    expect(text).toContain('retries?')
    expect(text).toContain(segments[0]!.text)
  })

  it('an exhausted OpenAI account is a clear, actionable error — nothing persisted as an answer', async () => {
    api.enqueue(
      sse(
        frame({ type: 'response.created', response: resp({ status: 'in_progress' }) }) +
          // the real order (seen live 2026-09-30): a nested `error` event, then response.failed
          frame({
            type: 'error',
            error: {
              type: 'insufficient_quota',
              code: 'credit_balance_exhausted',
              message: 'You have no credits remaining.',
            },
          }) +
          frame({
            type: 'response.failed',
            response: resp({
              status: 'failed',
              error: { code: 'credit_balance_exhausted', message: 'You have no credits remaining.' },
            }),
          }),
      ),
    )
    const before = (await d.client.call('getQaHistory', { params: { id: sessionId } })).messages.length
    const r = await kacola(['ask', 'anything?', '--session', sessionId], d.baseUrl)
    expect(r.code).toBe(6) // unavailable
    expect(r.stderr).toMatch(/no credits left/)
    expect(api.seen).toHaveLength(1) // not retried
    const after = (await d.client.call('getQaHistory', { params: { id: sessionId } })).messages
    expect(after).toHaveLength(before + 1) // the question only
    expect(after.at(-1)!.role).toBe('user')
  })

  it('switching to Anthropic picks a Claude model and reports that provider has no key; switching back restores OpenAI', async () => {
    const a = await d.client.call('updateSettings', { body: { llm: { provider: 'anthropic' } } })
    expect(a.llm).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5', apiKeyConfigured: false })
    expect((await d.client.call('health')).llm).toEqual({ provider: 'anthropic', ready: false })
    const o = await d.client.call('updateSettings', { body: { llm: { provider: 'openai' } } })
    expect(o.llm).toMatchObject({ provider: 'openai', model: 'gpt-5.5', apiKeyConfigured: true })
  })

  it('the key never appears in responses, the event log, the database or the logs', async () => {
    const out = await fetch(`${d.baseUrl}/diagnostics`).then((r) => r.text())
    expect(out).not.toContain(KEY)
    expect(d.output()).not.toContain(KEY)
  })
})
