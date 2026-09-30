// The four hosted decision providers against local fakes of their APIs (@gnomeola/testkit/fake-decisions).
// Shapes reproduced from the providers' documentation:
//   TypeSafe  docs.typesafe.ai/api.md (endpoint, request body, Choice/Score/Noul answers, usage, errors 401/422/429/529),
//             docs.typesafe.ai/primitives/{choice,score,noul}.md, docs.typesafe.ai/confidence.md,
//             docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook.md (extraction as a Choice + "none"),
//             docs.typesafe.ai/models.md (jev-1.13.0, $0.042/Mtok input), docs.typesafe.ai/sdk/javascript (client).
//   OpenAI    Responses API non-streaming (`text.format` json_schema strict, `include: message.output_text.logprobs`,
//             `top_logprobs`), error bodies as @gnomeola/llm's openai.int.test.ts recorded them.
//   Anthropic Messages API tool_use blocks; Ollama /api/chat with `format`.
import { LlmError } from '@gnomeola/llm'
import {
  type Brain,
  type FakeServer,
  startFakeAnthropicDecisions,
  startFakeOllama,
  startFakeOpenAI,
  startFakeTypeSafe,
} from '@gnomeola/testkit/fake-decisions'
import { afterEach, describe, expect, it } from 'vitest'
import { AnthropicDecisionProvider } from '../src/anthropic.ts'
import { JEV_PRICE_PER_MTOK, JevDecisionProvider } from '../src/jev.ts'
import { OllamaDecisionProvider } from '../src/ollama.ts'
import { OpenAIDecisionProvider } from '../src/openai.ts'
import { decisionProviderFromSettings } from '../src/settings.ts'
import type { ChoiceAnswer, Question, ScoreAnswer, YesNoAnswer } from '../src/types.ts'

const servers: FakeServer[] = []
afterEach(async () => {
  for (const s of servers.splice(0)) await s.close()
})
async function fake(p: Promise<FakeServer>) {
  const s = await p
  servers.push(s)
  return s
}

/** Deterministic answers: first option 0.7, yes 0.8, top level 0.6, first candidate. */
const brain: Brain = ({ questions }) =>
  Object.fromEntries(
    questions.map((q) => {
      if (q.kind === 'extract') return [q.id, { value: q.options[0] ?? 'Thursday', p: 0.9 }]
      if (q.kind === 'yesno') return [q.id, { probabilities: { yes: 0.8, no: 0.2 } }]
      if (q.kind === 'score')
        return [
          q.id,
          {
            probabilities: Object.fromEntries(
              q.options.map((o, i) => [o, i === q.options.length - 1 ? 0.6 : 0.4 / (q.options.length - 1)]),
            ),
          },
        ]
      return [
        q.id,
        {
          probabilities: Object.fromEntries(
            q.options.map((o, i) => [o, i === 0 ? 0.7 : 0.3 / (q.options.length - 1)]),
          ),
        },
      ]
    }),
  )

const STATE = { segment: { speaker: 'Ana', text: 'The migration lands Thursday, after the freeze.' } }
const QUESTIONS: Question[] = [
  {
    id: 'status',
    kind: 'choice',
    instructions: 'Has the item been settled?',
    options: { covered: 'Agreed or answered', in_progress: 'Discussed, not settled', not_started: null },
    tag: 'agenda.status',
  },
  {
    id: 'urgency',
    kind: 'score',
    instructions: 'How urgent is it?',
    levels: ['Not urgent', 'Soon', 'Blocking'],
  },
  {
    id: 'relevant',
    kind: 'yesno',
    instructions: 'Is this about the migration?',
    yes: 'It is about the migration',
  },
  {
    id: 'when',
    kind: 'extract',
    instructions: 'When does the migration land?',
    candidates: ['Thursday', 'Friday'],
  },
]
const fast = { retryDelayMs: () => 5 }

