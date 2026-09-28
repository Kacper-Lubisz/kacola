// Q-8 — optional local provider over Ollama's HTTP API (`POST /api/chat`, NDJSON streaming).
//
// Same assembled prompt, flattened: system message + one user message with the blocks joined in order.
// Ollama keeps its own KV prefix cache per loaded model, so the byte-stable layout still helps; there are
// no explicit breakpoints and no cache token counts to report (cache fields are 0).
import { z } from 'zod'
import { isAbort, LlmError } from './errors.ts'
import type { AssembledPrompt, LlmProvider, ProviderEvent, ProviderStreamOptions } from './types.ts'

export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434'

const ChatChunk = z.object({
  model: z.string().optional(),
  message: z.object({ role: z.string(), content: z.string() }).partial().optional(),
  done: z.boolean().optional(),
  done_reason: z.string().optional(),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
  error: z.string().optional(),
})

export type OllamaProviderOptions = {
  model: string
  url?: string
  fetch?: typeof fetch
}

const STOP_REASON: Record<string, string> = { stop: 'end_turn', length: 'max_tokens' }

export class OllamaProvider implements LlmProvider {
  readonly id = 'ollama'
  readonly model: string
  readonly minCacheTokens = Number.POSITIVE_INFINITY
  readonly #url: string
  readonly #fetch: typeof fetch

  constructor(opts: OllamaProviderOptions) {
    this.model = opts.model
    this.#url = (opts.url ?? DEFAULT_OLLAMA_URL).replace(/\/+$/, '')
    this.#fetch = opts.fetch ?? globalThis.fetch
  }

  buildBody(prompt: AssembledPrompt) {
    return {
      model: this.model,
      stream: true,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.blocks.map((b) => b.text).join('\n\n') },
      ],
    }
  }

  // `effort` has no portable Ollama equivalent (`think` is model-specific and 400s on models without it).
  async *stream(prompt: AssembledPrompt, opts: ProviderStreamOptions): AsyncGenerator<ProviderEvent> {
    let res: Response
    try {
      res = await this.#fetch(`${this.#url}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.buildBody(prompt)),
        ...(opts.signal ? { signal: opts.signal } : {}),
      })
    } catch (err) {
      throw wrap(err, `cannot reach Ollama at ${this.#url}`)
    }
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '')
      const msg = safeError(detail) ?? `HTTP ${res.status}`
      const code = res.status === 404 ? 'not_found' : res.status >= 500 ? 'server' : 'bad_request'
      throw new LlmError(code, `Ollama: ${msg}`, { status: res.status })
    }

    const decoder = new TextDecoder()
    let buf = ''
    try {
      for await (const bytes of res.body) {
        buf += decoder.decode(bytes, { stream: true })
        let nl = buf.indexOf('\n')
        while (nl !== -1) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          nl = buf.indexOf('\n')
          if (!line) continue
          const ev = this.#parse(line)
          if (ev) yield ev
          if (ev?.type === 'done') return
        }
      }
      buf += decoder.decode()
      if (buf.trim()) {
        const ev = this.#parse(buf.trim())
        if (ev) yield ev
        if (ev?.type === 'done') return
      }
    } catch (err) {
      throw wrap(err, 'Ollama stream failed')
    }
    throw new LlmError('network', 'Ollama stream ended without a final chunk')
  }

  #parse(line: string): ProviderEvent | null {
    let json: unknown
    try {
      json = JSON.parse(line)
    } catch {
      throw new LlmError('server', `Ollama sent a malformed line: ${line.slice(0, 120)}`)
    }
    const chunk = ChatChunk.parse(json)
    if (chunk.error) throw new LlmError('server', `Ollama: ${chunk.error}`)
    if (chunk.done) {
      return {
        type: 'done',
        stopReason: STOP_REASON[chunk.done_reason ?? 'stop'] ?? chunk.done_reason ?? 'end_turn',
        model: chunk.model ?? this.model,
        usage: {
          inputTokens: chunk.prompt_eval_count ?? 0,
          outputTokens: chunk.eval_count ?? 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        refusal: null,
        fallback: null,
      }
    }
    const text = chunk.message?.content ?? ''
    return text ? { type: 'delta', text } : null
  }
}

function safeError(body: string): string | null {
  try {
    const j = JSON.parse(body) as { error?: unknown }
    return typeof j.error === 'string' ? j.error : null
  } catch {
    return body.trim() || null
  }
}

function wrap(err: unknown, message: string): LlmError {
  if (err instanceof LlmError) return err
  if (isAbort(err)) return new LlmError('aborted', 'request aborted', { cause: err })
  return new LlmError('network', `${message}: ${err instanceof Error ? err.message : String(err)}`, {
    cause: err,
  })
}
