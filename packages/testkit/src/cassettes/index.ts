// V-5a — record/replay for LLM HTTP traffic at the `fetch` layer.
//
// The Anthropic SDK accepts a custom `fetch`, so a cassette sits exactly on the wire: the SDK builds the
// real request (headers, JSON body, beta flags) and parses the real response (SSE framing, event
// accumulation, typed errors). Nothing above the socket is faked.
//
//   replay (default)  every request is served from the cassette file, in order. Offline, free, deterministic.
//   record            only when ANTHROPIC_API_KEY is set AND GNOMEOLA_CASSETTES=record. Requests go to the
//                     real API and request + response are written back to the cassette file on save().
//
// A cassette stores the *normalised* request (method, url, headers minus credentials and volatile SDK
// telemetry, parsed JSON body) so tests can assert on what the client actually sent, plus the status,
// the headers the SDK's retry logic reads, and the raw response body (SSE text for streams).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export type CassetteRequest = {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

export type CassetteResponse = {
  status: number
  headers: Record<string, string>
  /** Raw body text. For streaming requests this is the SSE stream exactly as sent on the wire. */
  body: string
  /**
   * Simulates the connection dying mid-body: after `afterBytes` bytes of `body` have been delivered, the
   * body stream errors the way undici does on a reset socket (`TypeError: terminated`).
   */
  streamError?: { afterBytes: number; message: string }
}

export type Interaction = { request: CassetteRequest; response: CassetteResponse }

export type Cassette = {
  version: 1
  name: string
  /** `hand-authored` cassettes were written without an API key, in the documented wire format. */
  source: 'recorded' | 'hand-authored'
  note?: string
  interactions: Interaction[]
}

export type CassetteMode = 'record' | 'replay'

/** Headers never written to a cassette: credentials, and SDK telemetry that differs per machine/run. */
const DROP_HEADER = /^(x-api-key|authorization|cookie|user-agent|x-stainless-.*|content-length)$/i
/** Response headers worth keeping: the ones the SDK reads (content type, retry hints). */
const KEEP_RESPONSE_HEADER = /^(content-type|retry-after|retry-after-ms|x-should-retry|request-id)$/i

/**
 * Decide the mode from the environment. Recording is opt-in twice over (key + flag) so a developer with a
 * key in their shell never re-records by accident. Asking to record without a key is an error, not a
 * silent fall back to replay.
 */
export function cassetteMode(env: NodeJS.ProcessEnv = process.env): CassetteMode {
  if (env.GNOMEOLA_CASSETTES !== 'record') return 'replay'
  if (!env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY) {
    throw new Error(
      'GNOMEOLA_CASSETTES=record needs ANTHROPIC_API_KEY or OPENAI_API_KEY to be set; refusing to guess',
    )
  }
  return 'record'
}

function sortedObject(entries: [string, string][]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) out[k] = v
  return out
}

function headerEntries(h: ConstructorParameters<typeof Headers>[0]): [string, string][] {
  if (!h) return []
  return [...new Headers(h).entries()]
}

/** Normalise an outgoing request into its cassette form. */
export function normaliseRequest(input: string | URL | Request, init: RequestInit = {}): CassetteRequest {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const headers = sortedObject(
    headerEntries(init.headers ?? (input instanceof Request ? input.headers : undefined))
      .map(([k, v]): [string, string] => [k.toLowerCase(), v])
      .filter(([k]) => !DROP_HEADER.test(k)),
  )
  let body: unknown = null
  if (init.body != null) {
    if (typeof init.body !== 'string') throw new Error('cassettes: only string request bodies are supported')
    const ct = headers['content-type'] ?? ''
    body = ct.includes('json') ? JSON.parse(init.body) : init.body
  }
  return { method, url, headers, body }
}

export function loadCassette(path: string): Cassette {
  if (!existsSync(path)) {
    throw new Error(
      `cassette not found: ${path}. Record it with ANTHROPIC_API_KEY=… GNOMEOLA_CASSETTES=record, ` +
        'or hand-author it (see docs/llm.md).',
    )
  }
  const c = JSON.parse(readFileSync(path, 'utf8')) as Cassette
  if (c.version !== 1 || !Array.isArray(c.interactions)) throw new Error(`not a v1 cassette: ${path}`)
  return c
}

