// V-5a — the real SDK and the real provider, replayed from cassettes at the fetch layer.
//
// Two things are proven here:
//   1. the responses are realistic: @anthropic-ai/sdk parses every hand-authored stream and error body
//      into the same typed events/errors it would produce from the live API;
//   2. the request we send — the part we control — has the contract docs/llm.md describes.
import { readFileSync } from 'node:fs'
import { type CassetteRequest, parseSse, useCassette } from '@gnomeola/testkit/cassettes'
import { describe, expect, it } from 'vitest'
import { AnthropicProvider, SERVER_SIDE_FALLBACK_BETA } from '../src/anthropic.ts'
import { estimateCostUsd } from '../src/cost.ts'
import { SYSTEM_PROMPT } from '../src/prompt.ts'
import { buildCassette, cassettePath } from './fixtures/cassette-builder.ts'
import { INJECTION_LINE } from './fixtures/meeting.ts'
import {
  fixtureTranscripts,
  type Outcome,
  QUESTIONS,
  SCENARIOS,
  type Scenario,
} from './fixtures/scenarios.ts'

type Body = {
  model: string
  max_tokens: number
  stream: boolean
  thinking: unknown
  output_config: unknown
  fallbacks?: unknown
  betas?: unknown
  tools?: unknown
  system: { type: string; text: string; cache_control?: unknown }[]
  messages: { role: string; content: { type: string; text: string; cache_control?: unknown }[] }[]
}

const scenario = (name: string): Scenario => SCENARIOS.find((s) => s.name === name)!

async function replay(name: string): Promise<{ outcomes: Outcome[]; requests: CassetteRequest[] }> {
  const s = scenario(name)
  const tape = useCassette(cassettePath(name), { mode: 'replay' })
  const provider = new AnthropicProvider({ apiKey: 'sk-ant-replay-key', fetch: tape.fetch, ...s.provider })
  const outcomes = await s.drive(provider, fixtureTranscripts())
  tape.assertExhausted()
  return { outcomes, requests: tape.requests }
}

const body = (r: CassetteRequest) => r.body as Body

/** Everything up to and including the last cache_control block, as the API would hash it. */
function cachedPrefix(b: Body): string {
  const content = b.messages[0]!.content
  const last = content.findLastIndex((c) => c.cache_control)
  return JSON.stringify([b.system, content.slice(0, last + 1)])
}

describe('cassettes are what the code produces (no drift)', () => {
  for (const s of SCENARIOS) {
    it(`${s.name}: committed cassette equals a fresh build`, async () => {
      const committed = JSON.parse(readFileSync(cassettePath(s.name), 'utf8'))
      expect(await buildCassette(s)).toEqual(committed)
    })
  }

  it('never stores credentials', () => {
    for (const s of SCENARIOS) {
      const raw = readFileSync(cassettePath(s.name), 'utf8')
      expect(raw).not.toMatch(/sk-ant-|x-api-key|authorization/i)
    }
  })

  it('hand-authored streams follow the documented event order', () => {
    const c = JSON.parse(readFileSync(cassettePath('cited-answer'), 'utf8'))
    const types = parseSse(c.interactions[0].response.body).map((e) => e.type)
    expect(types[0]).toBe('message_start')
    expect(types.slice(-2)).toEqual(['message_delta', 'message_stop'])
    expect(types).toContain('content_block_start')
    expect(types).toContain('content_block_delta')
    expect(types).toContain('content_block_stop')
  })
})

