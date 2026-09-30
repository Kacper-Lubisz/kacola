// @gnomeola/testkit/fake-decisions — local stand-ins for the four hosted decision APIs, speaking their
// documented wire formats, so @gnomeola/decisions' providers (and the evals' offline mode) run their real
// HTTP, parsing and error paths without keys:
//
//   TypeSafe  POST /v1/systemone           docs.typesafe.ai/api.md (request/response/answer types, errors)
//   OpenAI    POST /v1/responses           Responses API, non-streaming, json_schema text format, logprobs
//   Anthropic POST /v1/messages            Messages API, tool_use content block
//   Ollama    POST /api/chat               stream:false, format = JSON schema
//
// Every fake parses the native request back into generic questions and asks a `brain` for the answers
// (tests script exact answers; the evals' offline mode plugs a deterministic oracle in). `fail` queues
// error responses (status + native error body + headers) and `delayMs` slows the next responses, for the
// retry / timeout / error-mapping tests. Every request is recorded.
import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'

export type FakeQuestion = {
  id: string
  kind: 'choice' | 'score' | 'yesno' | 'extract'
  instructions: string
  /** choice: option keys; score: '0'…'n-1'; yesno: yes/no; extract: candidates (may be empty). */
  options: string[]
}
/** Distribution over `options` (need not be normalised), or an extraction. */
export type FakeAnswer = { probabilities: Record<string, number> } | { value: string | null; p: number }
export type Brain = (req: { state: string; questions: FakeQuestion[] }) => Record<string, FakeAnswer>
export type SeenRequest = { path: string; headers: IncomingHttpHeaders; body: Record<string, unknown> }
export type FakeFailure = { status: number; body: unknown; headers?: Record<string, string> }

export type FakeServer = {
  url: string
  seen: SeenRequest[]
  /** Queue failures returned before any brain answer. */
  fail(...f: FakeFailure[]): void
  /** Delay every following response by this much (0 = none). */
  setDelay(ms: number): void
  setBrain(b: Brain): void
  close(): Promise<void>
}

type Handler = (body: Record<string, unknown>, brain: Brain) => { status: number; body: unknown }

async function serve(route: string, handle: Handler, brain: Brain): Promise<FakeServer> {
  const seen: SeenRequest[] = []
  const failures: FakeFailure[] = []
  let delay = 0
  let b = brain
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const raw = Buffer.concat(chunks).toString('utf8')
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    seen.push({ path: req.url ?? '', headers: req.headers, body })
    if (delay) await new Promise((r) => setTimeout(r, delay))
    if (res.destroyed) return
    const f = failures.shift()
    if (f) {
      res.writeHead(f.status, { 'content-type': 'application/json', ...f.headers })
      return res.end(JSON.stringify(f.body))
    }
    if (!(req.url ?? '').startsWith(route)) {
      res.writeHead(404, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ error: { message: `fake: no route ${req.url}` } }))
    }
    try {
      const out = handle(body, b)
      res.writeHead(out.status, { 'content-type': 'application/json', 'x-typesafe-request-id': 'req_fake' })
      res.end(JSON.stringify(out.body))
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: `fake: ${(err as Error).message}` } }))
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    seen,
    fail: (...f) => failures.push(...f),
    setDelay: (ms) => {
      delay = ms
    },
    setBrain: (nb) => {
      b = nb
    },
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections()
        server.close(() => r())
      }),
  }
}

const norm = (p: Record<string, number>, keys: string[]) => {
  const w = keys.map((k) => Math.max(0, p[k] ?? 0))
  const s = w.reduce((a, x) => a + x, 0)
  return Object.fromEntries(keys.map((k, i) => [k, s > 0 ? w[i]! / s : 1 / keys.length]))
}
const argmax = (p: Record<string, number>) => Object.entries(p).sort((a, b) => b[1] - a[1])[0]![0]
const r2 = (x: number) => Math.round(x * 100) / 100
const peak = (probs: number[]) => {
  const n = probs.length
  return Math.max(0, Math.min(1, (n * Math.max(...probs) - 1) / (n - 1)))
}
const tokens = (text: string) => Math.max(1, Math.ceil(text.length / 4))

// ----------------------------------------------------------------------------------- TypeSafe

type TsQ = { type: string; instructions?: unknown; criteria?: unknown }