export function saveCassette(path: string, cassette: Cassette): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(cassette, null, 2)}\n`)
}

/** Split an SSE body at event boundaries, so the client sees it arrive incrementally like a real stream. */
function chunksOf(body: string): string[] {
  const parts = body.split(/(?<=\n\n)/)
  return parts.filter((p) => p.length > 0)
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('This operation was aborted', 'AbortError')
}

/** Build a real `Response` from a cassette response, streaming the body chunk by chunk. */
export function replayResponse(res: CassetteResponse, signal?: AbortSignal | null): Response {
  const enc = new TextEncoder()
  const bytes = enc.encode(res.body)
  const failAt = res.streamError ? Math.min(res.streamError.afterBytes, bytes.length) : null
  const pieces: Uint8Array[] = []
  let offset = 0
  for (const c of chunksOf(res.body)) {
    const b = enc.encode(c)
    pieces.push(bytes.subarray(offset, offset + b.length))
    offset += b.length
  }
  let sent = 0
  let i = 0
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      // yield to the event loop between chunks: a real stream never arrives in one synchronous burst
      await new Promise((r) => setImmediate(r))
      if (signal?.aborted) {
        controller.error(abortError(signal))
        return
      }
      if (failAt !== null && sent >= failAt) {
        const cause = Object.assign(new Error(res.streamError!.message), { code: 'ECONNRESET' })
        controller.error(Object.assign(new TypeError('terminated'), { cause }))
        return
      }
      const piece = pieces[i++]
      if (!piece) {
        controller.close()
        return
      }
      const room = failAt === null ? piece.length : Math.min(piece.length, failAt - sent)
      controller.enqueue(piece.subarray(0, room))
      sent += room
    },
  })
  const status = res.status
  const noBody = status === 204 || status === 304
  return new Response(noBody ? null : stream, { status, headers: res.headers })
}

export type CassetteSession = {
  readonly mode: CassetteMode
  readonly path: string
  /** Pass this as the client's `fetch`. */
  readonly fetch: typeof fetch
  /** Every request the client actually sent through this session, normalised, in order. */
  readonly requests: CassetteRequest[]
  /** The cassette being replayed, or the one being built while recording. */
  readonly cassette: Cassette
  /** Throws unless every recorded interaction was consumed (replay) — catches silently skipped calls. */
  assertExhausted(): void
  /** Record mode: write the cassette. Replay mode: no-op. */
  save(): void
}

export type UseCassetteOptions = {
  mode?: CassetteMode
  /** The real fetch used when recording. Defaults to globalThis.fetch. */
  realFetch?: typeof fetch
  /** Record mode: name + note written into the new cassette. */
  name?: string
  note?: string
}

/**
 * Open a cassette. In replay mode the file must exist; in record mode it is (re)written by save().
 * Replay is strictly sequential and checks method + URL of each request against the recording, so a
 * client that suddenly makes an extra or different call fails loudly instead of being fed the wrong reply.
 */
export function useCassette(path: string, opts: UseCassetteOptions = {}): CassetteSession {
  const mode = opts.mode ?? cassetteMode()
  const requests: CassetteRequest[] = []
  if (mode === 'replay') {
    const cassette = loadCassette(path)
    let next = 0
    const replayFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const req = normaliseRequest(input, init)
      requests.push(req)
      if (init?.signal?.aborted) throw abortError(init.signal)
      const hit = cassette.interactions[next]
      if (!hit) {
        throw new Error(
          `cassette ${cassette.name}: request #${next + 1} (${req.method} ${req.url}) but only ` +
            `${cassette.interactions.length} recorded`,
        )
      }
      if (hit.request.method !== req.method || hit.request.url !== req.url) {
        throw new Error(
          `cassette ${cassette.name}: request #${next + 1} is ${req.method} ${req.url}, recorded ` +
            `${hit.request.method} ${hit.request.url}`,
        )
      }
      next++
      return replayResponse(hit.response, init?.signal)
    }
    return {
      mode,
      path,
      fetch: replayFetch as typeof fetch,
      requests,
      cassette,
      assertExhausted() {
        if (next !== cassette.interactions.length) {
          throw new Error(
            `cassette ${cassette.name}: ${cassette.interactions.length - next} recorded interaction(s) unused`,
          )
        }
      },
      save() {},
    }
  }

  const realFetch = opts.realFetch ?? globalThis.fetch
  const cassette: Cassette = {
    version: 1,
    name: opts.name ?? path.replace(/^.*\//, '').replace(/\.json$/, ''),
    source: 'recorded',
    ...(opts.note ? { note: opts.note } : {}),
    interactions: [],
  }
  const recordFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const req = normaliseRequest(input, init)
    requests.push(req)
    const res = await realFetch(input, init)
    const body = await res.text()
    const headers = sortedObject([...res.headers.entries()].filter(([k]) => KEEP_RESPONSE_HEADER.test(k)))
    cassette.interactions.push({ request: req, response: { status: res.status, headers, body } })
    return new Response(body, { status: res.status, headers: res.headers })
  }
  return {
    mode,
    path,
    fetch: recordFetch as typeof fetch,
    requests,
    cassette,
    assertExhausted() {},
    save() {
      saveCassette(path, cassette)
    },
  }
}

// ------------------------------------------------------------------ hand-authoring helpers

export type SseEvent = { type: string } & Record<string, unknown>

/** Render events in the Messages API SSE wire format: `event: <type>\ndata: <json>\n\n`. */
export function sseBody(events: SseEvent[]): string {
  return events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
}

/** Parse an SSE body back into its events (for tests that inspect cassettes). */
export function parseSse(body: string): SseEvent[] {
  const out: SseEvent[] = []
  for (const frame of body.split('\n\n')) {
    const data = frame
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6))
      .join('\n')
    if (data) out.push(JSON.parse(data) as SseEvent)
  }
  return out
}
