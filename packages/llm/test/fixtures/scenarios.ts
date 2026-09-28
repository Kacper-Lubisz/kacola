// V-5a — the cassette scenarios.
//
// No API key exists where these were written, so the *responses* are hand-authored in the Messages API
// streaming wire format (message_start, ping, content_block_start/delta/stop with thinking + signature +
// text deltas, message_delta carrying stop_reason / stop_details / cumulative usage, message_stop) and
// error bodies in the documented `{"type":"error","error":{…}}` shape. The *requests* are not authored:
// make-cassettes.ts drives the real SDK through the real provider and records what it actually sent.
//
// Each scenario's `drive` is shared by the generator and the replay test, so both run the same calls.
import { type CassetteResponse, type SseEvent, sseBody } from '@gnomeola/testkit/cassettes'
import type { AnthropicProvider, AnthropicProviderOptions } from '../../src/anthropic.ts'
import { type AskDone, ask } from '../../src/ask.ts'
import { LlmError } from '../../src/errors.ts'
import type { TranscriptInput } from '../../src/types.ts'
import { platformSync } from './meeting.ts'

export const MODEL = 'claude-opus-5'
/** Tokens in the cached prefix (tools + system + transcript through the breakpoint) for the fixture meeting. */
const PREFIX_TOKENS = 1372

type Usage = {
  input_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  output_tokens: number
}

const SSE_HEADERS = { 'content-type': 'text/event-stream; charset=utf-8', 'request-id': 'req_handauthored' }
const JSON_HEADERS = { 'content-type': 'application/json', 'request-id': 'req_handauthored' }

function messageStart(id: string, usage: Usage, model = MODEL): SseEvent {
  return {
    type: 'message_start',
    message: {
      id,
      type: 'message',
      role: 'assistant',
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      stop_details: null,
      usage: { ...usage, output_tokens: 1, service_tier: 'standard' },
    },
  }
}

/** Opus 5 defaults thinking display to "omitted": the block streams with empty text and only a signature. */
function thinkingBlock(index: number): SseEvent[] {
  return [
    { type: 'content_block_start', index, content_block: { type: 'thinking', thinking: '', signature: '' } },
    {
      type: 'content_block_delta',
      index,
      delta: { type: 'signature_delta', signature: 'EqQBCkYIBxgCKkBhandauthoredsignature0000000000000000' },
    },
    { type: 'content_block_stop', index },
  ]
}

function textBlock(index: number, pieces: string[]): SseEvent[] {
  return [
    { type: 'content_block_start', index, content_block: { type: 'text', text: '', citations: null } },
    ...pieces.map((text) => ({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } })),
    { type: 'content_block_stop', index },
  ]
}

function messageEnd(
  stop: Record<string, unknown>,
  usage: Usage,
  extraUsage: Record<string, unknown> = {},
): SseEvent[] {
  return [
    {
      type: 'message_delta',
      delta: { stop_reason: null, stop_sequence: null, stop_details: null, ...stop },
      usage: { ...usage, ...extraUsage },
    },
    { type: 'message_stop' },
  ]
}

const ping: SseEvent = { type: 'ping' }

export function answerStream(id: string, pieces: string[], usage: Usage): CassetteResponse {
  return {
    status: 200,
    headers: SSE_HEADERS,
    body: sseBody([
      messageStart(id, usage),
      ping,
      ...thinkingBlock(0),
      ...textBlock(1, pieces),
      ...messageEnd({ stop_reason: 'end_turn' }, usage),
    ]),
  }
}

function errorResponse(status: number, type: string, message: string, headers: Record<string, string> = {}) {
  return {
    status,
    headers: { ...JSON_HEADERS, ...headers },
    body: JSON.stringify({ type: 'error', error: { type, message }, request_id: 'req_handauthored' }),
  }
}

const firstAsk: Usage = {
  input_tokens: 38,
  cache_creation_input_tokens: PREFIX_TOKENS,
  cache_read_input_tokens: 0,
  output_tokens: 61,
}
const secondAsk: Usage = {
  input_tokens: 41,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: PREFIX_TOKENS,
  output_tokens: 58,
}