/** docs.typesafe.ai/api.md: 422 when a question is malformed; answers keyed by the same ids. */
export function startFakeTypeSafe(brain: Brain): Promise<FakeServer> {
  return serve(
    '/v1/systemone',
    (body, brain) => {
      const qs = body.questions as Record<string, TsQ> | undefined
      if (!qs || !Object.keys(qs).length || body.state === undefined || !body.model)
        return { status: 422, body: { detail: [{ loc: ['body', 'questions'], msg: 'field required' }] } }
      const questions: FakeQuestion[] = []
      for (const [id, q] of Object.entries(qs)) {
        const instructions =
          typeof q.instructions === 'string' ? q.instructions : JSON.stringify(q.instructions)
        if (q.type === 'noul') questions.push({ id, kind: 'yesno', instructions, options: ['yes', 'no'] })
        else if (q.type === 'choice')
          questions.push({ id, kind: 'choice', instructions, options: Object.keys(q.criteria as object) })
        else if (q.type === 'score') {
          const levels = q.criteria as unknown[]
          if (!Array.isArray(levels) || levels.length < 2 || levels.length > 10)
            return {
              status: 422,
              body: { detail: [{ loc: ['body', 'questions', id, 'criteria'], msg: 'invalid' }] },
            }
          questions.push({ id, kind: 'score', instructions, options: levels.map((_, i) => String(i)) })
        } else
          return {
            status: 422,
            body: { detail: [{ loc: ['body', 'questions', id, 'type'], msg: 'invalid' }] },
          }
      }
      const state = typeof body.state === 'string' ? body.state : JSON.stringify(body.state)
      const out = brain({ state, questions })
      const answers: Record<string, unknown> = {}
      for (const q of questions) {
        const a = out[q.id]
        if (!a || !('probabilities' in a)) throw new Error(`brain gave no distribution for ${q.id}`)
        const p = norm(a.probabilities, q.options)
        if (q.kind === 'yesno') answers[q.id] = { type: 'noul', noul: r2(p.yes!) }
        else if (q.kind === 'choice')
          answers[q.id] = {
            type: 'choice',
            choice: argmax(p),
            probabilities: p,
            confidence: r2(peak(Object.values(p))),
          }
        else {
          const legend = Object.fromEntries(
            ((qs[q.id]!.criteria as unknown[]) ?? []).map((l, i) => [String(i), l as string]),
          )
          answers[q.id] = {
            type: 'score',
            score: r2(q.options.reduce((s, k) => s + Number(k) * p[k]!, 0)),
            legend,
            probabilities: p,
            confidence: r2(peak(Object.values(p))),
          }
        }
      }
      return {
        status: 200,
        body: {
          model: 'jev-1.13.0',
          answers,
          usage: { input_tokens: tokens(JSON.stringify(body)), output_tokens: 10 * questions.length },
        },
      }
    },
    brain,
  )
}

// ------------------------------------------------------------------------- LLM prompt parsing

/** Recover state + questions from @gnomeola/decisions' user prompt (<state>…</state><questions>[…]). */
export function parseDecisionPrompt(text: string): { state: string; questions: FakeQuestion[] } {
  const state = /<state>\n([\s\S]*?)\n<\/state>/.exec(text)?.[1] ?? ''
  const qjson = /<questions>\n([\s\S]*?)\n<\/questions>/.exec(text)?.[1]
  if (!qjson) throw new Error('prompt has no <questions>')
  const raw = JSON.parse(qjson) as {
    id: string
    kind: FakeQuestion['kind']
    question: string
    options?: Record<string, unknown>
    levels?: Record<string, unknown>
    candidates?: string[]
  }[]
  return {
    state: state.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
    questions: raw.map((q) => ({
      id: q.id,
      kind: q.kind,
      instructions: q.question,
      options:
        q.kind === 'choice'
          ? Object.keys(q.options ?? {})
          : q.kind === 'score'
            ? Object.keys(q.levels ?? {})
            : q.kind === 'yesno'
              ? ['yes', 'no']
              : (q.candidates ?? []),
    })),
  }
}

const VALUE_KEY = { choice: 'choice', score: 'level', yesno: 'answer' } as const

/** The JSON an LLM would return for these answers (schema order), with a self-report bias knob. */
function llmJson(questions: FakeQuestion[], out: Record<string, FakeAnswer>, overconfidence: number) {
  const obj: Record<string, unknown> = {}
  for (const q of questions) {
    const a = out[q.id]
    if (!a) throw new Error(`brain gave no answer for ${q.id}`)
    if (q.kind === 'extract') {
      if (!('value' in a)) throw new Error(`brain gave no value for ${q.id}`)
      obj[q.id] = { value: a.value, probability: r2(a.p) }
      continue
    }
    if (!('probabilities' in a)) throw new Error(`brain gave no distribution for ${q.id}`)
    const p = norm(a.probabilities, q.options)
    const top = argmax(p)
    // LLMs tend to over-state: push mass toward the chosen answer by `overconfidence`
    const self = Object.fromEntries(
      q.options.map((k) => [
        k,
        r2(k === top ? p[k]! + (1 - p[k]!) * overconfidence : p[k]! * (1 - overconfidence)),
      ]),
    )
    obj[q.id] = { [VALUE_KEY[q.kind]]: top, probabilities: self }
  }
  return obj
}

// ------------------------------------------------------------------------------------ OpenAI

type LogProb = { token: string; logprob: number; bytes: number[]; top_logprobs: LogProbAlt[] }
type LogProbAlt = { token: string; logprob: number; bytes: number[] }
const bytes = (s: string) => [...Buffer.from(s, 'utf8')]

/**
 * Tokenise the output JSON the way a BPE tokenizer roughly would, and give the token that starts each
 * choice/level/answer value a top-k distribution taken from the brain (the true distribution, while the
 * self-reported numbers in the text are skewed — so tests can tell which one a provider used).
 */
