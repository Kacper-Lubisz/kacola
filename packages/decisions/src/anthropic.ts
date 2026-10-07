// Typed decisions on Claude: one strict tool whose input schema is the batch schema (llm-json.ts); the
// model answers by calling it. Non-streaming `messages.create` (small outputs), through the official SDK
// so errors map with @kacola/llm's toLlmError.
//
//   client.beta.messages.create({
//     model: 'claude-opus-5', max_tokens: 16000, output_config: { effort: 'low' },
//     system: DECISION_SYSTEM_PROMPT (+ "answer by calling record_decisions"),
//     tools: [{ name: 'record_decisions', input_schema: batchSchema(questions), strict: true }],
//     tool_choice: { type: 'auto' },
//     betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',       ← models that support it
//     messages: [{ role: 'user', content: userPrompt(state, questions) }],
//   })
//
// `tool_choice: auto` (not forced): forcing a tool is rejected by newer models and conflicts with
// thinking; the system prompt names the tool, `strict: true` keeps the input schema-valid, and a turn
// without the tool call is an invalid response (retried like a server error). Probabilities are
// self-reported (the API exposes no logprobs) and marked so.
import Anthropic from '@anthropic-ai/sdk'
import {
  DEFAULT_ANTHROPIC_MODEL,
  estimateCostUsd,
  LlmError,
  SERVER_SIDE_FALLBACK_BETA,
  toLlmError,
} from '@kacola/llm'
import type { Usage } from '@kacola/protocol'
import { invalidResponse } from './answers.ts'
import { BaseDecisionProvider, type BaseOptions, type CallResult } from './base.ts'
import { batchSchema, DECISION_SYSTEM_PROMPT, parseBatch, userPrompt } from './llm-json.ts'
import type { DecisionState, Question } from './types.ts'

export const DECISION_TOOL = 'record_decisions'
export const DEFAULT_ANTHROPIC_DECISION_MODEL = DEFAULT_ANTHROPIC_MODEL
const FALLBACK_MODELS: ReadonlySet<string> = new Set(['claude-opus-5', 'claude-fable-5-1'])
/** `output_config.effort` is rejected by these older models. */
const NO_EFFORT = /haiku-4-5|sonnet-4-5|opus-4-5|-3-/

export type AnthropicDecisionOptions = BaseOptions & {
  /** Omit to let the SDK resolve credentials (ANTHROPIC_API_KEY, auth token, `ant` profile). */
  apiKey?: string
  model?: string
  baseURL?: string
  fetch?: typeof fetch
  maxQuestionsPerCall?: number
  maxTokens?: number
}

export class AnthropicDecisionProvider extends BaseDecisionProvider {
  readonly id = 'anthropic' as const
  readonly model: string
  readonly confidence = 'self-reported' as const
  readonly maxQuestionsPerCall: number
  readonly #client: Anthropic
  readonly #maxTokens: number

  constructor(opts: AnthropicDecisionOptions = {}) {
    // thinking at low effort still takes a few seconds on a big batch
    super(opts, 30_000)
    this.model = opts.model || DEFAULT_ANTHROPIC_DECISION_MODEL
    this.maxQuestionsPerCall = opts.maxQuestionsPerCall ?? 24
    this.#maxTokens = opts.maxTokens ?? 16_000
    this.#client = new Anthropic({
      ...(opts.apiKey !== undefined ? { apiKey: opts.apiKey } : {}),
      ...(opts.baseURL !== undefined ? { baseURL: opts.baseURL } : {}),
      ...(opts.fetch !== undefined ? { fetch: opts.fetch } : {}),
      maxRetries: 0,
      timeout: this.timeoutMs + 1_000,
    })
  }

  /** The exact request params for a batch (exported for tests and docs). */
  buildParams(state: DecisionState, questions: readonly Question[]) {
    const params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: this.#maxTokens,
      system: [
        {
          type: 'text',
          text: `${DECISION_SYSTEM_PROMPT}\n\nAnswer by calling the ${DECISION_TOOL} tool exactly once, with every question answered.`,
        },
      ],
      tools: [
        {
          name: DECISION_TOOL,
          description: 'Record the answer to every question, with probabilities.',
          input_schema: batchSchema(questions) as Anthropic.Beta.Messages.BetaTool.InputSchema,
          strict: true,
        },
      ],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: userPrompt(state, questions) }],
    }
    if (!NO_EFFORT.test(this.model)) params.output_config = { effort: 'low' }
    if (FALLBACK_MODELS.has(this.model)) {
      params.betas = [SERVER_SIDE_FALLBACK_BETA]
      params.fallbacks = 'default'
    }
    return params
  }

  protected async call(
    state: DecisionState,
    questions: Question[],
    signal: AbortSignal,
  ): Promise<CallResult> {
    let msg: Anthropic.Beta.Messages.BetaMessage
    try {
      msg = await this.#client.beta.messages.create(this.buildParams(state, questions), { signal })
    } catch (err) {
      throw toLlmError(err)
    }
    if (msg.stop_reason === 'refusal')
      throw new LlmError(
        'bad_request',
        `Claude declined: ${msg.stop_details?.explanation ?? msg.stop_details?.category ?? ''}`,
      )
    const call = msg.content.find(
      (b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === 'tool_use' && b.name === DECISION_TOOL,
    )
    if (!call) throw invalidResponse('anthropic', `no ${DECISION_TOOL} call (stop_reason ${msg.stop_reason})`)
    return {
      answers: parseBatch('anthropic', questions, call.input, 'self-reported'),
      usage: {
        inputTokens: msg.usage.input_tokens ?? 0,
        outputTokens: msg.usage.output_tokens ?? 0,
        cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: msg.usage.cache_creation_input_tokens ?? 0,
      },
      model: msg.model,
    }
  }

  protected price(usage: Usage, model: string): number | null {
    return estimateCostUsd(usage, model)
  }
}