export const RETRY_ANSWER = [
  'The retry budget is three attempts, ',
  'then dead-letter [s',
  '3]; anything that fails the third attempt goes to the dead-letter queue [s5].',
]
export const MIGRATION_ANSWER = [
  'The migration lands this Thursday [s10, s12], ',
  'with the rollback plan ready [s99].',
]

export type Outcome = { done?: AskDone; deltas: string[]; error?: LlmError }

export async function drain(
  stream: AsyncIterable<{ type: string; text?: string } & object>,
): Promise<Outcome> {
  const deltas: string[] = []
  try {
    let done: AskDone | undefined
    for await (const ev of stream) {
      if (ev.type === 'delta') deltas.push((ev as { text: string }).text)
      else done = ev as AskDone
    }
    return done ? { done, deltas } : { deltas }
  } catch (err) {
    if (err instanceof LlmError) return { deltas, error: err }
    throw err
  }
}

export type Scenario = {
  name: string
  note: string
  responses: CassetteResponse[]
  provider?: Omit<AnthropicProviderOptions, 'fetch' | 'apiKey'>
  /** Runs the calls; returns one outcome per ask. */
  drive(provider: AnthropicProvider, transcripts: TranscriptInput[]): Promise<Outcome[]>
}

const oneAsk =
  (question: string) =>
  async (provider: AnthropicProvider, transcripts: TranscriptInput[]): Promise<Outcome[]> => [
    await drain(ask({ provider, transcripts, question })),
  ]

export const QUESTIONS = { retry: 'What is the retry budget?', migration: 'When does the migration land?' }