describe('jev (TypeSafe) provider', () => {
  it('sends the documented /v1/systemone request: bearer key, state, model, typed questions by id', async () => {
    const s = await fake(startFakeTypeSafe(brain))
    const p = new JevDecisionProvider({ apiKey: 'ts-key', baseURL: s.url, ...fast })
    await p.decide({ state: STATE, questions: QUESTIONS })
    expect(s.seen).toHaveLength(1)
    expect(s.seen[0]!.path).toBe('/v1/systemone')
    expect(s.seen[0]!.headers.authorization).toBe('Bearer ts-key')
    expect(s.seen[0]!.body).toEqual({
      state: STATE,
      model: 'jev-latest',
      questions: {
        status: {
          type: 'choice',
          instructions: 'Has the item been settled?',
          criteria: {
            covered: 'Agreed or answered',
            in_progress: 'Discussed, not settled',
            not_started: null,
          },
        },
        urgency: {
          type: 'score',
          instructions: 'How urgent is it?',
          criteria: ['Not urgent', 'Soon', 'Blocking'],
        },
        relevant: {
          type: 'noul',
          instructions: 'Is this about the migration?',
          criteria: { true: 'It is about the migration' },
        },
        // extraction = a Choice over the candidate spans plus the "none" escape hatch (pre-parsed cookbook)
        when: {
          type: 'choice',
          instructions: 'When does the migration land?',
          criteria: { Thursday: null, Friday: null, none: 'None of these is the requested value.' },
        },
      },
    })
  })

  it('maps Choice/Score/Noul answers to typed, calibrated answers and prices input tokens only', async () => {
    const s = await fake(startFakeTypeSafe(brain))
    const p = new JevDecisionProvider({ apiKey: 'k', baseURL: s.url })
    const r = await p.decide({ state: STATE, questions: QUESTIONS })
    const status = r.answers.status as ChoiceAnswer
    expect(status).toMatchObject({ kind: 'choice', choice: 'covered', source: 'calibrated' })
    expect(status.probabilities.covered).toBeCloseTo(0.7, 6)
    expect(status.confidence).toBe(0.55) // the API's own confidence, as returned: (3·0.7 − 1)/2
    const urgency = r.answers.urgency as ScoreAnswer
    expect(urgency.level).toBeCloseTo(0.2 * 0 + 0.2 * 1 + 0.6 * 2, 6)
    expect(urgency.score).toBeCloseTo(0.7, 6)
    expect(r.answers.relevant).toEqual({
      kind: 'yesno',
      p: 0.8,
      confidence: expect.closeTo(0.6, 6),
      source: 'calibrated',
    })
    expect(r.answers.when).toEqual({
      kind: 'extract',
      value: 'Thursday',
      confidence: expect.closeTo(0.7, 6),
      source: 'calibrated',
    })
    expect(r.model).toBe('jev-1.13.0')
    expect(r.usage.outputTokens).toBe(40)
    expect(r.costUsd).toBeCloseTo((r.usage.inputTokens * JEV_PRICE_PER_MTOK) / 1e6, 12)
  })

  it('returns null when Jev picks "none", and derives candidates from the state when none are given', async () => {
    const s = await fake(
      startFakeTypeSafe(({ questions }) => ({
        [questions[0]!.id]: {
          probabilities: {
            none: 0.9,
            ...Object.fromEntries(
              questions[0]!.options
                .filter((o) => o !== 'none')
                .map((o) => [o, 0.1 / (questions[0]!.options.length - 1)]),
            ),
          },
        },
      })),
    )
    const p = new JevDecisionProvider({ apiKey: 'k', baseURL: s.url })
    const r = await p.decide({
      state: 'We have not discussed pay yet. Next step is a call.',
      questions: [{ id: 'pay', kind: 'extract', instructions: 'What salary was offered?' }],
    })
    expect(r.answers.pay).toMatchObject({ value: null, confidence: 0.9 })
    const sent = (s.seen[0]!.body.questions as Record<string, { criteria: Record<string, unknown> }>).pay!
      .criteria
    expect(Object.keys(sent)).toEqual(['We have not discussed pay yet.', 'Next step is a call.', 'none'])
  })

  it('batches large requests (64 questions per call) and merges the answers', async () => {
    const s = await fake(startFakeTypeSafe(brain))
    const p = new JevDecisionProvider({ apiKey: 'k', baseURL: s.url })
    const qs: Question[] = Array.from({ length: 70 }, (_, i) => ({
      id: `q${i}`,
      kind: 'yesno',
      instructions: `Is ${i} even?`,
    }))
    const r = await p.decide({ state: 'numbers', questions: qs })
    expect(s.seen.map((x) => Object.keys(x.body.questions as object).length).sort()).toEqual([6, 64])
    expect(Object.keys(r.answers)).toHaveLength(70)
    expect(r.calls).toBe(2)
  })

  it('maps the documented errors: 401 auth, 422 bad_request (no retry); 429 honours retry-after; 529 retried', async () => {
    const s = await fake(startFakeTypeSafe(brain))
    const p = new JevDecisionProvider({ apiKey: 'k', baseURL: s.url, ...fast })
    const q = [QUESTIONS[2]!]
    s.fail({ status: 401, body: { detail: 'Invalid API key' } })
    await expect(p.decide({ state: 'x', questions: q })).rejects.toMatchObject({ code: 'auth', status: 401 })
    s.fail({ status: 422, body: { detail: [{ loc: ['body', 'state'], msg: 'field required' }] } })
    await expect(p.decide({ state: 'x', questions: q })).rejects.toMatchObject({
      code: 'bad_request',
      status: 422,
    })
    expect(s.seen).toHaveLength(2)

    s.fail({ status: 429, body: { detail: 'rate limited' }, headers: { 'retry-after-ms': '60' } })
    s.fail({ status: 529, body: { detail: 'overloaded' } })
    const t0 = performance.now()
    const r = await p.decide({ state: 'x', questions: q })
    expect(performance.now() - t0).toBeGreaterThanOrEqual(55)
    expect(r).toMatchObject({ calls: 3, retries: 2 })

    s.fail(...Array.from({ length: 3 }, () => ({ status: 500, body: { detail: 'boom' } })))
    await expect(p.decide({ state: 'x', questions: q })).rejects.toMatchObject({
      code: 'server',
      retryable: true,
    })
    s.fail({ status: 402, body: { detail: 'payment required' } })
    await expect(p.decide({ state: 'x', questions: q })).rejects.toMatchObject({ code: 'quota' })
  })

  it('times out per attempt and cancels on the caller’s signal', async () => {
    const s = await fake(startFakeTypeSafe(brain))
    s.setDelay(300)
    const p = new JevDecisionProvider({ apiKey: 'k', baseURL: s.url, maxRetries: 0, timeoutMs: 40 })
    await expect(p.decide({ state: 'x', questions: [QUESTIONS[2]!] })).rejects.toMatchObject({
      code: 'timeout',
    })
    const ac = new AbortController()
    setTimeout(() => ac.abort(), 20)
    const p2 = new JevDecisionProvider({ apiKey: 'k', baseURL: s.url, timeoutMs: 5_000 })
    const t0 = performance.now()
    await expect(
      p2.decide({ state: 'x', questions: [QUESTIONS[2]!] }, { signal: ac.signal }),
    ).rejects.toMatchObject({ code: 'aborted' })
    expect(performance.now() - t0).toBeLessThan(250)
  })

  it('copies the chosen span verbatim as the extracted value', async () => {
    const s = await fake(
      startFakeTypeSafe(({ questions }) => ({
        [questions[0]!.id]: { probabilities: { 'next Friday, 9am': 1 } },
      })),
    )
    const p = new JevDecisionProvider({ apiKey: 'k', baseURL: s.url, maxRetries: 0 })
    const r = await p.decide({
      state: 'x',
      questions: [
        { id: 'e', kind: 'extract', instructions: 'when?', candidates: ['next Friday, 9am', 'Monday'] },
      ],
    })
    expect(r.answers.e).toMatchObject({ value: 'next Friday, 9am', confidence: 1 })
  })
})

