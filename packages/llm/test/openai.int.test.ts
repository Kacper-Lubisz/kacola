// The OpenAI provider against a local fake of the Responses API (`POST /v1/responses`, SSE). The event
// shapes are the ones the real API sent on 2026-09-30 (response.created / in_progress / failed with
// `credit_balance_exhausted`), plus the documented text, refusal, completed and incomplete events.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Settings } from '@gnomeola/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { ask } from '../src/ask.ts'
import { LlmError } from '../src/errors.ts'
import { DEFAULT_OPENAI_MODEL, OpenAIProvider, supportsReasoning } from '../src/openai.ts'
import { assemblePrompt, SYSTEM_PROMPT } from '../src/prompt.ts'
import { providerFromSettings } from '../src/settings.ts'
import { platformSync } from './fixtures/meeting.ts'

type Handler = (req: IncomingMessage, body: string, res: ServerResponse) => unknown
const servers: Server[] = []

async function fakeOpenAI(handler: Handler) {
  const bodies: Record<string, unknown>[] = []
  const requests: { path: string; auth: string | undefined }[] = []
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const c of req) body += c
    requests.push({ path: `${req.method} ${req.url}`, auth: req.headers.authorization })
    bodies.push(body ? JSON.parse(body) : null)
    await handler(req, body, res)
  })
  servers.push(server)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, bodies, requests }
}

afterEach(async () => {
  for (const s of servers.splice(0)) {
    s.closeAllConnections()
    await new Promise((r) => s.close(r))
  }
})

const tick = () => new Promise((r) => setTimeout(r, 2))
const frame = (o: { type: string } & Record<string, unknown>) =>
  `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`
const response = (extra: Record<string, unknown> = {}) => ({
  id: 'resp_1',
  object: 'response',
  model: 'gpt-5.5-2026-04-23',
  status: 'in_progress',
  error: null,
  incomplete_details: null,
  usage: null,
  ...extra,
})
const created = () =>
  frame({ type: 'response.created', response: response(), sequence_number: 0 }) +
  frame({ type: 'response.in_progress', response: response(), sequence_number: 1 })
const completed = (
  usage = { input_tokens: 2400, output_tokens: 31, input_tokens_details: { cached_tokens: 2048 } },
) => frame({ type: 'response.completed', response: response({ status: 'completed', usage }) })

/** Writes SSE in awkward pieces (splitting frames and JSON mid-way), with CRLF line ends. */
async function streamPieces(res: ServerResponse, text: string, size = 11) {
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  const crlf = text.replace(/\n/g, '\r\n')
  for (let i = 0; i < crlf.length; i += size) {
    res.write(crlf.slice(i, i + size))
    await tick()
  }
  res.end()
}

const prompt = (question = 'What is the retry budget?') =>
  assemblePrompt({ transcripts: [platformSync()], question })

async function run(p: OpenAIProvider, effort: 'low' | 'high' = 'low') {
  const deltas: string[] = []
  let done: unknown
  for await (const ev of p.stream(prompt(), { effort })) {
    if (ev.type === 'delta') deltas.push(ev.text)
    else done = ev
  }
  return { deltas, done }
}

const fast = { retryDelayMs: () => 5 }