function withLogprobs(text: string, questions: FakeQuestion[], out: Record<string, FakeAnswer>): LogProb[] {
  const valueStarts = new Map<number, FakeQuestion>()
  let cursor = 0
  for (const q of questions) {
    const at = text.indexOf(JSON.stringify(q.id), cursor)
    cursor = at + q.id.length + 2
    if (q.kind === 'extract') continue
    const key = `"${VALUE_KEY[q.kind]}":"`
    const v = text.indexOf(key, cursor)
    valueStarts.set(v + key.length, q)
  }
  const pieces = text.match(/[A-Za-z0-9_]+|\s+|[^A-Za-z0-9_\s]/g) ?? []
  const lps: LogProb[] = []
  let pos = 0
  for (const piece of pieces) {
    const q = valueStarts.get(pos)
    if (q) {
      const a = out[q.id] as { probabilities: Record<string, number> }
      const p = norm(a.probabilities, q.options)
      const alts = q.options
        .map((o) => ({ token: o, logprob: Math.log(Math.max(1e-9, p[o]!)), bytes: bytes(o) }))
        .sort((x, y) => y.logprob - x.logprob)
        .slice(0, 10)
      lps.push({
        token: piece,
        logprob: Math.log(Math.max(1e-9, p[piece] ?? 1e-9)),
        bytes: bytes(piece),
        top_logprobs: alts,
      })
    } else lps.push({ token: piece, logprob: -0.01, bytes: bytes(piece), top_logprobs: [] })
    pos += piece.length
  }
  return lps
}

export type FakeOpenAIOptions = {
  /** How much the self-reported probabilities overstate the chosen answer (0..1). Default 0.5. */
  overconfidence?: number
  /** Omit logprobs even when asked (e.g. to test the self-reported fallback). */
  noLogprobs?: boolean
}

export function startFakeOpenAI(brain: Brain, opts: FakeOpenAIOptions = {}): Promise<FakeServer> {
  return serve(
    '/v1/responses',
    (body, brain) => {
      const input = body.input as { content: { text: string }[] }[]
      const prompt = parseDecisionPrompt(input[0]!.content[0]!.text)
      const out = brain(prompt)
      const text = JSON.stringify(llmJson(prompt.questions, out, opts.overconfidence ?? 0.5))
      const wantLogprobs =
        !opts.noLogprobs &&
        ((body.include as string[] | undefined) ?? []).includes('message.output_text.logprobs')
      const inTok = tokens(JSON.stringify(body))
      return {
        status: 200,
        body: {
          id: 'resp_fake',
          object: 'response',
          created_at: 1_790_000_000,
          status: 'completed',
          model: `${body.model as string}-2025-04-14`,
          output: [
            {
              id: 'msg_fake',
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text,
                  annotations: [],
                  ...(wantLogprobs ? { logprobs: withLogprobs(text, prompt.questions, out) } : {}),
                },
              ],
            },
          ],
          usage: {
            input_tokens: inTok,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens: tokens(text),
            output_tokens_details: { reasoning_tokens: 0 },
            total_tokens: inTok + tokens(text),
          },
        },
      }
    },
    brain,
  )
}

// --------------------------------------------------------------------------------- Anthropic

export function startFakeAnthropicDecisions(brain: Brain, opts: { overconfidence?: number } = {}) {
  return serve(
    '/v1/messages',
    (body, brain) => {
      const messages = body.messages as { content: string }[]
      const prompt = parseDecisionPrompt(messages[0]!.content)
      const tools = body.tools as { name: string }[]
      const input = llmJson(prompt.questions, brain(prompt), opts.overconfidence ?? 0.5)
      return {
        status: 200,
        body: {
          id: 'msg_fake',
          type: 'message',
          role: 'assistant',
          model: body.model,
          content: [
            { type: 'thinking', thinking: '', signature: 'sig' },
            { type: 'tool_use', id: 'toolu_fake', name: tools[0]!.name, input },
          ],
          stop_reason: 'tool_use',
          stop_sequence: null,
          stop_details: null,
          usage: {
            input_tokens: tokens(JSON.stringify(body)),
            output_tokens: tokens(JSON.stringify(input)),
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        },
      }
    },
    brain,
  )
}

// ------------------------------------------------------------------------------------ Ollama

export function startFakeOllama(brain: Brain, opts: { overconfidence?: number } = {}) {
  return serve(
    '/api/chat',
    (body, brain) => {
      const messages = body.messages as { role: string; content: string }[]
      const prompt = parseDecisionPrompt(messages.find((m) => m.role === 'user')!.content)
      const content = JSON.stringify(llmJson(prompt.questions, brain(prompt), opts.overconfidence ?? 0.5))
      return {
        status: 200,
        body: {
          model: body.model,
          created_at: '2026-09-30T12:00:00Z',
          message: { role: 'assistant', content },
          done: true,
          done_reason: 'stop',
          prompt_eval_count: tokens(JSON.stringify(messages)),
          eval_count: tokens(content),
        },
      }
    },
    brain,
  )
}