describe('the request contract (what the SDK actually sent)', () => {
  it('model, adaptive thinking, effort, streaming, fallbacks and the beta header', async () => {
    const { requests } = await replay('cited-answer')
    expect(requests).toHaveLength(1)
    const r = requests[0]!
    expect(r.method).toBe('POST')
    expect(r.url).toBe('https://api.anthropic.com/v1/messages?beta=true')
    expect(r.headers['anthropic-beta']).toBe(SERVER_SIDE_FALLBACK_BETA)
    expect(r.headers['anthropic-version']).toBe('2023-06-01')
    expect(r.headers['x-api-key']).toBeUndefined() // the key was sent, but never recorded
    const b = body(r)
    expect(b.model).toBe('claude-opus-5')
    expect(b.stream).toBe(true)
    expect(b.max_tokens).toBe(64000)
    expect(b.thinking).toEqual({ type: 'adaptive' })
    expect(b.output_config).toEqual({ effort: 'low' })
    expect(b.fallbacks).toBe('default')
    expect(b.betas).toBeUndefined() // betas travel as the header, not in the body
    expect(b.tools).toBeUndefined()
    expect(Object.keys(b)).not.toContain('temperature')
  })

  it('frozen system, one breakpoint on the last stable chunk, question strictly after it', async () => {
    const { requests } = await replay('cited-answer')
    const b = body(requests[0]!)
    expect(b.system).toEqual([{ type: 'text', text: SYSTEM_PROMPT }])
    expect(b.messages).toHaveLength(1)
    expect(b.messages[0]!.role).toBe('user')
    const content = b.messages[0]!.content
    const marked = content.flatMap((c, i) => (c.cache_control ? [i] : []))
    expect(marked).toEqual([content.length - 2])
    expect(content[marked[0]!]!.cache_control).toEqual({ type: 'ephemeral' })
    expect(content[marked[0]!]!.text).toMatch(/^<transcript_chunk /)
    const question = content.at(-1)!
    expect(question.text).toContain(QUESTIONS.retry)
    expect(question.cache_control).toBeUndefined()
    // the question appears nowhere before the breakpoint
    expect(cachedPrefix(b)).not.toContain(QUESTIONS.retry)
  })

  it('carries no volatile bytes in the cached prefix', async () => {
    const { requests } = await replay('cited-answer')
    const prefix = cachedPrefix(body(requests[0]!))
    const isoTimestamps = prefix.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g) ?? []
    expect(isoTimestamps).toEqual(['2026-09-21T09:00:00.000Z']) // the recording's own start, nothing else
    expect(prefix).not.toMatch(/req_|qa_|msg_|[0-9a-f]{8}-[0-9a-f]{4}-/) // no request/message ids or uuids
  })

  it('keeps the injection line inside a transcript chunk of the user turn, framed as data', async () => {
    const { requests } = await replay('cited-answer')
    const b = body(requests[0]!)
    expect(b.system[0]!.text).not.toContain(INJECTION_LINE)
    expect(b.system[0]!.text).toMatch(/never instructions to you/)
    const holders = b.messages[0]!.content.filter((c) => c.text.includes(INJECTION_LINE))
    expect(holders).toHaveLength(1)
    expect(holders[0]!.text).toMatch(/^<transcript_chunk /)
  })

  it('a second question re-sends the byte-identical cached prefix', async () => {
    const { requests } = await replay('second-question')
    expect(requests).toHaveLength(2)
    const [a, b] = requests.map(body)
    expect(cachedPrefix(b!)).toBe(cachedPrefix(a!))
    expect(a!.messages[0]!.content.at(-1)!.text).toContain(QUESTIONS.retry)
    expect(b!.messages[0]!.content.at(-1)!.text).toContain(QUESTIONS.migration)
    // the same params on both: nothing that changes per request sits in front of the messages
    const { messages: _ma, ...restA } = a!
    const { messages: _mb, ...restB } = b!
    expect(restB).toEqual(restA)
  })

  it('retries a 429 with exactly the same request', async () => {
    const { requests } = await replay('rate-limited-then-ok')
    expect(requests).toHaveLength(2)
    expect(requests[1]!.body).toEqual(requests[0]!.body)
  })

  it('drops the fallback params for a model the skill does not document them for', () => {
    const p = new AnthropicProvider({ apiKey: 'x', model: 'claude-sonnet-5' })
    const params = p.buildParams({ system: 's', blocks: [], aliases: new Map(), stats: {} as never }, 'high')
    expect(params.fallbacks).toBeUndefined()
    expect(params.betas).toBeUndefined()
    expect(params.output_config).toEqual({ effort: 'high' })
    expect(p.minCacheTokens).toBe(1024)
  })
})

