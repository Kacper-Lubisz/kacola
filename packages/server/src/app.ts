import {
  type BodyOut,
  extractActionItems,
  matchPath,
  type ParamsOf,
  parseSince,
  type QueryOut,
  type ResponseOf,
  type RouteDef,
  type RouteName,
  type Routes,
  routes,
} from '@gnomeola/protocol'
import type { BlobStore } from '@gnomeola/store/blob'
import type { StoreApi } from '@gnomeola/store/core'
import type { BatchTranscriber } from '@gnomeola/stt/cloud'
import type { z } from 'zod'
import pkg from '../package.json' with { type: 'json' }
import { audioStatus, deleteAudio, finalize, putChunk } from './audio.ts'
import { Auth, type AuthConfig, isLoopbackRequest, OPEN_ROUTES, type Principal } from './auth.ts'
import { errorBody, HttpError, needsToken, toHttpError } from './errors.ts'
import { eventStream } from './sse.ts'

// The hosted gnomeola server: the same route table the local daemon serves, answered from the async
// StoreApi, as a fetch handler — `(Request) => Response` — so it runs unchanged under Node (./node.ts,
// tests, a self-hosted box) and as Vercel functions (packages/vercel).
//
// What moves and what does not (the plan's "Hosting" table): sessions, transcripts, search, Q&A history
// and the event stream are served here; capture, local STT, devices and models stay on the laptop
// (those routes answer 501 or an empty list). Writes arrive by hybrid sync (/sync/push) or, in full
// offload, by chunked audio upload + finalize with a cloud STT provider.

export const VERSION: string = pkg.version

export type HostedAppOptions = {
  store: StoreApi
  blobs: BlobStore
  /** null: no auth configured — only loopback requests are served (like the local daemon). */
  auth: AuthConfig | null
  /** Treat loopback requests as the owner without a token (Node self-hosting). Never on Vercel. */
  trustLoopback?: boolean
  /** Cloud STT for full offload; without it finalize stores audio but writes no transcript. */
  stt?: BatchTranscriber | null
  /** End each SSE stream after this long: the function's maxDuration minus a safety margin. */
  maxStreamMs?: number
  pollMs?: number
  heartbeatMs?: number
  replayPageSize?: number
  maxBodyBytes?: number
  now?: () => Date
  log?: (level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) => void
}

export type RequestContext = { remoteAddress?: string | undefined }

type Ctx<N extends RouteName> = {
  params: ParamsOf<N>
  query: QueryOut<N>
  body: BodyOut<N>
  principal: Principal
  req: Request
}
type JsonHandler<N extends RouteName> = (c: Ctx<N>) => Promise<ResponseOf<N>> | ResponseOf<N>
type StreamHandler<N extends RouteName> = (c: Ctx<N>) => Promise<Response>
/** Every route is either served or explicitly not — adding a route without deciding fails to compile. */
type HostedHandlers = {
  [N in RouteName]: 'unsupported' | (Routes[N]['response'] extends 'sse' ? StreamHandler<N> : JsonHandler<N>)
}

export type HostedApp = {
  fetch(req: Request, ctx?: RequestContext): Promise<Response>
  readonly store: StoreApi
  readonly auth: Auth | null
}