describe('OpenAIProvider', () => {
  it('posts the assembled prompt to /responses and parses a split, CRLF SSE stream', async () => {
    const api = await fakeOpenAI((_q, _b, res) =>
      streamPieces(
        res,
        created() +
          frame({ type: 'response.output_text.delta', delta: 'Three attempts, ' }) +
          frame({ type: 'response.output_text.delta', delta: 'then dead-letter [s3].' }) +
          completed(),
      ),
    )
    const p = new OpenAIProvider({ apiKey: 'sk-test', baseURL: api.url, ...fast })
    const { deltas, done } = await run(p)
    expect(deltas.join('')).toBe('Three attempts, then dead-letter [s3].')
    expect(done).toEqual({
      type: 'done',
      stopReason: 'end_turn',
      model: 'gpt-5.5-2026-04-23',
      // input_tokens includes the cached part; the protocol's inputTokens is the uncached remainder
      usage: { inputTokens: 352, outputTokens: 31, cacheReadTokens: 2048, cacheWriteTokens: 0 },
      refusal: null,
      fallback: null,
    })
    expect(api.requests).toEqual([{ path: 'POST /v1/responses', auth: 'Bearer sk-test' }])
    const body = api.bodies[0]!
    expect(body).toMatchObject({
      model: DEFAULT_OPENAI_MODEL,
      instructions: SYSTEM_PROMPT,
      stream: true,
      store: false,
      reasoning: { effort: 'low' },
    })
    // every assembled block is its own input_text part, in order, question last
    const parts = (body.input as { role: string; content: { type: string; text: string }[] }[])[0]!
    expect(parts.role).toBe('user')
    expect(parts.content.map((c) => c.text)).toEqual(prompt().blocks.map((b) => b.text))
    expect(parts.content.every((c) => c.type === 'input_text')).toBe(true)
    expect(parts.content.at(-1)!.text).toContain('What is the retry budget?')
  })

  it('keeps the cacheable prefix byte-stable across questions: same instructions, blocks and cache key', async () => {
    const p = new OpenAIProvider({ apiKey: 'k', baseURL: 'http://x/v1' })
    const a = p.buildBody(prompt('What is the retry budget?'), 'low')
    const b = p.buildBody(prompt('Who owns the migration?'), 'high')
    expect(a.instructions).toBe(b.instructions)
    expect(a.prompt_cache_key).toBe(b.prompt_cache_key)
    expect(a.input[0]!.content.slice(0, -1)).toEqual(b.input[0]!.content.slice(0, -1))
    expect(a.input[0]!.content.at(-1)).not.toEqual(b.input[0]!.content.at(-1))
    expect(b.reasoning).toEqual({ effort: 'high' })
  })

  it('sends reasoning effort only to reasoning models (older chat models 400 on it)', () => {
    for (const m of ['gpt-5.5', 'gpt-5-mini', 'gpt-6-sol', 'o3', 'o4-mini'])
      expect(supportsReasoning(m)).toBe(true)
    for (const m of ['gpt-4.1', 'gpt-4o', 'ft:gpt-4.1:acme']) expect(supportsReasoning(m)).toBe(false)
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4.1', baseURL: 'http://x/v1' })
    expect(p.buildBody(prompt(), 'high')).not.toHaveProperty('reasoning')
  })

  it('a refusal ends the turn as stopReason refusal with the explanation, and ask() drops the text', async () => {
    const api = await fakeOpenAI((_q, _b, res) =>
      streamPieces(
        res,
        created() +
          frame({ type: 'response.refusal.delta', delta: "I can't help with that." }) +
          completed({ input_tokens: 100, output_tokens: 8, input_tokens_details: { cached_tokens: 0 } }),
      ),
    )
    const p = new OpenAIProvider({ apiKey: 'k', baseURL: api.url, ...fast })
    const { deltas, done } = await run(p)
    expect(deltas).toEqual([])
    expect(done).toMatchObject({
      stopReason: 'refusal',
      refusal: { category: null, explanation: "I can't help with that." },
    })
    const events = []
    for await (const ev of ask({ provider: p, transcripts: [platformSync()], question: 'q' })) events.push(ev)
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      text: '',
      refusal: { explanation: "I can't help with that." },
    })
  })

  it('maps response.incomplete: max_output_tokens → max_tokens, content_filter → refusal', async () => {
    let reason = 'max_output_tokens'
    const api = await fakeOpenAI((_q, _b, res) =>
      streamPieces(
        res,
        created() +
          frame({ type: 'response.output_text.delta', delta: 'partial' }) +
          frame({
            type: 'response.incomplete',
            response: response({
              status: 'incomplete',
              incomplete_details: { reason },
              usage: { input_tokens: 5, output_tokens: 5 },
            }),
          }),
      ),
    )
    const p = new OpenAIProvider({ apiKey: 'k', baseURL: api.url, ...fast })
    expect((await run(p)).done).toMatchObject({ stopReason: 'max_tokens', refusal: null })
    reason = 'content_filter'
    expect((await run(p)).done).toMatchObject({
      stopReason: 'refusal',
      refusal: { category: 'content_filter' },
    })
  })

  it('an exhausted account (the real 2026-09-30 stream: nested error event, then response.failed) is a non-retryable quota error', async () => {
    const message =
      'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.'
    for (const order of ['error-first', 'failed-only', 'flat-error'] as const) {
      const errorEvent =
        order === 'flat-error'
          ? frame({ type: 'error', code: 'credit_balance_exhausted', message })
          : frame({
              type: 'error',
              error: { type: 'insufficient_quota', code: 'credit_balance_exhausted', message, param: null },
              sequence_number: 2,
            })
      const failed = frame({
        type: 'response.failed',
        response: response({ status: 'failed', error: { code: 'credit_balance_exhausted', message } }),
        sequence_number: 3,
      })
      const api = await fakeOpenAI((_q, _b, res) =>
        streamPieces(res, created() + (order === 'failed-only' ? failed : errorEvent + failed)),
      )
      const err = await run(new OpenAIProvider({ apiKey: 'k', baseURL: api.url, ...fast })).catch((e) => e)
      expect(err, order).toBeInstanceOf(LlmError)
      expect(err, order).toMatchObject({ code: 'quota', retryable: false })
      expect(err.message, order).toMatch(/no credits remaining/)
      expect(api.requests, order).toHaveLength(1) // never retried
    }
  })

  it('HTTP errors: 401 → auth, 429 insufficient_quota → quota (no retry), 404 → not_found, 400 → bad_request', async () => {
    const cases: [number, unknown, string][] = [
      [401, { error: { message: 'Incorrect API key provided', code: 'invalid_api_key' } }, 'auth'],
      [
        429,
        {
          error: {
            message: 'You exceeded your current quota',
            type: 'insufficient_quota',
            code: 'insufficient_quota',
          },
        },
        'quota',
      ],
      [404, { error: { message: 'The model `gpt-9` does not exist', code: 'model_not_found' } }, 'not_found'],
      [
        400,
        { error: { message: "Unsupported parameter: 'reasoning.effort'", code: 'unsupported_parameter' } },
        'bad_request',
      ],
    ]
    for (const [status, body, code] of cases) {
      const api = await fakeOpenAI((_q, _b, res) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(body))
      })
      const err = await run(new OpenAIProvider({ apiKey: 'k', baseURL: api.url, ...fast })).catch((e) => e)
      expect(err, `${status}`).toMatchObject({ code, status })
      expect(api.requests, `${status} is not retried`).toHaveLength(1)
    }
  })

  it('retries a rate limit (honouring retry-after-ms) and a 500, then streams the answer', async () => {
    let n = 0
    const api = await fakeOpenAI((_q, _b, res) => {
      n++
      if (n === 1) {
        res.writeHead(429, { 'content-type': 'application/json', 'retry-after-ms': '20' })
        return res.end(
          JSON.stringify({ error: { message: 'Rate limit reached', code: 'rate_limit_exceeded' } }),
        )
      }
      if (n === 2) {
        res.writeHead(500, { 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: { message: 'server had an error', type: 'server_error' } }))
      }
      return streamPieces(
        res,
        created() + frame({ type: 'response.output_text.delta', delta: 'ok' }) + completed(),
      )
    })
    const { deltas } = await run(new OpenAIProvider({ apiKey: 'k', baseURL: api.url, ...fast }))
    expect(deltas).toEqual(['ok'])
    expect(n).toBe(3)
  })

  it('gives up after maxRetries and reports the last failure as retryable', async () => {
    const api = await fakeOpenAI((_q, _b, res) => {
      res.writeHead(503, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'overloaded' } }))
    })
    const err = await run(
      new OpenAIProvider({ apiKey: 'k', baseURL: api.url, maxRetries: 1, ...fast }),
    ).catch((e) => e)
    expect(err).toMatchObject({ code: 'overloaded', retryable: true })
    expect(api.requests).toHaveLength(2)
  })

  it('a stream that dies before its final event is a network error, not a silent partial answer', async () => {
    const api = await fakeOpenAI((_q, _b, res) =>
      streamPieces(res, created() + frame({ type: 'response.output_text.delta', delta: 'Three' })),
    )
    const err = await run(new OpenAIProvider({ apiKey: 'k', baseURL: api.url, ...fast })).catch((e) => e)
    expect(err).toMatchObject({ code: 'network' })
  })

  it('aborting mid-stream surfaces as aborted', async () => {
    const api = await fakeOpenAI(async (_q, _b, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write(created() + frame({ type: 'response.output_text.delta', delta: 'Three' }))
      await new Promise((r) => setTimeout(r, 2000))
      res.end()
    })
    const ac = new AbortController()
    const p = new OpenAIProvider({ apiKey: 'k', baseURL: api.url, ...fast })
    const got: string[] = []
    const err = await (async () => {
      for await (const ev of p.stream(prompt(), { effort: 'low', signal: ac.signal })) {
        if (ev.type === 'delta') {
          got.push(ev.text)
          ac.abort()
        }
      }
    })().catch((e) => e)
    expect(got).toEqual(['Three'])
    expect(err).toMatchObject({ code: 'aborted' })
  })

  it('providerFromSettings: openai needs a key (none → no provider) and defaults its model', () => {
    const llm: Settings['llm'] = { provider: 'openai', model: '', ollamaUrl: '', apiKeyConfigured: false }
    expect(providerFromSettings(llm)).toBeNull()
    const p = providerFromSettings(llm, { apiKey: 'sk' })
    expect(p).toBeInstanceOf(OpenAIProvider)
    expect(p?.model).toBe(DEFAULT_OPENAI_MODEL)
    expect(providerFromSettings({ ...llm, model: 'gpt-5-mini' }, { apiKey: 'sk' })?.model).toBe('gpt-5-mini')
  })
})
