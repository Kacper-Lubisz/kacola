// Q-8 — the Ollama provider against a local fake of Ollama's /api/chat (NDJSON streaming).
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Settings } from '@kacola/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { AnthropicProvider } from '../src/anthropic.ts'
import { ask } from '../src/ask.ts'
import type { LlmError } from '../src/errors.ts'
import { OllamaProvider } from '../src/ollama.ts'
import { assemblePrompt, SYSTEM_PROMPT } from '../src/prompt.ts'
import { providerFromSettings } from '../src/settings.ts'
import { platformSync } from './fixtures/meeting.ts'

type Handler = (req: IncomingMessage, body: string, res: ServerResponse) => void | Promise<void>
const servers: Server[] = []

async function fakeOllama(handler: Handler): Promise<{ url: string; bodies: unknown[]; paths: string[] }> {
  const bodies: unknown[] = []
  const paths: string[] = []
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const c of req) body += c
    paths.push(`${req.method} ${req.url}`)
    bodies.push(body ? JSON.parse(body) : null)
    await handler(req, body, res)
  })
  servers.push(server)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, bodies, paths }
}

afterEach(async () => {
  for (const s of servers.splice(0)) {
    s.closeAllConnections()
    await new Promise((r) => s.close(r))
  }
})

const line = (o: unknown) => `${JSON.stringify(o)}\n`
const tick = () => new Promise((r) => setTimeout(r, 2))

/** Streams the given NDJSON text in awkward pieces (splitting lines mid-JSON). */
async function streamPieces(res: ServerResponse, text: string, size = 7) {
  res.writeHead(200, { 'content-type': 'application/x-ndjson' })
  for (let i = 0; i < text.length; i += size) {
    res.write(text.slice(i, i + size))
    await tick()
  }
  res.end()
}

const prompt = () => assemblePrompt({ transcripts: [platformSync()], question: 'What is the retry budget?' })

async function run(p: OllamaProvider) {
  const deltas: string[] = []
  let done: unknown
  for await (const ev of p.stream(prompt(), { effort: 'low' })) {
    if (ev.type === 'delta') deltas.push(ev.text)
    else done = ev
  }
  return { deltas, done }
}