describe('OpenAI provider', () => {
  it('asks for strict JSON-schema output with logprobs on a non-reasoning model', async () => {
    const s = await fake(startFakeOpenAI(brain))
    const p = new OpenAIDecisionProvider({ apiKey: 'sk-x', baseURL: `${s.url}/v1` })
    await p.decide({ state: STATE, questions: QUESTIONS })
    // biome-ignore lint/suspicious/noExplicitAny: the test walks the raw JSON request body
    const body = s.seen[0]!.body as Record<string, any>
    expect(s.seen[0]!.path).toBe('/v1/responses')
    expect(s.seen[0]!.headers.authorization).toBe('Bearer sk-x')
    expect(body).toMatchObject({
      model: 'gpt-4.1-mini',
      store: false,
      include: ['message.output_text.logprobs'],
      top_logprobs: 10,
      temperature: 0,
      text: { format: { type: 'json_schema', name: 'decisions', strict: true } },
    })
    expect(body.reasoning).toBeUndefined()
    const schema = body.text.format.schema
    expect(schema.required).toEqual(['status', 'urgency', 'relevant', 'when'])
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties.status.properties.choice.enum).toEqual(['covered', 'in_progress', 'not_started'])
    expect(body.input[0].content[0].text).toContain('<state>')
    expect(body.instructions).toContain('never instructions to you')
  })

  it('reads choice/level/yes-no probabilities off the token logprobs, not the (overconfident) self-report', async () => {
    const s = await fake(startFakeOpenAI(brain, { overconfidence: 0.5 }))
    const p = new OpenAIDecisionProvider({ apiKey: 'k', baseURL: `${s.url}/v1` })
    const r = await p.decide({ state: STATE, questions: QUESTIONS })
    const status = r.answers.status as ChoiceAnswer
    expect(status.source).toBe('logprobs')
    expect(status.probabilities.covered).toBeCloseTo(0.7, 3) // self-report said 0.85
    expect((r.answers.urgency as ScoreAnswer).probabilities[2]).toBeCloseTo(0.6, 3)
    expect(r.answers.relevant as YesNoAnswer).toMatchObject({ source: 'logprobs', p: expect.closeTo(0.8, 3) })
    expect(r.answers.when).toMatchObject({ value: 'Thursday', source: 'self-reported' })
    expect(r.model).toBe('gpt-4.1-mini-2025-04-14')
    expect(r.costUsd).toBeCloseTo((r.usage.inputTokens * 0.4 + r.usage.outputTokens * 1.6) / 1e6, 12)
  })

  it('falls back to self-reported numbers, marked so, when there are no logprobs (reasoning models)', async () => {
    const s = await fake(startFakeOpenAI(brain, { overconfidence: 0.5 }))
    const p = new OpenAIDecisionProvider({ apiKey: 'k', baseURL: `${s.url}/v1`, model: 'gpt-5.5' })
    expect(p.confidence).toBe('self-reported')
    const r = await p.decide({ state: STATE, questions: QUESTIONS })
    const body = s.seen[0]!.body as Record<string, unknown>
    expect(body.reasoning).toEqual({ effort: 'low' })
    expect(body.include).toBeUndefined()
    const status = r.answers.status as ChoiceAnswer
    expect(status.source).toBe('self-reported')
    expect(status.probabilities.covered).toBeCloseTo(0.84, 2) // 0.85 reported, renormalised (the fake rounds)
    expect(r.costUsd).toBeNull() // no price on file for this model: unknown, not zero
  })

  it('maps errors: quota is not retried, rate limits are, a refusal is a bad_request', async () => {
    const s = await fake(startFakeOpenAI(brain))
    const p = new OpenAIDecisionProvider({ apiKey: 'k', baseURL: `${s.url}/v1`, ...fast })
    s.fail({
      status: 429,
      body: {
        error: {
          message: 'You exceeded your current quota',
          type: 'insufficient_quota',
          code: 'insufficient_quota',
        },
      },
    })
    await expect(p.decide({ state: 'x', questions: [QUESTIONS[2]!] })).rejects.toMatchObject({
      code: 'quota',
      retryable: false,
    })
    expect(s.seen).toHaveLength(1)
    s.fail({
      status: 429,
      body: { error: { message: 'Rate limit reached', type: 'requests', code: 'rate_limit_exceeded' } },
      headers: { 'retry-after-ms': '10' },
    })
    expect((await p.decide({ state: 'x', questions: [QUESTIONS[2]!] })).retries).toBe(1)
    s.fail({
      status: 401,
      body: {
        error: {
          message: 'Incorrect API key provided',
          type: 'invalid_request_error',
          code: 'invalid_api_key',
        },
      },
    })
    await expect(p.decide({ state: 'x', questions: [QUESTIONS[2]!] })).rejects.toMatchObject({ code: 'auth' })
    s.fail({
      status: 200,
      body: {
        model: 'gpt-4.1-mini',
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: "I can't help with that." }] }],
        usage: {},
      },
    })
    await expect(p.decide({ state: 'x', questions: [QUESTIONS[2]!] })).rejects.toMatchObject({
      code: 'bad_request',
    })
  })

  it('treats schema-violating output as an invalid (retryable server) response', async () => {
    const s = await fake(startFakeOpenAI(brain))
    const p = new OpenAIDecisionProvider({ apiKey: 'k', baseURL: `${s.url}/v1`, maxRetries: 0 })
    s.fail({
      status: 200,
      body: {
        model: 'gpt-4.1-mini',
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: '{"relevant":{"answer":"maybe","probabilities":{"yes":0.5,"no":0.5}}}',
              },
            ],
          },
        ],
        usage: {},
      },
    })
    await expect(p.decide({ state: 'x', questions: [QUESTIONS[2]!] })).rejects.toMatchObject({
      code: 'server',
      retryable: true,
    })
  })
})

