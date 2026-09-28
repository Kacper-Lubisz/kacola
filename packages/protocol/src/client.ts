import { AnyEvent, isDurable } from './events.ts'
import {
  AskStreamEvent,
  type BodyIn,
  buildPath,
  type JsonRouteName,
  type ParamsOf,
  type QueryIn,
  type ResponseOf,
  type RouteName,
  routes,
  type SseRouteName,
} from './routes.ts'
import { ApiError } from './schemas.ts'
import { SseDecoder, type SseMessage } from './sse.ts'

// The typed client every front-end uses — the GTK UI, the CLI, the web viewer later. It is the only
// sanctioned way to talk to a daemon, local or remote.

export const DEFAULT_PORT = 8787
export const DEFAULT_BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`

export class GnomeolaApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'GnomeolaApiError'
    this.status = status
    this.code = code
  }
}

/** The daemon could not be reached at all — distinct from an error response. */
export class DaemonUnreachableError extends Error {
  readonly baseUrl: string
  constructor(baseUrl: string, cause: unknown) {
    super(`gnomeola daemon is not reachable at ${baseUrl}`, { cause })
    this.name = 'DaemonUnreachableError'
    this.baseUrl = baseUrl
  }
}

type CallOpts<N extends RouteName> = {
  params?: ParamsOf<N>
  query?: QueryIn<N>
  body?: BodyIn<N>
  signal?: AbortSignal
}

export type ClientOptions = {
  baseUrl?: string
  fetch?: typeof fetch
  headers?: Record<string, string>
  /** Per-request timeout for JSON calls. Streams are never timed out. */
  timeoutMs?: number
}

export function toQueryString(query: Record<string, unknown> | undefined): string {
  if (!query) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue
    sp.set(k, typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export type SubscribeOptions = {
  /** Resume after this seq. Omit to receive only new events. */
  since?: number
  sessionId?: string
  ephemeral?: boolean
  signal?: AbortSignal
  onEvent: (e: AnyEvent) => void
  onConnect?: () => void
  onDisconnect?: (err: unknown) => void
  reconnectDelayMs?: number
}

export function createClient(opts: ClientOptions = {}) {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  const f = opts.fetch ?? globalThis.fetch

  async function raw(name: RouteName, o: CallOpts<RouteName>, stream: boolean): Promise<Response> {
    const def = routes[name]
    const url =
      baseUrl +
      buildPath(def.path, (o.params ?? {}) as Record<string, string>) +
      toQueryString(o.query as unknown as Record<string, unknown> | undefined)
    const headers: Record<string, string> = { ...opts.headers }
    if (stream) headers.accept = 'text/event-stream'
    let body: string | undefined
    if (o.body !== undefined) {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(o.body)
    }
    let signal = o.signal
    if (!stream && opts.timeoutMs) {
      const t = AbortSignal.timeout(opts.timeoutMs)
      signal = signal ? AbortSignal.any([signal, t]) : t
    }
    let res: Response
    try {
      res = await f(url, { method: def.method, headers, body, signal })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' && o.signal?.aborted) throw err
      throw new DaemonUnreachableError(baseUrl, err)
    }
    if (!res.ok) {
      const text = await res.text()
      let parsed: ReturnType<typeof ApiError.safeParse> | null = null
      try {
        parsed = ApiError.safeParse(JSON.parse(text))
      } catch {}
      if (parsed?.success)
        throw new GnomeolaApiError(res.status, parsed.data.error.code, parsed.data.error.message)
      throw new GnomeolaApiError(res.status, 'internal', text || res.statusText)
    }
    return res
  }

  async function call<N extends JsonRouteName>(name: N, o: CallOpts<N> = {}): Promise<ResponseOf<N>> {
    const res = await raw(name, o as CallOpts<RouteName>, false)
    const schema = routes[name].response
    // Validate on the way in: a daemon that drifted from the contract fails loudly here, not three
    // screens later in a widget.
    return (schema as { parse(v: unknown): unknown }).parse(await res.json()) as ResponseOf<N>
  }

  async function* stream<N extends SseRouteName>(name: N, o: CallOpts<N> = {}): AsyncGenerator<SseMessage> {
    const res = await raw(name, o as CallOpts<RouteName>, true)
    if (!res.body) return
    const decoder = new SseDecoder()
    const text = new TextDecoder()
    for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
      for (const msg of decoder.push(text.decode(chunk, { stream: true }))) yield msg
    }
  }

  async function* ask(body: BodyIn<'ask'>, signal?: AbortSignal): AsyncGenerator<AskStreamEvent> {
    for await (const msg of stream('ask', { body, signal })) {
      if (!msg.data) continue
      yield AskStreamEvent.parse(JSON.parse(msg.data))
    }
  }

  /**
   * A resumable event subscription. Tracks the last durable seq it has seen, reconnects with that
   * cursor after any disconnect, and drops anything at or below it — so the caller observes a gap-free,
   * duplicate-free durable stream no matter how often the connection dies.
   */
  async function subscribe(s: SubscribeOptions): Promise<void> {
    let cursor = s.since
    const delay = s.reconnectDelayMs ?? 500
    while (!s.signal?.aborted) {
      try {
        const it = stream('events', {
          query: { since: cursor, sessionId: s.sessionId, ephemeral: s.ephemeral ?? true },
          signal: s.signal,
        })
        let connected = false
        for await (const msg of it) {
          if (!connected) {
            connected = true
            s.onConnect?.()
          }
          if (!msg.data) continue
          const ev = AnyEvent.parse(JSON.parse(msg.data))
          if (isDurable(ev)) {
            if (cursor !== undefined && ev.seq <= cursor) continue
            if (cursor !== undefined && ev.seq !== cursor + 1) {
              throw new Error(`event gap: expected seq ${cursor + 1}, got ${ev.seq}`)
            }
            cursor = ev.seq
          }
          s.onEvent(ev)
        }
        s.onDisconnect?.(null)
      } catch (err) {
        if (s.signal?.aborted) return
        s.onDisconnect?.(err)
      }
      if (s.signal?.aborted) return
      await new Promise((r) => setTimeout(r, delay))
      // First connection with no cursor: after a reconnect we must replay from where we got to, and if we
      // never saw a durable event we resume from 0 is wrong (it would replay history the caller didn't
      // ask for). Leave cursor undefined in that case: only-new is the correct semantic.
    }
  }

  return { baseUrl, call, stream, ask, subscribe }
}

export type GnomeolaClient = ReturnType<typeof createClient>
