import { z } from 'zod'
import { CalendarStatus, JoinMeetingBody, ListMeetingsQuery, MeetingList, NextMeeting } from './calendar.ts'
import { notesRoutes } from './notes.ts'
import {
  ApiError,
  AudioDevice,
  Health,
  ModelInfo,
  QaMessage,
  SearchHit,
  Segment,
  Session,
  Settings,
  SettingsPatch,
  TrackKind,
} from './schemas.ts'

// The route table is the contract. The daemon registers handlers against it and the typed client is
// derived from it, so a drift between the two is a compile error (T1) and a parse error at runtime.

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
export type RouteDef = {
  method: Method
  path: string
  query?: z.ZodType
  body?: z.ZodType
  /** A schema for JSON routes, or 'sse' for streaming routes. */
  response: z.ZodType | 'sse'
}

// Query booleans arrive as strings on the wire but clients should be able to pass real booleans.
const qbool = z.union([z.boolean(), z.stringbool()])
const flag = qbool.optional()
const limit = (def: number, max: number) => z.coerce.number().int().min(1).max(max).default(def)

export const ListSessionsQuery = z.object({
  since: z.string().optional(),
  limit: limit(50, 500),
  includePrivate: flag,
})
export const CreateSessionBody = z.object({
  title: z.string().max(200).optional(),
  private: z.boolean().optional(),
})
export const UpdateSessionBody = z.object({
  title: z.string().min(1).max(200).optional(),
  private: z.boolean().optional(),
})

/**
 * A window selects every segment that overlaps it, inclusive at both ends: endMs >= fromMs and
 * startMs <= toMs. (Found as drift between the CLI's fake daemon and the real store — now the contract.)
 */
export const TranscriptQuery = z.object({
  fromMs: z.coerce.number().int().nonnegative().optional(),
  toMs: z.coerce.number().int().nonnegative().optional(),
  speaker: z.string().optional(),
  track: TrackKind.optional(),
  quality: z.enum(['live', 'final', 'best']).default('best'),
  includePrivate: flag,
})
export const Transcript = z.object({
  session: Session,
  segments: z.array(Segment),
  /** The window that was applied, or null for the whole session. */
  window: z.object({ fromMs: z.int().nonnegative(), toMs: z.int().nonnegative() }).nullable(),
  /** Segments in the whole session, so a client can tell how much it did not fetch. */
  total: z.int().nonnegative(),
})
export type Transcript = z.infer<typeof Transcript>

export const SearchQuery = z.object({
  q: z.string().min(1).max(500),
  since: z.string().optional(),
  sessionId: z.string().optional(),
  speaker: z.string().optional(),
  limit: limit(20, 100),
  includePrivate: flag,
})
export const SearchResult = z.object({ hits: z.array(SearchHit), total: z.int().nonnegative() })
export type SearchResult = z.infer<typeof SearchResult>

export const Effort = z.enum(['low', 'medium', 'high'])
export const AskBody = z.object({
  question: z.string().min(1).max(4000),
  /** Ask about one session… */
  sessionId: z.string().optional(),
  /** …or across every session since a bound (ISO or duration like `7d`). */
  since: z.string().optional(),
  effort: Effort.default('low'),
  includePrivate: z.boolean().optional(),
})
export type AskBody = z.infer<typeof AskBody>

/** Messages on the /ask stream, in order: question, delta*, (answer | error). */
export const AskStreamEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('question'), message: QaMessage }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('answer'), message: QaMessage }),
  z.object({ type: z.literal('error'), error: ApiError.shape.error }),
])
export type AskStreamEvent = z.infer<typeof AskStreamEvent>

export const EventsQuery = z.object({
  /** Replay durable events with seq > since, then go live. Omit to receive only new events. */
  since: z.coerce.number().int().nonnegative().optional(),
  sessionId: z.string().optional(),
  ephemeral: qbool.default(true),
})