export function createHostedApp(o: HostedAppOptions): HostedApp {
  const { store, blobs } = o
  const now = o.now ?? (() => new Date())
  const auth = o.auth ? new Auth(store, o.auth, now) : null
  const trustLoopback = o.trustLoopback ?? true
  const maxBody = o.maxBodyBytes ?? 2 * 1024 * 1024
  const startedAt = Date.now()
  const log = o.log ?? (() => {})
  const audio = { store, blobs, stt: o.stt ?? null, now }

  const since = (v: string | undefined) => {
    if (v === undefined) return undefined
    try {
      return parseSince(v)
    } catch (err) {
      throw new HttpError('bad_request', (err as Error).message)
    }
  }
  const visible = async (id: string, includePrivate: boolean | undefined) => {
    const s = await store.getSession(id)
    if (!s || (s.private && !includePrivate)) throw new HttpError('not_found', `no session ${id}`)
    return s
  }
  const pairing = () => {
    if (!auth) throw new HttpError('unavailable', 'pairing needs GNOMEOLA_AUTH_SECRET on the server', 501)
    return auth
  }
  const deviceIdFor = (p: Principal, fromBody: string | undefined) =>
    p.kind === 'device' ? p.deviceId : (fromBody ?? 'local')
  const health = async (): Promise<ResponseOf<'health'>> => ({
    ok: true,
    version: VERSION,
    uptimeMs: Date.now() - startedAt,
    lastSeq: await store.lastSeq(),
    capture: { available: false, backend: 'hosted', detail: 'capture runs in a local capture-agent' },
    models: [],
    llm: { provider: 'none', ready: false },
  })

  const handlers: HostedHandlers = {
    health: () => health(),
    listDevices: () => ({ devices: [] }),

    listSessions: async ({ query }) => ({
      sessions: await store.listSessions({
        since: since(query.since),
        limit: query.limit,
        includePrivate: query.includePrivate,
      }),
    }),
    createSession: ({ body }) => store.createSession({ title: body.title, private: body.private }),
    getSession: ({ params, query }) => visible(params.id, query.includePrivate),
    // Hybrid sync conflict rule: the recording device wins. A rename here is overwritten by the device's
    // next update of that session (docs/hosting.md).
    updateSession: ({ params, body }) =>
      store.updateSession(params.id, (s) => ({
        ...s,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.private !== undefined ? { private: body.private } : {}),
      })),
    deleteSession: async ({ params }) => {
      await store.deleteSession(params.id, (s) => {
        if (s.status === 'recording' || s.status === 'paused')
          throw new HttpError('conflict', `session ${params.id} is ${s.status}; stop it before deleting`)
      })
      await deleteAudio(blobs, params.id)
      return { deleted: true as const }
    },
    startSession: 'unsupported',
    pauseSession: 'unsupported',
    resumeSession: 'unsupported',
    stopSession: 'unsupported',

    getTranscript: async ({ params, query }) => {
      const session = await visible(params.id, query.includePrivate)
      return { session, ...(await store.transcript(params.id, query)) }
    },
    getQaHistory: async ({ params, query }) => {
      await visible(params.id, query.includePrivate)
      return { messages: await store.qaHistory(params.id) }
    },
    search: ({ query }) =>
      store.search({
        q: query.q,
        since: since(query.since),
        sessionId: query.sessionId,
        speaker: query.speaker,
        limit: query.limit,
        includePrivate: query.includePrivate,
      }),
    ask: 'unsupported',
    events: async ({ query, req }) => {
      let from = query.since
      const header = req.headers.get('last-event-id')
      if (header !== null && header.trim() !== '') {
        const n = Number(header)
        if (!Number.isInteger(n) || n < 0) throw new HttpError('bad_request', 'Last-Event-ID must be a seq')
        from = n
      }
      const last = await store.lastSeq()
      if (from !== undefined && from > last)
        throw new HttpError('conflict', `cursor ${from} is ahead of the event log (lastSeq ${last})`)
      const it = eventStream({
        store,
        since: from,
        sessionId: query.sessionId,
        ephemeral: query.ephemeral,
        signal: req.signal,
        maxStreamMs: o.maxStreamMs ?? 240_000,
        pollMs: o.pollMs ?? 1000,
        heartbeatMs: o.heartbeatMs ?? 15_000,
        pageSize: o.replayPageSize ?? 500,
      })
      const enc = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        async pull(c) {
          try {
            const { done, value } = await it.next()
            if (done) c.close()
            else c.enqueue(enc.encode(value))
          } catch (err) {
            log('error', 'event stream failed', { err: (err as Error).message })
            c.close()
          }
        },
        async cancel() {
          await it.return(undefined)
        },
      })
      return new Response(body, {
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-store',
          'x-accel-buffering': 'no',
        },
      })
    },

    listModels: () => ({ models: [] }),
    downloadModel: 'unsupported',
    getSettings: 'unsupported',
    updateSettings: 'unsupported',
    setApiKey: 'unsupported',
    diagnostics: async () => ({
      version: VERSION,
      generatedAt: now().toISOString(),
      health: await health(),
      logTail: [],
    }),

    // ---- M7 notes: readable here (they arrive by hybrid sync); written only on the recording device,
    // whose daemon has the LLM for enhancement and the built-in templates.
    getNotes: async ({ params, query }) => {
      await visible(params.id, query.includePrivate)
      const note = await store.getNotes(params.id)
      const enhanced = note.pendingEnhancement
        ? await store.noteVersion(params.id, note.pendingEnhancement)
        : null
      return { note, enhanced }
    },
    listNoteVersions: async ({ params, query }) => {
      await visible(params.id, query.includePrivate)
      return { versions: await store.noteVersions(params.id) }
    },
    getActionItems: async ({ params, query }) => {
      await visible(params.id, query.includePrivate)
      const v = query.version !== undefined ? await store.noteVersion(params.id, query.version) : null
      if (query.version !== undefined && !v)
        throw new HttpError('not_found', `no version ${query.version} of these notes`)
      const source = v ?? (await store.getNotes(params.id))
      return { version: source.version, items: extractActionItems(source.markdown) }
    },
    putNotes: 'unsupported',
    enhanceNotes: 'unsupported',
    mergeNotes: 'unsupported',
    restoreNoteVersion: 'unsupported',
    listTemplates: 'unsupported',
    putTemplate: 'unsupported',
    deleteTemplate: 'unsupported',

    // ---- M8
    syncPush: async ({ body, principal }) =>
      store.ingest(deviceIdFor(principal, body.deviceId), body.items, { partial: body.partial }),
    syncCursor: async ({ query, principal }) => {
      const deviceId = deviceIdFor(principal, query.deviceId)
      return { deviceId, cursor: await store.syncCursor(deviceId) }
    },
    pairStart: ({ body }) => pairing().start(body.name),
    pairApprove: ({ body }) => pairing().approve(body.userCode),
    pairToken: ({ body }) => pairing().poll(body.deviceCode),
    putAudioChunk: ({ params, body }) => putChunk(audio, params.id, params.chunkSeq, body),
    getAudioStatus: ({ params }) => audioStatus(audio, params.id),
    finalizeAudio: ({ params, body }) => finalize(audio, params.id, body),
  }

  const table = (Object.entries(routes) as [RouteName, RouteDef][]).map(([name, def]) => ({ name, def }))

  async function principalFor(req: Request, name: RouteName, ctx: RequestContext): Promise<Principal> {
    const loopback = isLoopbackRequest({
      remoteAddress: ctx.remoteAddress,
      host: req.headers.get('host') ?? new URL(req.url).host,
      forwarded: req.headers.has('x-forwarded-for') || req.headers.has('forwarded'),
    })
    if (!auth) {
      if (loopback) return { kind: 'loopback' }
      throw needsToken('this server has no auth configured, so it only answers loopback requests')
    }
    if (req.headers.has('authorization')) return auth.authenticate(req.headers.get('authorization'))
    if (loopback && trustLoopback) return { kind: 'loopback' }
    if (OPEN_ROUTES.has(name)) return { kind: 'anonymous' }
    throw needsToken()
  }

  async function readBody(req: Request): Promise<unknown> {
    const len = Number(req.headers.get('content-length') ?? '0')
    if (len > maxBody) throw new HttpError('bad_request', `request body exceeds ${maxBody} bytes`, 413)
    const buf = new Uint8Array(await req.arrayBuffer())
    if (buf.length > maxBody) throw new HttpError('bad_request', `request body exceeds ${maxBody} bytes`, 413)
    const text = new TextDecoder().decode(buf).trim()
    if (!text) return undefined
    try {
      return JSON.parse(text)
    } catch {
      throw new HttpError('bad_request', 'request body is not valid JSON')
    }
  }

  async function dispatch(req: Request, ctx: RequestContext): Promise<Response> {
    const url = new URL(req.url)
    // Browsers: only same-origin requests (the viewer is served from this origin). A cross-origin page
    // must not be able to use a token the browser happens to hold.
    const origin = req.headers.get('origin')
    if (origin !== null && hostOf(origin) !== url.host)
      throw new HttpError('unauthorized', 'cross-origin requests are not allowed')

    const matches = table.flatMap((r) => {
      const params = matchPath(r.def.path, url.pathname)
      return params ? [{ ...r, params }] : []
    })
    if (!matches.length) throw new HttpError('not_found', `no route ${url.pathname}`)
    const hit = matches.find((m) => m.def.method === req.method)
    if (!hit)
      throw new HttpError('bad_request', `method ${req.method} not allowed on ${url.pathname}`, 405, {
        allow: matches.map((m) => m.def.method).join(', '),
      })
    const { name, def, params } = hit
    // Authenticate BEFORE parsing anything: an unauthenticated caller learns nothing, not even whether
    // its query was valid.
    const principal = await principalFor(req, name, ctx)
    const handler = handlers[name]
    if (handler === 'unsupported')
      throw new HttpError('unavailable', `${name} is not available on a hosted gnomeola server`, 501)
    const query = def.query ? def.query.parse(Object.fromEntries(url.searchParams)) : {}
    const body = def.body ? def.body.parse((await readBody(req)) ?? {}) : undefined
    const c = { params, query, body, principal, req }
    if (def.response === 'sse') {
      return (handler as StreamHandler<RouteName>)(c as unknown as Ctx<RouteName>)
    }
    const result = await (handler as JsonHandler<RouteName>)(c as unknown as Ctx<RouteName>)
    const checked = (def.response as z.ZodType).safeParse(result)
    if (!checked.success) {
      log('error', 'response failed its schema', { route: name, issues: checked.error.issues.slice(0, 5) })
      throw new HttpError('internal', `response for ${name} failed validation`)
    }
    return json(name === 'createSession' ? 201 : 200, checked.data)
  }

  return {
    store,
    auth,
    async fetch(req, ctx = {}) {
      try {
        return await dispatch(req, ctx)
      } catch (err) {
        const e = toHttpError(err)
        if (e.code === 'internal')
          log('error', 'request failed', { method: req.method, url: req.url, err: errText(err) })
        return json(e.status, errorBody(e), e.headers)
      }
    },
  }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })
}

const hostOf = (origin: string) => {
  try {
    return new URL(origin).host
  } catch {
    return null
  }
}

const errText = (err: unknown) =>
  err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err)
