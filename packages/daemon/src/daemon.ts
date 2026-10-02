import { mkdirSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import type { ExternalCaptureHub } from '@gnomeola/capture'
import type { LlmProvider } from '@gnomeola/llm'
import {
  type BodyOut,
  DEFAULT_PORT,
  DEFAULT_RESUME_WINDOW_MS,
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
import type { AuthConfig } from '@gnomeola/server/auth'
import { Store } from '@gnomeola/store'
import type { z } from 'zod'
import pkg from '../package.json' with { type: 'json' }
import { agendaDraftHandlers } from './agendas/draft.ts'
import { agendaHandlers } from './agendas/handlers.ts'
import { agendaRecapHook } from './agendas/recap.ts'
import { AgendaService } from './agendas/service.ts'
import { type ShareConfig, SharingService } from './agendas/sharing.ts'
import { sharingHandlers } from './agendas/sharing-handlers.ts'
import { AgendaTracker, type TrackerOptions } from './agendas/tracker.ts'
import { agendaLlm, trackerHandlers } from './agendas/tracker-wiring.ts'
import { AgentChannel, type AgentLimits } from './agents/channel.ts'
import type { SpeechGuard } from './agents/guard.ts'
import { liveHandlers } from './agents/handlers.ts'
import { resolveScope, runAsk } from './ask.ts'
import { AutoRecorder } from './auto-record.ts'
import { EventBus } from './bus.ts'
import { endOfLocalDay, localMidnight } from './calendar/meetings.ts'
import { type CalendarProvider, NoCalendar } from './calendar/providers.ts'
import { CalendarService } from './calendar/service.ts'
import { RecordingControl } from './control.ts'
import { acquireDataDirLock, type DataDirLock } from './data-lock.ts'
import { DbusService } from './dbus/service.ts'
import { DecisionsService } from './decisions.ts'
import { apiErrorBody, DaemonError, toDaemonError } from './errors.ts'
import { streamEvents } from './events-stream.ts'
import { externalCaptureHandlers } from './external-capture.ts'
import { NoDevices, NoModels, UnavailablePipeline } from './fakes/providers.ts'
import { hostedHandlers, remoteAccess } from './hosted.ts'
import { readJsonBody, SseWriter, sendJson } from './http.ts'
import type { DeviceProvider, Keyring, ModelProvider, QaEngine, TranscriptionPipeline } from './interfaces.ts'
import { NoKeyring } from './keyring.ts'
import { Logger } from './logger.ts'
import type { MicActivitySource } from './mic-activity.ts'
import type { NotesEngine } from './notes/engine.ts'
import { notesHandlers } from './notes/handlers.ts'
import { RestartControl, type RestartHook } from './restart.ts'
import { SessionManager } from './sessions.ts'
import { SettingsService } from './settings.ts'
import { SpeakerService } from './speakers.ts'

export const VERSION: string = pkg.version

/** Loopback. Binding anything else needs pairing auth (`auth`, H-6; see the plan's "Hosting" section). */
export const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

export type DaemonOptions = {
  dataDir: string
  /**
   * The data dir's owner lock (./data-lock.ts), when the caller took it already (main.ts does, before
   * it opens the log). Default: createDaemon takes it, and refuses (DataDirLockedError) if another
   * daemon owns the dir. Released on close either way.
   */
  lock?: DataDirLock
  host?: string
  /** 0 = pick a free port. */
  port?: number
  pipeline?: TranscriptionPipeline
  qaEngine?: QaEngine | null
  /** M7: notes enhancement. */
  notesEngine?: NotesEngine | null
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
  /**
   * H-6 pairing auth. Required to listen on anything but loopback; then remote requests need a device
   * token and only loopback stays anonymous. null/undefined: loopback-only, as before.
   */
  auth?: AuthConfig | null
  /** With auth: treat loopback requests as the owner without a token (default true). */
  trustLoopback?: boolean
  // ---- P: platform
  /** External capture (macOS): recordings waiting for audio from the app, fed by the ingest route. */
  externalCapture?: ExternalCaptureHub | null
  // ---- agendas
  /** Base URL of the hosted agenda page (`<base>/a/<token>`) a SHARED agenda's invitation block carries.
   *  Default GNOMEOLA_AGENDA_WEB_BASE, else the sharing host. An unshared agenda has no web link. */
  agendaWebBase?: string | null
  // ---- agent channel (leases, live attach)
  /** Applied to live speech before it reaches agents. Default: pass-through (see agents/guard.ts). */
  speechGuard?: SpeechGuard | null
  /** Lease timeouts and per-lease rate limits (tests shorten them). */
  agentLimits?: Partial<AgentLimits>
  /** At most one partial per track per this many ms reaches an agent (default 1500). */
  livePartialEveryMs?: number
  // ---- Agendas wave 1B: decisions
  /** The installed text-embedding model's directory (null = not downloaded: hashing fallback). */
  decisionEmbedderDir?: () => Promise<string | null>
  // ---- Agendas wave 2: the live tracker
  /** Tracker tuning (tests shorten the periods); false = no tracker. */
  tracker?: TrackerOptions | false
  /** Test seam: the text LLM for bridge lines and recaps. Default: the Q&A provider from settings + key. */
  agendaLlm?: () => Promise<LlmProvider | null>
  // ---- kacola phase 5: team sharing
  /** The hosted server agendas are shared on, and sync timing. Default from the environment
   *  (GNOMEOLA_SHARE_URL / _TOKEN, else GNOMEOLA_SYNC_URL / _TOKEN; GNOMEOLA_OWNER_NAME / _EMAIL). */
  share?: Partial<ShareConfig>
  // ---- sticky daemon: restarts that wait for the recording, recordings that survive a restart
  /**
   * Continue a recording the previous daemon left mid-meeting (suspended by SIGTERM, or a crash) if it
   * stopped at most this long ago. Default GNOMEOLA_RESUME_WINDOW_MS, else 2 minutes; 0 = never resume.
   */
  resumeWindowMs?: number
  /** How POST /daemon/restart restarts the process (main.ts: close, exit 76). Default: refused. */
  onRestart?: RestartHook | null
  /** Running under a supervisor that starts the daemon again after it exits (reported on /daemon). */
  supervised?: boolean
}

export type CloseOptions = {
  /**
   * Leave live recordings resumable (suspendAll) instead of stopping them: SIGTERM, restarts. Agents'
   * leases end silently (their `live attach` re-attaches to the next daemon), not as "meeting ended".
   */
  suspend?: boolean
  /** With `suspend`: false when the user's session is ending — the next daemon closes the recording out. */
  resume?: boolean
  reason?: string
}

export type Daemon = {
  readonly url: string
  readonly port: number
  readonly host: string
  readonly store: Store
  /** This daemon's hold on its data dir. */
  readonly lock: DataDirLock
  readonly bus: EventBus
  readonly logger: Logger
  readonly sessions: SessionManager
  readonly settings: SettingsService
  readonly calendar: CalendarService
  readonly control: RecordingControl
  readonly dbus: DbusService | null
  readonly speakers: SpeakerService
  readonly agendas: AgendaService
  /** The agent channel: leases, presence, the SpeechGuard seam (`agents.setGuard`, `agents.guard`). */
  readonly agents: AgentChannel
  /** Agendas wave 1B: the typed-decision provider the settings select. */
  readonly decisions: DecisionsService
  /** Agendas wave 2: the live tracker (null when switched off); `tracker.guard` is the SpeechGuard. */
  readonly tracker: AgendaTracker | null
  /** Team sharing: shared agendas and the ones this device follows. */
  readonly sharing: SharingService
  /** Restarts that wait for the recording (/daemon routes). */
  readonly restart: RestartControl
  /** Settles once the recordings the previous daemon left (if any) have been resumed or closed out. */
  readonly resuming: Promise<void>
  /** Open SSE connections. */
  readonly sseClients: number
  close(o?: CloseOptions): Promise<void>
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
  if (!LOOPBACK_HOSTS.has(host) && !o.auth)
    throw new Error(
      `refusing to listen on ${host} without pairing auth: remote requests must carry a token (start with --remote)`,
    )
  // One owner per data dir, before anything touches it: the log, the database, recovery.
  const lock = o.lock ?? acquireDataDirLock(o.dataDir)
  try {
    return await compose(o, host, lock)
  } catch (err) {
    lock.release()
    throw err
  }
}

async function compose(o: DaemonOptions, host: string, lock: DataDirLock): Promise<Daemon> {
  mkdirSync(o.dataDir, { recursive: true, mode: 0o700 })
  const env = o.env ?? process.env
  const logger = o.logger ?? new Logger({ file: join(o.dataDir, 'logs', 'gnomeolad.log'), echo: o.echoLogs })
  const store = Store.open(join(o.dataDir, 'gnomeola.db'))
  const bus = new EventBus()
  store.onCommit((e) => bus.publish(e))
  const access = remoteAccess(store, o.auth ?? null, o.trustLoopback ?? true)
  const pipeline = o.pipeline ?? new UnavailablePipeline()
  const models = o.models ?? new NoModels()
  const devices = o.devices ?? new NoDevices()
  const engine = o.qaEngine ?? null
  const settings = new SettingsService({ store, keyring: o.keyring ?? new NoKeyring(), env, logger })
  const decisions = new DecisionsService({
    settings,
    logger,
    ...(o.decisionEmbedderDir ? { embedderDir: o.decisionEmbedderDir } : {}),
  })
  // M3: the speaker service and the session manager need each other; bound late.
  let speakers: SpeakerService | null = null
  const sessions = new SessionManager({
    store,
    bus,
    pipeline,
    logger,
    dataDir: o.dataDir,
    settings: () => settings.get(),
    knownVoices: () => speakers?.knownVoices() ?? [],
    onVoices: (id, v) => speakers?.recordingVoices(id, v),
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
  speakers = new SpeakerService({ store, sessions, settings: () => settings.get(), logger })
  const spk = speakers
  const agendas = new AgendaService({ store, calendar, logger })
  agendas.start()
  // ---- kacola phase 5: team sharing (push the projection, mirror what others did)
  const sharing = new SharingService({
    store,
    agendas,
    bus,
    logger,
    dataDir: o.dataDir,
    config: {
      url: o.share?.url ?? (env.GNOMEOLA_SHARE_URL || env.GNOMEOLA_SYNC_URL || null),
      token: o.share?.token ?? (env.GNOMEOLA_SHARE_TOKEN || env.GNOMEOLA_SYNC_TOKEN || null),
      webBase: o.agendaWebBase !== undefined ? o.agendaWebBase : env.GNOMEOLA_AGENDA_WEB_BASE || null,
      ownerName: o.share?.ownerName ?? (env.GNOMEOLA_OWNER_NAME || null),
      ownerLabel: o.share?.ownerLabel ?? (env.GNOMEOLA_OWNER_EMAIL || null),
      pollMs: o.share?.pollMs ?? Number(env.GNOMEOLA_SHARE_POLL_MS ?? 15_000),
      debounceMs: o.share?.debounceMs ?? Number(env.GNOMEOLA_SHARE_DEBOUNCE_MS ?? 500),
      ...(o.share?.fetch ? { fetch: o.share.fetch } : {}),
    },
  })
  sharing.start()
  // ---- Agendas wave 2: the live tracker + the recap
  const llmFor = agendaLlm(settings, o.agendaLlm)
  const tracker =
    o.tracker === false
      ? null
      : new AgendaTracker({
          store,
          agendas: agendas.agendas,
          bus,
          logger,
          decisions,
          llm: async (sessionId) => (await llmFor(store.getSession(sessionId))).provider,
          options: o.tracker ?? {},
        })
  tracker?.start()
  agendas.onRecap(agendaRecapHook({ store, agendas: agendas.agendas, tracker, logger, llm: llmFor }))
  const agents = new AgentChannel({
    store,
    bus,
    agendas,
    settings,
    logger,
    // the tracker's decision-based guard screens live speech before any agent sees it
    guard: o.speechGuard ?? tracker?.guard ?? undefined,
    limits: o.agentLimits,
  })
  agents.start()
  const heartbeatMs = o.heartbeatMs ?? 15_000
  const pageSize = o.replayPageSize ?? 500
  const allowedOrigins = new Set(o.allowedOrigins ?? [])
  const startedAt = Date.now()
  const sse = new Set<SseWriter>()

  const resumeWindowMs =
    o.resumeWindowMs ??
    (env.GNOMEOLA_RESUME_WINDOW_MS !== undefined && env.GNOMEOLA_RESUME_WINDOW_MS !== ''
      ? Math.max(0, Number(env.GNOMEOLA_RESUME_WINDOW_MS) || 0)
      : DEFAULT_RESUME_WINDOW_MS)
  const plan = sessions.recover(lock, {
    resumeWindowMs,
    lastAliveAt: lock.takenOverFrom?.lastAliveAt ?? null,
  })
  logger.info('daemon starting', {
    version: VERSION,
    dataDir: o.dataDir,
    lastSeq: store.lastSeq(),
    recovered: plan.recovered.length,
    closed: plan.closed.length,
    resuming: plan.resumable.map((r) => ({ id: r.id, how: r.how, gapMs: r.gapMs })),
    ...(lock.takenOverFrom ? { staleLockFrom: lock.takenOverFrom.owner?.pid ?? null } : {}),
  })
  const restart = new RestartControl({
    store,
    bus,
    sessions,
    logger,
    dataDir: o.dataDir,
    version: VERSION,
    startedAt: new Date(startedAt),
    onRestart: o.onRestart ?? null,
    supervised: o.supervised ?? false,
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
    decisions: await decisions.health(),
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
      const scope = resolveScope(store, body, settings.get().llm)
      await runAsk({ store, bus, engine, settings, logger }, body, scope, open())
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
    setApiKey: ({ body }) => settings.setApiKey(body.key, body.provider),
    diagnostics: async () => ({
      version: VERSION,
      generatedAt: new Date().toISOString(),
      health: await health(),
      logTail: logger.tail(200),
    }),

    calendarStatus: () => calendar.status(),
    listMeetings: async ({ query }) => {
      const from = bound(query.from, 'from', new Date())
      const to = bound(query.to, 'to', endOfLocalDay(from))
      if (to < from) throw new DaemonError('bad_request', 'to must not be before from')
      return calendar.list(from, to, query.includeDeclined)
    },
    nextMeeting: () => calendar.next(),
    joinMeeting: ({ params, body }) => control.join(params.id, { private: body.private }),
    // ---- M7: notes + enhancement
    ...notesHandlers({ store, engine: o.notesEngine ?? null, settings, logger, visible }),
    // ---- M3: attribution
    listSpeakers: ({ params, query }) => {
      visible(params.id, query.includePrivate)
      return { speakers: spk.list(params.id) }
    },
    renameSpeaker: ({ params, body }) => spk.rename(params.id, params.speakerId, body.label),
    mergeSpeaker: ({ params, body }) => spk.merge(params.id, params.speakerId, body.into),
    splitSpeaker: ({ params, body }) => spk.split(params.id, params.speakerId, body.segmentIds),
    listVoiceprints: () => ({ voiceprints: spk.voiceprints() }),
    deleteVoiceprint: ({ params }) => {
      spk.deleteVoiceprint(params.id)
      return { deleted: true as const }
    },

    ...hostedHandlers(access),
    // ---- P: platform — external capture ingest
    ...externalCaptureHandlers(o.externalCapture ?? null),
    // ---- agendas, deep links, the invite block; the agent channel (leases, live attach)
    ...agendaHandlers(agendas, agents),
    ...liveHandlers({
      store,
      bus,
      channel: agents,
      heartbeatMs,
      pageSize,
      partialEveryMs: o.livePartialEveryMs ?? 1500,
    }),
    // ---- Agendas wave 2: the live tracker's status
    ...trackerHandlers(agendas, tracker),
    // ---- Agendas wave 2: drafting (Plan with Claude)
    ...agendaDraftHandlers({ store, agendas: agendas.agendas, settings, logger }),
    // ---- kacola phase 5: team sharing (share / follow / status / merge history)
    ...sharingHandlers(sharing, agents, (id) => {
      if (!agendas.agendas.get(id)) throw new DaemonError('not_found', `no agenda ${id}`)
    }),
    // ---- sticky daemon: who owns the dir, what is live, restarts that wait for the recording
    daemonInfo: () => restart.info(),
    requestRestart: ({ body }) => restart.request(body),
    cancelRestart: () => restart.cancel(),
  }

  const table = (Object.entries(routes) as [RouteName, RouteDef][]).map(([name, def]) => ({ name, def }))

  async function dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    // DNS-rebinding and drive-by-CSRF guard: only loopback Host names (unless pairing auth is on, when
    // any Host may connect but must authenticate), and no browser origins.
    const hostname = (req.headers.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
    if (!access.auth && !LOOPBACK_HOSTS.has(hostname))
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
    // H-6: authenticate before parsing anything — an unauthenticated remote caller learns nothing.
    try {
      await access.authenticate(req, name)
    } catch (err) {
      res.setHeader('www-authenticate', 'Bearer realm="gnomeola"')
      throw err
    }
    // Agent channel: a request carrying a lease token is a connected agent, and reaches only the routes
    // an agent may use (its own recording's reads, the agenda verbs, its lease), whatever it asks for.
    agents.gate(req, name, params)
    // P-3: a raw-body route streams its request to the handler; nothing else may be sent to it
    if (
      def.rawBody !== undefined &&
      (req.headers['content-type'] ?? '').split(';')[0]!.trim() !== def.rawBody
    )
      throw new DaemonError('bad_request', `${name} takes ${def.rawBody}`, 415)
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
    sendJson(res, name === 'createSession' || name === 'createAgenda' ? 201 : 200, checked.data)
  }

  const server: Server = createServer((req, res) => {
    const t0 = Date.now()
    dispatch(req, res)
      .catch((err: unknown) => {
        const e = toDaemonError(err)
        if (e.code === 'internal')
          logger.error('request failed', { method: req.method, path: pathOf(req), err: errText(err) })
        if (res.headersSent) res.destroy()
        else sendJson(res, e.status, apiErrorBody(e.withMessage(logger.redact(e.message))))
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

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(o.port ?? DEFAULT_PORT, host, () => {
        server.off('error', reject)
        resolve()
      })
    })
  } catch (err) {
    // e.g. EADDRINUSE: nothing else of ours is running yet; leave the dir as we found it
    tracker?.stop()
    await sharing.stop()
    agendas.stop()
    agents.stop()
    store.close()
    logger.error('could not listen', { host, port: o.port ?? DEFAULT_PORT, err: (err as Error).message })
    logger.close()
    throw err
  }
  const port = (server.address() as AddressInfo).port
  logger.info('listening', { host, port })
  lock.setAddress(host, port)
  // the "last alive" mark a successor reads after a crash (see data-lock.ts)
  const heartbeat = setInterval(() => lock.heartbeat(), 5_000)
  heartbeat.unref()
  // The URL local clients (the harness, D-Bus bridge, `listening` line) should use: a wildcard bind is
  // reached over loopback, where the owner needs no token.
  const localHost = host === '0.0.0.0' ? '127.0.0.1' : host === '::' ? '::1' : host
  const url = `http://${localHost.includes(':') ? `[${localHost}]` : localHost}:${port}`

  // the recordings the previous daemon left mid-meeting carry on (before auto-record looks for work: a
  // session waiting to resume is live in the database, so nothing else starts in its place)
  const resuming = Promise.all(plan.resumable.map((r) => sessions.continueAfterRestart(r))).then(() => {})
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
  const close = (co: CloseOptions = {}) => {
    closing ??= (async () => {
      logger.info('shutting down', co.suspend ? { suspend: true, reason: co.reason } : {})
      server.close()
      restart.stop()
      autoRecord.stop()
      tracker?.stop()
      await sharing.stop()
      agendas.stop()
      agents.stop({ silent: co.suspend })
      await dbus?.stop()
      await calendar.stop()
      await resuming
      if (co.suspend) await sessions.suspendAll(co.reason ?? 'shutdown', undefined, { resume: co.resume })
      else await sessions.stopAll()
      for (const w of [...sse]) w.end()
      server.closeAllConnections()
      store.close()
      clearInterval(heartbeat)
      lock.release()
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
    lock,
    bus,
    logger,
    sessions,
    decisions,
    settings,
    calendar,
    control,
    dbus,
    speakers: spk,
    agendas,
    agents,
    tracker,
    sharing,
    restart,
    resuming,
    get sseClients() {
      return sse.size
    },
    close,
  }
}

const pathOf = (req: IncomingMessage) => (req.url ?? '/').split('?')[0]
const errText = (err: unknown) =>
  err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err)