export const SCENARIOS: Scenario[] = [
  {
    name: 'cited-answer',
    note: 'A normal streamed answer with inline citations; first ask on the meeting writes the cache.',
    responses: [answerStream('msg_01HandAuthoredCitedAnswer1', RETRY_ANSWER, firstAsk)],
    drive: oneAsk(QUESTIONS.retry),
  },
  {
    name: 'second-question',
    note: 'Two questions on the same transcript: the second reads the cached prefix (cache_read_input_tokens > 0). The second answer also cites an alias that does not exist.',
    responses: [
      answerStream('msg_01HandAuthoredSecondQ00001', RETRY_ANSWER, firstAsk),
      answerStream('msg_01HandAuthoredSecondQ00002', MIGRATION_ANSWER, secondAsk),
    ],
    drive: async (provider, transcripts) => [
      await drain(ask({ provider, transcripts, question: QUESTIONS.retry })),
      await drain(ask({ provider, transcripts, question: QUESTIONS.migration })),
    ],
  },
  {
    name: 'refusal',
    note: 'The whole fallback chain declined mid-stream: HTTP 200, partial text, stop_reason "refusal" with stop_details.',
    responses: [
      {
        status: 200,
        headers: SSE_HEADERS,
        body: sseBody([
          messageStart('msg_01HandAuthoredRefusal00001', { ...firstAsk, output_tokens: 1 }),
          ping,
          ...thinkingBlock(0),
          ...textBlock(1, ['The retry budget ']),
          ...messageEnd(
            {
              stop_reason: 'refusal',
              stop_details: {
                type: 'refusal',
                category: 'cyber',
                explanation: 'This request was declined by a safety classifier.',
                fallback_credit_token: null,
                fallback_has_prefill_claim: null,
                recommended_model: null,
              },
            },
            { ...firstAsk, output_tokens: 9 },
          ),
        ]),
      },
    ],
    drive: oneAsk(QUESTIONS.retry),
  },
  {
    name: 'fallback-served',
    note: 'claude-opus-5 declined before output and the server-side fallback (fallbacks: "default") served the answer on claude-opus-4-8.',
    responses: [
      {
        status: 200,
        headers: SSE_HEADERS,
        body: sseBody([
          messageStart(
            'msg_01HandAuthoredFallback0001',
            { ...firstAsk, output_tokens: 1 },
            'claude-opus-4-8',
          ),
          ping,
          {
            type: 'content_block_start',
            index: 0,
            content_block: {
              type: 'fallback',
              from: { model: MODEL },
              to: { model: 'claude-opus-4-8' },
              trigger: { type: 'refusal', category: 'cyber' },
            },
          },
          { type: 'content_block_stop', index: 0 },
          ...textBlock(1, RETRY_ANSWER),
          ...messageEnd({ stop_reason: 'end_turn' }, firstAsk, {
            iterations: [
              {
                type: 'message',
                model: MODEL,
                input_tokens: 38,
                cache_creation_input_tokens: PREFIX_TOKENS,
                cache_read_input_tokens: 0,
                output_tokens: 0,
                cache_creation: null,
              },
              {
                type: 'fallback_message',
                model: 'claude-opus-4-8',
                input_tokens: 38,
                cache_creation_input_tokens: PREFIX_TOKENS,
                cache_read_input_tokens: 0,
                output_tokens: 61,
                cache_creation: null,
              },
            ],
          }),
        ]),
      },
    ],
    drive: oneAsk(QUESTIONS.retry),
  },
  {
    name: 'stream-cut',
    note: 'The connection dies mid-stream, after some text has been delivered.',
    responses: [
      (() => {
        const r = answerStream('msg_01HandAuthoredStreamCut001', RETRY_ANSWER, firstAsk)
        // cut inside the second text delta
        const at = r.body.indexOf('then dead-letter') + 4
        return {
          ...r,
          streamError: { afterBytes: Buffer.byteLength(r.body.slice(0, at)), message: 'other side closed' },
        }
      })(),
    ],
    provider: { maxRetries: 0 },
    drive: oneAsk(QUESTIONS.retry),
  },
  {
    name: 'rate-limited-then-ok',
    note: 'HTTP 429 with retry-after-ms; the SDK retries by itself and the second attempt succeeds.',
    responses: [
      errorResponse(
        429,
        'rate_limit_error',
        'Number of request tokens has exceeded your per-minute rate limit',
        {
          'retry-after': '1',
          'retry-after-ms': '5',
        },
      ),
      answerStream('msg_01HandAuthoredAfter429001', RETRY_ANSWER, firstAsk),
    ],
    provider: { maxRetries: 1 },
    drive: oneAsk(QUESTIONS.retry),
  },
  {
    name: 'rate-limited',
    note: 'HTTP 429 with retries exhausted: surfaces as LlmError rate_limited with the server retry hint.',
    responses: [
      errorResponse(
        429,
        'rate_limit_error',
        'Number of request tokens has exceeded your per-minute rate limit',
        {
          'retry-after': '20',
        },
      ),
    ],
    provider: { maxRetries: 0 },
    drive: oneAsk(QUESTIONS.retry),
  },
  {
    name: 'overloaded',
    note: 'HTTP 529 overloaded_error with retries exhausted.',
    responses: [errorResponse(529, 'overloaded_error', 'Overloaded')],
    provider: { maxRetries: 0 },
    drive: oneAsk(QUESTIONS.retry),
  },
  {
    name: 'overloaded-midstream',
    note: 'An `event: error` overloaded_error frame inside a 200 stream, after some text.',
    responses: [
      {
        status: 200,
        headers: SSE_HEADERS,
        body:
          sseBody([
            messageStart('msg_01HandAuthoredOverload0001', firstAsk),
            ping,
            ...thinkingBlock(0),
            {
              type: 'content_block_start',
              index: 1,
              content_block: { type: 'text', text: '', citations: null },
            },
            {
              type: 'content_block_delta',
              index: 1,
              delta: { type: 'text_delta', text: 'The retry budget is' },
            },
          ]) +
          `event: error\ndata: ${JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } })}\n\n`,
      },
    ],
    provider: { maxRetries: 0 },
    drive: oneAsk(QUESTIONS.retry),
  },
]

export const fixtureTranscripts = (): TranscriptInput[] => [platformSync()]