export const routes = {
  health: { method: 'GET', path: '/health', response: Health },
  listDevices: { method: 'GET', path: '/devices', response: z.object({ devices: z.array(AudioDevice) }) },

  listSessions: {
    method: 'GET',
    path: '/sessions',
    query: ListSessionsQuery,
    response: z.object({ sessions: z.array(Session) }),
  },
  createSession: { method: 'POST', path: '/sessions', body: CreateSessionBody, response: Session },
  getSession: {
    method: 'GET',
    path: '/sessions/:id',
    query: z.object({ includePrivate: flag }),
    response: Session,
  },
  updateSession: { method: 'PATCH', path: '/sessions/:id', body: UpdateSessionBody, response: Session },
  deleteSession: {
    method: 'DELETE',
    path: '/sessions/:id',
    response: z.object({ deleted: z.literal(true) }),
  },
  startSession: { method: 'POST', path: '/sessions/:id/start', response: Session },
  pauseSession: { method: 'POST', path: '/sessions/:id/pause', response: Session },
  resumeSession: { method: 'POST', path: '/sessions/:id/resume', response: Session },
  stopSession: { method: 'POST', path: '/sessions/:id/stop', response: Session },

  getTranscript: {
    method: 'GET',
    path: '/sessions/:id/transcript',
    query: TranscriptQuery,
    response: Transcript,
  },
  getQaHistory: {
    method: 'GET',
    path: '/sessions/:id/qa',
    query: z.object({ includePrivate: flag }),
    response: z.object({ messages: z.array(QaMessage) }),
  },
  search: { method: 'GET', path: '/search', query: SearchQuery, response: SearchResult },
  ask: { method: 'POST', path: '/ask', body: AskBody, response: 'sse' },
  events: { method: 'GET', path: '/events', query: EventsQuery, response: 'sse' },

  listModels: { method: 'GET', path: '/models', response: z.object({ models: z.array(ModelInfo) }) },
  downloadModel: { method: 'POST', path: '/models/:id/download', response: ModelInfo },

  getSettings: { method: 'GET', path: '/settings', response: Settings },
  updateSettings: { method: 'PATCH', path: '/settings', body: SettingsPatch, response: Settings },
  setApiKey: {
    method: 'PUT',
    path: '/settings/api-key',
    body: z.object({ key: z.string().min(1).nullable() }),
    response: z.object({ configured: z.boolean() }),
  },
  diagnostics: {
    method: 'GET',
    path: '/diagnostics',
    response: z.object({
      version: z.string(),
      generatedAt: z.string(),
      health: Health,
      logTail: z.array(z.string()),
    }),
  },

  // ---- M4: top bar + calendar
  calendarStatus: { method: 'GET', path: '/calendar', response: CalendarStatus },
  listMeetings: { method: 'GET', path: '/meetings', query: ListMeetingsQuery, response: MeetingList },
  nextMeeting: { method: 'GET', path: '/meetings/next', response: NextMeeting },
  /** Create a session titled and linked to the meeting, start recording it, and hand back the join link
   *  for the caller to open (the caller owns the desktop: the Shell extension, the window). */
  joinMeeting: {
    method: 'POST',
    path: '/meetings/:id/join',
    body: JoinMeetingBody,
    response: z.object({ session: Session, joinUrl: z.string().nullable() }),
  },
  // ---- M7: notes + enhancement (schemas in notes.ts)
  ...notesRoutes,
} as const satisfies Record<string, RouteDef>

export type Routes = typeof routes
export type RouteName = keyof Routes

// ---- type plumbing for handlers and the client ---------------------------------------------------

type PathParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | PathParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never

export type ParamsOf<N extends RouteName> = [PathParamNames<Routes[N]['path']>] extends [never]
  ? Record<string, never>
  : { [K in PathParamNames<Routes[N]['path']>]: string }

type SchemaIn<T> = T extends z.ZodType ? z.input<T> : never
type SchemaOut<T> = T extends z.ZodType ? z.output<T> : never

export type QueryIn<N extends RouteName> = Routes[N] extends { query: infer Q } ? SchemaIn<Q> : never
export type QueryOut<N extends RouteName> = Routes[N] extends { query: infer Q } ? SchemaOut<Q> : never
export type BodyIn<N extends RouteName> = Routes[N] extends { body: infer B } ? SchemaIn<B> : never
export type BodyOut<N extends RouteName> = Routes[N] extends { body: infer B } ? SchemaOut<B> : never
export type ResponseOf<N extends RouteName> = Routes[N]['response'] extends z.ZodType
  ? z.output<Routes[N]['response']>
  : never

export type JsonRouteName = { [N in RouteName]: Routes[N]['response'] extends 'sse' ? never : N }[RouteName]
export type SseRouteName = { [N in RouteName]: Routes[N]['response'] extends 'sse' ? N : never }[RouteName]

export function buildPath(path: string, params: Record<string, string> = {}): string {
  return path.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const v = params[name]
    if (v === undefined) throw new Error(`missing path param :${name} for ${path}`)
    return encodeURIComponent(v)
  })
}

/** Match a concrete URL path against a route template; returns params or null. */
export function matchPath(template: string, actual: string): Record<string, string> | null {
  const t = template.split('/')
  const a = actual.split('/')
  if (t.length !== a.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < t.length; i++) {
    const seg = t[i]!
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(a[i]!)
    else if (seg !== a[i]) return null
  }
  return params
}