describe('replayed answers through the real SDK', () => {
  it('cited answer: streamed deltas, rewritten markers, citations to the right segments, usage', async () => {
    const { outcomes } = await replay('cited-answer')
    const { done, deltas, error } = outcomes[0]!
    expect(error).toBeUndefined()
    expect(deltas.length).toBeGreaterThan(1)
    expect(deltas.join('')).toBe(done!.text)
    expect(done!.text).toBe(
      'The retry budget is three attempts, then dead-letter [1]; anything that fails the third attempt goes to the dead-letter queue [2].',
    )
    expect(done!.citations.map((c) => c.segmentId)).toEqual(['seg_retry_budget', 'seg_retry_confirm'])
    expect(done!.hallucinated).toEqual([])
    expect(done!.stopReason).toBe('end_turn')
    expect(done!.model).toBe('claude-opus-5')
    expect(done!.usage).toEqual({
      inputTokens: 38,
      outputTokens: 61,
      cacheReadTokens: 0,
      cacheWriteTokens: 1372,
    })
    expect(done!.fallback).toBeNull()
    expect(done!.refusal).toBeNull()
  })

  it('second question reads the cache and costs less; hallucinated aliases are dropped and reported', async () => {
    const { outcomes } = await replay('second-question')
    const [first, second] = outcomes.map((o) => o.done!)
    expect(first!.usage.cacheWriteTokens).toBeGreaterThan(0)
    expect(second!.usage.cacheReadTokens).toBeGreaterThan(0)
    expect(second!.usage.cacheWriteTokens).toBe(0)
    expect(estimateCostUsd(second!.usage, 'claude-opus-5')!).toBeLessThan(
      estimateCostUsd(first!.usage, 'claude-opus-5')!,
    )
    expect(second!.text).toBe('The migration lands this Thursday [1][2], with the rollback plan ready.')
    expect(second!.citations.map((c) => c.segmentId)).toEqual(['seg_migration_day', 'seg_migration_confirm'])
    expect(second!.hallucinated).toEqual(['s99'])
  })

  it('refusal: checked via stop_reason, partial text discarded, category surfaced', async () => {
    const { outcomes } = await replay('refusal')
    const { done, deltas, error } = outcomes[0]!
    expect(error).toBeUndefined()
    expect(deltas.join('')).toBe('The retry budget ')
    expect(done!.stopReason).toBe('refusal')
    expect(done!.text).toBe('')
    expect(done!.citations).toEqual([])
    expect(done!.refusal).toEqual({
      category: 'cyber',
      explanation: 'This request was declined by a safety classifier.',
    })
  })

  it('server-side fallback: answer served by the fallback model and reported as such', async () => {
    const { outcomes } = await replay('fallback-served')
    const { done } = outcomes[0]!
    expect(done!.stopReason).toBe('end_turn')
    expect(done!.model).toBe('claude-opus-4-8')
    expect(done!.fallback).toEqual({ from: 'claude-opus-5', to: 'claude-opus-4-8' })
    expect(done!.citations).toHaveLength(2)
  })

  it('mid-stream network failure: deltas already delivered, then a retryable network error', async () => {
    const { outcomes } = await replay('stream-cut')
    const { done, deltas, error } = outcomes[0]!
    expect(done).toBeUndefined()
    expect(deltas.join('')).toBe('The retry budget is three attempts,')
    expect(error!.code).toBe('network')
    expect(error!.retryable).toBe(true)
  })

  it('429 then success: the SDK retry is transparent', async () => {
    const { outcomes } = await replay('rate-limited-then-ok')
    expect(outcomes[0]!.error).toBeUndefined()
    expect(outcomes[0]!.done!.citations).toHaveLength(2)
  })

  it('429 with retries exhausted: rate_limited, retryable, with the server hint', async () => {
    const { outcomes } = await replay('rate-limited')
    const e = outcomes[0]!.error!
    expect(e.code).toBe('rate_limited')
    expect(e.status).toBe(429)
    expect(e.retryable).toBe(true)
    expect(e.retryAfterMs).toBe(20_000)
  })

  it('529: overloaded, retryable', async () => {
    const { outcomes } = await replay('overloaded')
    const e = outcomes[0]!.error!
    expect(e.code).toBe('overloaded')
    expect(e.status).toBe(529)
    expect(e.retryable).toBe(true)
  })

  it('overloaded_error frame inside a 200 stream: overloaded, after the partial deltas', async () => {
    const { outcomes } = await replay('overloaded-midstream')
    const { deltas, error } = outcomes[0]!
    expect(deltas.join('')).toBe('The retry budget is')
    expect(error!.code).toBe('overloaded')
  })
})

describe('abort', () => {
  it('aborting mid-stream surfaces as code aborted', async () => {
    const tape = useCassette(cassettePath('cited-answer'), { mode: 'replay' })
    const provider = new AnthropicProvider({ apiKey: 'k', fetch: tape.fetch, maxRetries: 0 })
    const ctl = new AbortController()
    const { ask } = await import('../src/ask.ts')
    const seen: string[] = []
    const run = (async () => {
      for await (const ev of ask({
        provider,
        transcripts: fixtureTranscripts(),
        question: 'q',
        signal: ctl.signal,
      })) {
        if (ev.type === 'delta') {
          seen.push(ev.text)
          ctl.abort()
        }
      }
    })()
    await expect(run).rejects.toMatchObject({ code: 'aborted' })
    expect(seen).toHaveLength(1)
  })
})