describe('Anthropic provider', () => {
  it('answers through one strict tool with auto tool choice, low effort and server-side fallbacks', async () => {
    const s = await fake(startFakeAnthropicDecisions(brain))
    const p = new AnthropicDecisionProvider({ apiKey: 'sk-ant-x', baseURL: s.url })
    const r = await p.decide({ state: STATE, questions: QUESTIONS })
    // biome-ignore lint/suspicious/noExplicitAny: the test walks the raw JSON request body
    const body = s.seen[0]!.body as Record<string, any>
    expect(s.seen[0]!.path).toBe('/v1/messages?beta=true')
    expect(s.seen[0]!.headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01')
    expect(body).toMatchObject({
      model: 'claude-opus-5',
      tool_choice: { type: 'auto' },
      output_config: { effort: 'low' },
      fallbacks: 'default',
    })
    expect(body.tools[0]).toMatchObject({ name: 'record_decisions', strict: true })
    expect(body.tools[0].input_schema.required).toEqual(['status', 'urgency', 'relevant', 'when'])
    expect(body.system[0].text).toContain('record_decisions')
    expect(r.answers.status).toMatchObject({ choice: 'covered', source: 'self-reported' })
    expect((r.answers.status as ChoiceAnswer).probabilities.covered).toBeCloseTo(0.84, 2)
    expect(r.costUsd).toBeCloseTo((r.usage.inputTokens * 5 + r.usage.outputTokens * 25) / 1e6, 12)
  })

  it('a turn without the tool call is invalid (retried); SDK errors map like the Q&A provider', async () => {
    const s = await fake(startFakeAnthropicDecisions(brain))
    const p = new AnthropicDecisionProvider({ apiKey: 'k', baseURL: s.url, ...fast })
    s.fail({
      status: 200,
      body: {
        id: 'm',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5',
        content: [{ type: 'text', text: 'covered' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    })
    const r = await p.decide({ state: 'x', questions: [QUESTIONS[2]!] })
    expect(r.retries).toBe(1)
    s.fail({
      status: 401,
      body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
    })
    await expect(p.decide({ state: 'x', questions: [QUESTIONS[2]!] })).rejects.toMatchObject({ code: 'auth' })
    s.fail(
      ...Array.from({ length: 3 }, () => ({
        status: 529,
        body: { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
      })),
    )
    await expect(p.decide({ state: 'x', questions: [QUESTIONS[2]!] })).rejects.toMatchObject({
      code: 'overloaded',
    })
    s.fail({
      status: 200,
      body: {
        id: 'm',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5',
        content: [],
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber', explanation: 'no' },
        usage: { input_tokens: 1, output_tokens: 0 },
      },
    })
    await expect(p.decide({ state: 'x', questions: [QUESTIONS[2]!] })).rejects.toMatchObject({
      code: 'bad_request',
    })
  })
})

describe('Ollama provider', () => {
  it('constrains output with `format: <schema>` and maps answers (self-reported, no price)', async () => {
    const s = await fake(startFakeOllama(brain))
    const p = new OllamaDecisionProvider({ url: s.url, model: 'qwen3:4b' })
    const r = await p.decide({ state: STATE, questions: QUESTIONS })
    // biome-ignore lint/suspicious/noExplicitAny: the test walks the raw JSON request body
    const body = s.seen[0]!.body as Record<string, any>
    expect(s.seen[0]!.path).toBe('/api/chat')
    expect(body).toMatchObject({ model: 'qwen3:4b', stream: false, options: { temperature: 0 } })
    expect(body.format.required).toEqual(['status', 'urgency', 'relevant', 'when'])
    expect(r.answers.status).toMatchObject({ choice: 'covered', source: 'self-reported' })
    expect(r.answers.when).toMatchObject({ value: 'Thursday' })
    expect(r.costUsd).toBeNull()
    expect(r.usage.inputTokens).toBeGreaterThan(0)
  })

  it('maps a missing model to not_found and an unreachable server to network', async () => {
    const s = await fake(startFakeOllama(brain))
    const p = new OllamaDecisionProvider({ url: s.url, ...fast })
    s.fail({ status: 404, body: { error: 'model "llama3.1" not found, try pulling it first' } })
    await expect(p.decide({ state: 'x', questions: [QUESTIONS[2]!] })).rejects.toMatchObject({
      code: 'not_found',
    })
    const dead = new OllamaDecisionProvider({ url: 'http://127.0.0.1:9', maxRetries: 0 })
    await expect(dead.decide({ state: 'x', questions: [QUESTIONS[2]!] })).rejects.toMatchObject({
      code: 'network',
    })
  })
})

describe('providerFromSettings', () => {
  it('builds each provider; keyed providers without a key are null', () => {
    expect(decisionProviderFromSettings({ provider: 'jev', model: '' })).toBeNull()
    expect(decisionProviderFromSettings({ provider: 'openai', model: '' })).toBeNull()
    expect(decisionProviderFromSettings({ provider: 'jev', model: '' }, { apiKey: 'k' })?.model).toBe(
      'jev-latest',
    )
    expect(
      decisionProviderFromSettings({ provider: 'openai', model: 'gpt-4.1-nano' }, { apiKey: 'k' })?.model,
    ).toBe('gpt-4.1-nano')
    expect(decisionProviderFromSettings({ provider: 'anthropic', model: '' })?.model).toBe('claude-opus-5')
    expect(decisionProviderFromSettings({ provider: 'ollama', model: '' })?.id).toBe('ollama')
    expect(decisionProviderFromSettings({ provider: 'local', model: '' })?.model).toBe('hashing-512')
  })

  it('every error is an LlmError with a code callers can branch on', async () => {
    const p = new JevDecisionProvider({ apiKey: 'k', baseURL: 'http://127.0.0.1:9', maxRetries: 0 })
    const err = await p.decide({ state: 'x', questions: [QUESTIONS[2]!] }).catch((e) => e)
    expect(err).toBeInstanceOf(LlmError)
    expect(err.code).toBe('network')
  })
})
