import { mkdirSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import {
  type BodyOut,
  DEFAULT_PORT,
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
import { Store } from '@gnomeola/store'
import type { z } from 'zod'
import pkg from '../package.json' with { type: 'json' }
import { resolveScope, runAsk } from './ask.ts'
import { AutoRecorder } from './auto-record.ts'
import { EventBus } from './bus.ts'
import { endOfLocalDay, localMidnight } from './calendar/meetings.ts'
import { type CalendarProvider, NoCalendar } from './calendar/providers.ts'
import { CalendarService } from './calendar/service.ts'
import { RecordingControl } from './control.ts'
import { DbusService } from './dbus/service.ts'
import { apiErrorBody, DaemonError, toDaemonError } from './errors.ts'
import { streamEvents } from './events-stream.ts'
import { NoDevices, NoModels, UnavailablePipeline } from './fakes/providers.ts'
import { readJsonBody, SseWriter, sendJson } from './http.ts'
import type { DeviceProvider, Keyring, ModelProvider, QaEngine, TranscriptionPipeline } from './interfaces.ts'
import { NoKeyring } from './keyring.ts'
import { Logger } from './logger.ts'
import type { MicActivitySource } from './mic-activity.ts'
import { SessionManager } from './sessions.ts'
import { SettingsService } from './settings.ts'

export const VERSION: string = pkg.version

/** Loopback only. Binding anything else needs pairing auth first (see the plan's "Hosting" section). */
export const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

export type DaemonOptions = {
  dataDir: string
  host?: string
  /** 0 = pick a free port. */
  port?: number
  pipeline?: TranscriptionPipeline
  qaEngine?: QaEngine | null
  keyring?: Keyring
  devices?: DeviceProvider
  models?: ModelProvider
  /** SSE heartbeat period. */
  heartbeatMs?: number
  /** Durable events per page when replaying /events. */
  replayPageSize?: number
  env?: NodeJS.ProcessEnv
  logger?: Logger
  /** Echo log lines to stderr (journald). */
  echoLogs?: boolean
  /** Browser origins allowed to call the API. Default none: any request carrying Origin is refused. */
  allowedOrigins?: string[]
  maxSseBufferedBytes?: number
  // ---- M4
  /** Where meetings come from. Default: none (calendar off). */
  calendar?: CalendarProvider
  /** Export org.gnome.Gnomeola on the session bus (via the GJS bridge). Default off. */
  dbus?: { gjs?: string; env?: NodeJS.ProcessEnv; minBackoffMs?: number } | null
  /** Microphone-activity source for the auto-record rule. Default: none (the rule then never fires). */
  micActivity?: MicActivitySource
  micIdleStopMs?: number
}

export type Daemon = {
  readonly url: string
  readonly port: number
  readonly host: string
  readonly store: Store
  readonly bus: EventBus
  readonly logger: Logger
  readonly sessions: SessionManager
  readonly settings: SettingsService
  readonly calendar: CalendarService
  readonly control: RecordingControl
  readonly dbus: DbusService | null
  /** Open SSE connections. */
  readonly sseClients: number
  close(): Promise<void>
}

// --------------------------------------------------------------- handler types

export type Ctx<N extends RouteName> = {
  params: ParamsOf<N>
  query: QueryOut<N>
  body: BodyOut<N>
  req: IncomingMessage
  res: ServerResponse
  signal: AbortSignal
}
export type JsonHandler<N extends RouteName> = (ctx: Ctx<N>) => Promise<ResponseOf<N>> | ResponseOf<N>
/** SSE handlers validate first and call `open()` only once they are ready to stream; errors thrown
 *  before that are ordinary JSON errors with a status code. */
export type SseHandler<N extends RouteName> = (ctx: Ctx<N>, open: () => SseWriter) => Promise<void>
/** One handler per route, or this does not compile — the exhaustiveness check against the contract. */
export type Handlers = {
  [N in RouteName]: Routes[N]['response'] extends 'sse' ? SseHandler<N> : JsonHandler<N>
}

// ------------------------------------------------------------------- daemon

export async function createDaemon(o: DaemonOptions): Promise<Daemon> {
  const host = o.host ?? '127.0.0.1'
  if (!LOOPBACK_HOSTS.has(host))
    throw new Error(`refusing to listen on ${host}: gnomeolad only binds loopback until pairing auth exists`)
  mkdirSync(o.dataDir, { recursive: true, mode: 0o700 })
  const env = o.env ?? process.env
  const logger = o.logger ?? new Logger({ file: join(o.dataDir, 'logs', 'gnomeolad.log'), echo: o.echoLogs })
  const store = Store.open(join(o.dataDir, 'gnomeola.db'))
  const bus = new EventBus()
  store.onCommit((e) => bus.publish(e))
  const pipeline = o.pipeline ?? new UnavailablePipeline()
  const models = o.models ?? new NoModels()
  const devices = o.devices ?? new NoDevices()
  const engine = o.qaEngine ?? null
  const settings = new SettingsService({ store, keyring: o.keyring ?? new NoKeyring(), env, logger })
  const sessions = new SessionManager({
    store,
    bus,
    pipeline,
    logger,
    dataDir: o.dataDir,
    settings: () => settings.get(),
  })
  const calendar = new CalendarService({ provider: o.calendar ?? new NoCalendar(), bus, logger })
  const control = new RecordingControl({ store, sessions, calendar, logger })
  const autoRecord = new AutoRecorder({
    calendar,
    control,
    settings,
    bus,
    logger,
    mic: o.micActivity ?? { start() {}, stop() {} },
    micIdleStopMs: o.micIdleStopMs,
  })
  const heartbeatMs = o.heartbeatMs ?? 15_000
  const pageSize = o.replayPageSize ?? 500
  const allowedOrigins = new Set(o.allowedOrigins ?? [])
  const startedAt = Date.now()
  const sse = new Set<SseWriter>()

  const recovered = sessions.recover()
  logger.info('daemon starting', {
    version: VERSION,
    dataDir: o.dataDir,
    lastSeq: store.lastSeq(),
    recovered: recovered.length,
  })

  // Private sessions (X-7): every read path — list, get, transcript, Q&A history, search, ask — treats
  // a private session as nonexistent (same 404, same message) unless the caller passes
  // includePrivate=true. The CLI and the Claude skill never pass it; the GTK window does.
  //
  // This is a guard against ACCIDENTAL exposure to the agent surface, not a security boundary: any
  // local process can reach this loopback API and set the flag. Mutations (rename, delete, start/stop)
  // are not gated. /events is the UI's replication channel and carries private sessions' events too —
  // filtering it would punch holes in the gap-free seq the resumable client relies on.
  const visible = (id: string, includePrivate: boolean | undefined) => {
    const s = store.getSession(id)
    if (!s || (s.private && !includePrivate)) throw new DaemonError('not_found', `no session ${id}`)
    return s
  }
  const since = (v: string | undefined) => {
    if (v === undefined) return undefined
    try {
      return parseSince(v)
    } catch (err) {
      throw new DaemonError('bad_request', (err as Error).message)
    }
  }
  const bound = (v: string | undefined, name: string, def: Date): Date => {
    if (v === undefined || v === '') return def
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? localMidnight(v) : new Date(v)
    if (Number.isNaN(d.getTime())) throw new DaemonError('bad_request', `${name} must be an ISO time or date`)
    return d
  }
  const llmReady = async () => {
    const s = settings.get().llm
    if (!engine || s.provider === 'none') return false
    return engine.ready({ settings: s, apiKeyConfigured: (await settings.apiKey()) !== null })
  }
  const health = async (): Promise<ResponseOf<'health'>> => ({
    ok: true,
    version: VERSION,
    uptimeMs: Date.now() - startedAt,
    lastSeq: store.lastSeq(),
    capture: await pipeline.health(),
    models: await models.list(),
    llm: { provider: settings.get().llm.provider, ready: await llmReady() },
  })

  const handlers: Handlers = {
    health: () => health(),
    listDevices: async () => ({ devices: await devices.list() }),

    listSessions: ({ query }) => ({
      sessions: store.listSessions({
        since: since(query.since),
        limit: query.limit,
        includePrivate: query.includePrivate,
      }),
    }),
    createSession: ({ body }) => store.createSession({ title: body.title, private: body.private }),
    getSession: ({ params, query }) => visible(params.id, query.includePrivate),
    updateSession: ({ params, body }) =>
      store.updateSession(params.id, (s) => ({
        ...s,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.private !== undefined ? { private: body.private } : {}),
      })),
    deleteSession: async ({ params }) => {
      await sessions.delete(params.id)
      return { deleted: true as const }
    },
    startSession: ({ params }) => sessions.start(params.id),
    pauseSession: ({ params }) => sessions.pause(params.id),
    resumeSession: ({ params }) => sessions.resume(params.id),
    stopSession: ({ params }) => sessions.stop(params.id),

    getTranscript: ({ params, query }) => {
      const session = visible(params.id, query.includePrivate)
      const t = store.transcript(params.id, query)
      return { session, ...t }
    },
    getQaHistory: ({ params, query }) => {
      visible(params.id, query.includePrivate)
      return { messages: store.qaHistory(params.id) }
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
    ask: async ({ body }, open) => {
      const transcripts = resolveScope(store, body)
      await runAsk({ store, bus, engine, settings, logger }, body, transcripts, open())
    },
    events: async ({ query, req }, open) => {
      let from = query.since
      const header = req.headers['last-event-id']
      if (typeof header === 'string' && header.trim() !== '') {
        const n = Number(header)
        if (!Number.isInteger(n) || n < 0) throw new DaemonError('bad_request', 'Last-Event-ID must be a seq')
        from = n // the header wins: an EventSource reconnects with its original URL plus this header
      }
      if (from !== undefined && from > store.lastSeq())
        throw new DaemonError(
          'conflict',
          `cursor ${from} is ahead of the event log (lastSeq ${store.lastSeq()})`,
        )
      await streamEvents({
        store,
        bus,
        sse: open(),
        since: from,
        sessionId: query.sessionId,
        ephemeral: query.ephemeral,
        heartbeatMs,
        pageSize,
      })
    },

    listModels: async () => ({ models: await models.list() }),
    downloadModel: ({ params }) =>
      models.startDownload(params.id, (model) => bus.ephemeral(null, { type: 'model.progress', model })),

    getSettings: () => settings.view(),
    updateSettings: ({ body }) => settings.patch(body),
    setApiKey: ({ body }) => settings.setApiKey(body.key),
    diagnostics: async () => ({
      version: VERSION,
      generatedAt: new Date().toISOString(),
      health: await health(),
      logTail: logger.tail(200),
    }),

    calendarStatus: () => calendar.status(),
    listMeetings: ({ query }) => {
      const from = bound(query.from, 'from', new Date())
      const to = bound(query.to, 'to', endOfLocalDay(from))
      if (to < from) throw new DaemonError('bad_request', 'to must not be before from')
      return calendar.list(from, to, query.includeDeclined)
    },
    nextMeeting: () => calendar.next(),
    joinMeeting: ({ params, body }) => control.join(params.id, { private: body.private }),
  }

  const table = (Object.entries(routes) as [RouteName, RouteDef][]).map(([name, def]) => ({ name, def }))

  async function dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    // DNS-rebinding and drive-by-CSRF guard: only loopback Host names, and no browser origins.
    const hostname = (req.headers.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
    if (!LOOPBACK_HOSTS.has(hostname))
      throw new DaemonError('unauthorized', 'Host must be a loopback address')
    const origin = req.headers.origin
    if (origin !== undefined && !allowedOrigins.has(origin))
      throw new DaemonError('unauthorized', 'cross-origin requests are not allowed')

    const matches = table.flatMap((r) => {
      const params = matchPath(r.def.path, url.pathname)
      return params ? [{ ...r, params }] : []
    })
    if (!matches.length) throw new DaemonError('not_found', `no route ${url.pathname}`)
    const hit = matches.find((m) => m.def.method === req.method)
    if (!hit) {
      res.setHeader('allow', matches.map((m) => m.def.method).join(', '))
      throw new DaemonError('bad_request', `method ${req.method} not allowed on ${url.pathname}`, 405)
    }
    const { name, def, params } = hit
    const query = def.query ? def.query.parse(Object.fromEntries(url.searchParams)) : {}
    const body = def.body ? def.body.parse((await readJsonBody(req)) ?? {}) : undefined
    const ac = new AbortController()
    res.on('close', () => ac.abort())
    const ctx = { params, query, body, req, res, signal: ac.signal }

    if (def.response === 'sse') {
      const handler = handlers[name] as SseHandler<RouteName>
      let writer: SseWriter | null = null
      const open = () => {
        writer = new SseWriter(res, { maxBufferedBytes: o.maxSseBufferedBytes })
        sse.add(writer)
        writer.onClose(() => {
          sse.delete(writer!)
          if (writer!.dropped)
            logger.warn('dropped slow SSE client', { route: name, reason: writer!.dropped })
        })
        return writer
      }
      try {
        await handler(ctx as unknown as Ctx<RouteName>, open)
      } catch (err) {
        if (!writer) throw err
        logger.error('stream failed', { route: name, err })
        ;(writer as SseWriter).end()
      }
      return
    }
    const handler = handlers[name] as JsonHandler<RouteName>
    const result = await handler(ctx as unknown as Ctx<RouteName>)
    // Validate on the way out as well: the daemon must never be the side that drifted.
    const checked = (def.response as z.ZodType).safeParse(result)
    if (!checked.success) {
      logger.error('response failed its schema', { route: name, issues: checked.error.issues.slice(0, 5) })
      throw new DaemonError('internal', `response for ${name} failed validation`)
    }
    sendJson(res, name === 'createSession' ? 201 : 200, checked.data)
  }

  const server: Server = createServer((req, res) => {
    const t0 = Date.now()
    dispatch(req, res)
      .catch((err: unknown) => {
        const e = toDaemonError(err)
        if (e.code === 'internal')
          logger.error('request failed', { method: req.method, path: pathOf(req), err: errText(err) })
        if (res.headersSent) res.destroy()
        else
          sendJson(res, e.status, apiErrorBody(new DaemonError(e.code, logger.redact(e.message), e.status)))
      })
      .finally(() => {
        logger.debug('request', {
          method: req.method,
          path: pathOf(req),
          status: res.statusCode,
          ms: Date.now() - t0,
        })
      })
  })
  server.keepAliveTimeout = 5_000

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(o.port ?? DEFAULT_PORT, host, () => {
      server.off('error', reject)
      resolve()
    })
  })
  const port = (server.address() as AddressInfo).port
  logger.info('listening', { host, port })
  const url = `http://${host.includes(':') ? `[${host}]` : host}:${port}`

  calendar.start()
  autoRecord.start()
  const dbus = o.dbus
    ? new DbusService({
        store,
        bus,
        sessions,
        calendar,
        control,
        settings,
        logger,
        url,
        version: VERSION,
        gjs: o.dbus.gjs,
        env: o.dbus.env,
        minBackoffMs: o.dbus.minBackoffMs,
      })
    : null
  dbus?.start()

  let closing: Promise<void> | null = null
  const close = () => {
    closing ??= (async () => {
      logger.info('shutting down')
      server.close()
      autoRecord.stop()
      await dbus?.stop()
      await calendar.stop()
      await sessions.stopAll()
      for (const w of [...sse]) w.end()
      server.closeAllConnections()
      store.close()
      logger.info('stopped')
      logger.close()
    })()
    return closing
  }

  return {
    url,
    port,
    host,
    store,
    bus,
    logger,
    sessions,
    settings,
    calendar,
    control,
    dbus,
    get sseClients() {
      return sse.size
    },
    close,
  }
}

const pathOf = (req: IncomingMessage) => (req.url ?? '/').split('?')[0]
const errText = (err: unknown) =>
  err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err)