describe('OllamaProvider', () => {
  it('posts the flattened prompt to /api/chat and parses a split NDJSON stream', async () => {
    const nd =
      line({ model: 'llama3.2', message: { role: 'assistant', content: 'Three attempts, ' }, done: false }) +
      line({
        model: 'llama3.2',
        message: { role: 'assistant', content: 'then dead-letter [s3].' },
        done: false,
      }) +
      line({
        model: 'llama3.2',
        message: { role: 'assistant', content: '' },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 812,
        eval_count: 17,
      })
    const fake = await fakeOllama((_req, _b, res) => streamPieces(res, nd))
    const { deltas, done } = await run(new OllamaProvider({ model: 'llama3.2', url: `${fake.url}/` }))

    expect(fake.paths).toEqual(['POST /api/chat'])
    const sent = fake.bodies[0] as {
      model: string
      stream: boolean
      messages: { role: string; content: string }[]
    }
    expect(sent.model).toBe('llama3.2')
    expect(sent.stream).toBe(true)
    expect(sent.messages[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT })
    expect(sent.messages[1]!.role).toBe('user')
    expect(sent.messages[1]!.content).toContain('[s3] 0:31 Bruno: So the retry budget is three attempts')
    expect(sent.messages[1]!.content.trimEnd().endsWith('aliases.')).toBe(true) // question block last

    expect(deltas.join('')).toBe('Three attempts, then dead-letter [s3].')
    expect(done).toEqual({
      type: 'done',
      stopReason: 'end_turn',
      model: 'llama3.2',
      usage: { inputTokens: 812, outputTokens: 17, cacheReadTokens: 0, cacheWriteTokens: 0 },
      refusal: null,
      fallback: null,
    })
  })

  it('works end to end through ask(), citations included', async () => {
    const nd =
      line({ message: { content: 'Thursday [s10].' }, done: false }) +
      line({ done: true, done_reason: 'length', prompt_eval_count: 5, eval_count: 5 })
    const fake = await fakeOllama((_r, _b, res) => streamPieces(res, nd, 3))
    const provider = new OllamaProvider({ model: 'qwen3', url: fake.url })
    let text = ''
    for await (const ev of ask({ provider, transcripts: [platformSync()], question: 'When?' })) {
      if (ev.type === 'done') {
        text = ev.text
        expect(ev.citations[0]!.segmentId).toBe('seg_migration_day')
        expect(ev.stopReason).toBe('max_tokens')
        expect(ev.prompt.cacheable).toBe(false) // Ollama: no explicit breakpoints
      }
    }
    expect(text).toBe('Thursday [1].')
  })

  it('maps HTTP errors (unknown model → not_found)', async () => {
    const fake = await fakeOllama((_r, _b, res) => {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: "model 'nope' not found" }))
    })
    await expect(run(new OllamaProvider({ model: 'nope', url: fake.url }))).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
      message: "Ollama: model 'nope' not found",
    })
  })

  it('surfaces an error line mid-stream', async () => {
    const nd = line({ message: { content: 'partial' }, done: false }) + line({ error: 'out of memory' })
    const fake = await fakeOllama((_r, _b, res) => streamPieces(res, nd))
    await expect(run(new OllamaProvider({ model: 'm', url: fake.url }))).rejects.toMatchObject({
      code: 'server',
      message: 'Ollama: out of memory',
    })
  })

  it('treats a stream that ends without done:true as a network failure', async () => {
    const fake = await fakeOllama((_r, _b, res) => streamPieces(res, line({ message: { content: 'x' } })))
    await expect(run(new OllamaProvider({ model: 'm', url: fake.url }))).rejects.toMatchObject({
      code: 'network',
    })
  })

  it('reports an unreachable daemon as a retryable network error', async () => {
    const fake = await fakeOllama(() => {})
    const url = fake.url
    for (const s of servers.splice(0)) await new Promise((r) => s.close(r))
    const err = (await run(new OllamaProvider({ model: 'm', url })).catch((e) => e)) as LlmError
    expect(err.code).toBe('network')
    expect(err.retryable).toBe(true)
    expect(err.message).toContain('cannot reach Ollama')
  })

  it('aborts mid-stream', async () => {
    const fake = await fakeOllama(async (_r, _b, res) => {
      res.writeHead(200)
      res.write(line({ message: { content: 'slow' }, done: false }))
      await new Promise((r) => setTimeout(r, 5000))
      res.end()
    })
    const ctl = new AbortController()
    const p = new OllamaProvider({ model: 'm', url: fake.url })
    const it = p.stream(prompt(), { effort: 'low', signal: ctl.signal })[Symbol.asyncIterator]()
    expect((await it.next()).value).toEqual({ type: 'delta', text: 'slow' })
    ctl.abort()
    await expect(it.next()).rejects.toMatchObject({ code: 'aborted' })
  })
})

describe('providerFromSettings', () => {
  const llm = (over: Partial<Settings['llm']>): Settings['llm'] => ({
    provider: 'anthropic',
    model: 'claude-opus-5',
    ollamaUrl: 'http://127.0.0.1:11434',
    apiKeyConfigured: true,
    ...over,
  })
  it('builds the configured provider with the configured model', () => {
    const a = providerFromSettings(llm({}), { apiKey: 'k' })
    expect(a).toBeInstanceOf(AnthropicProvider)
    expect(a!.model).toBe('claude-opus-5')
    expect(providerFromSettings(llm({ model: 'claude-sonnet-5' }), { apiKey: 'k' })!.model).toBe(
      'claude-sonnet-5',
    )
    expect(providerFromSettings(llm({ model: '' }), { apiKey: 'k' })!.model).toBe('claude-opus-5')
    const o = providerFromSettings(llm({ provider: 'ollama', model: 'llama3.2' }))
    expect(o).toBeInstanceOf(OllamaProvider)
    expect(o!.model).toBe('llama3.2')
    expect(providerFromSettings(llm({ provider: 'none' }))).toBeNull()
  })
})
