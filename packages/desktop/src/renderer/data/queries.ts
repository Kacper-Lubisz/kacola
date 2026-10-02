import type { GnomeolaClient } from '@gnomeola/protocol'
import { fromHistory } from '@gnomeola/ui-core/qa'
import { fromSnapshot } from '@gnomeola/ui-core/sessions'
import { fromSummaries } from '@gnomeola/ui-core/speakers'
import { fromSegments } from '@gnomeola/ui-core/transcript'
import { QueryClient, queryOptions } from '@tanstack/react-query'
import { keys } from './keys.ts'

// Query definitions: one queryOptions() per resource, built on the tunnelled protocol client. Loaders
// call `qc.ensureQueryData(q.x(...))`, components `useQuery(q.x(...))` / `useSuspenseQuery` — never an
// inline queryKey. Event-driven resources (anything the EventBridge folds) are `staleTime: Infinity`:
// the bridge keeps them fresh, so a refetch would only race it.

export type Api = Pick<GnomeolaClient, 'call' | 'stream' | 'ask' | 'subscribe'>

const live = {
  staleTime: Number.POSITIVE_INFINITY,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const
/** Folded states hold Maps; React Query's structural sharing only understands plain JSON. */
const folded = { ...live, structuralSharing: false } as const

export function createQueries(api: Api) {
  return {
    health: () =>
      queryOptions({ queryKey: keys.health(), queryFn: ({ signal }) => api.call('health', { signal }) }),
    sessions: () =>
      queryOptions({
        queryKey: keys.sessions(),
        queryFn: async ({ signal }) => {
          const health = await api.call('health', { signal })
          const { sessions } = await api.call('listSessions', {
            query: { includePrivate: true, limit: 500 },
            signal,
          })
          return fromSnapshot(sessions, health.lastSeq)
        },
        ...folded,
      }),
    session: (id: string) =>
      queryOptions({
        queryKey: keys.session(id),
        queryFn: ({ signal }) =>
          api.call('getSession', { params: { id }, query: { includePrivate: true }, signal }),
        ...live,
      }),
    transcript: (id: string) =>
      queryOptions({
        queryKey: keys.transcript(id),
        queryFn: async ({ signal }) =>
          fromSegments(
            (await api.call('getTranscript', { params: { id }, query: { includePrivate: true }, signal }))
              .segments,
          ),
        ...folded,
      }),
    qa: (id: string) =>
      queryOptions({
        queryKey: keys.qa(id),
        queryFn: async ({ signal }) =>
          fromHistory(
            (await api.call('getQaHistory', { params: { id }, query: { includePrivate: true }, signal }))
              .messages,
          ),
        ...folded,
      }),
    speakers: (id: string) =>
      queryOptions({
        queryKey: keys.speakers(id),
        queryFn: async ({ signal }) =>
          fromSummaries(
            (await api.call('listSpeakers', { params: { id }, query: { includePrivate: true }, signal }))
              .speakers,
          ),
        ...folded,
      }),
    notes: (id: string) =>
      queryOptions({
        queryKey: keys.notes(id),
        queryFn: ({ signal }) =>
          api.call('getNotes', { params: { id }, query: { includePrivate: true }, signal }),
        ...live,
      }),
    noteVersions: (id: string) =>
      queryOptions({
        queryKey: keys.noteVersions(id),
        queryFn: async ({ signal }) =>
          (await api.call('listNoteVersions', { params: { id }, query: { includePrivate: true }, signal }))
            .versions,
        ...live,
      }),
    /** Built-in + custom templates, and the one suggested for this session (calendar / session title). */
    templates: (id: string) =>
      queryOptions({
        queryKey: keys.templates(id),
        queryFn: ({ signal }) =>
          api.call('listTemplates', { query: { sessionId: id, includePrivate: true }, signal }),
        ...live,
      }),
    settings: () =>
      queryOptions({
        queryKey: keys.settings(),
        queryFn: ({ signal }) => api.call('getSettings', { signal }),
        ...live,
      }),
    models: () =>
      queryOptions({
        queryKey: keys.models(),
        queryFn: async ({ signal }) => (await api.call('listModels', { signal })).models,
      }),
    devices: () =>
      queryOptions({
        queryKey: keys.devices(),
        queryFn: async ({ signal }) => (await api.call('listDevices', { signal })).devices,
      }),
    calendar: () =>
      queryOptions({
        queryKey: keys.calendar(),
        queryFn: ({ signal }) => api.call('calendarStatus', { signal }),
        // calendar.updated keeps it fresh (EventBridge.foldStatus)
        ...live,
      }),
    search: (q: string) =>
      queryOptions({
        queryKey: keys.search(q),
        queryFn: ({ signal }) => api.call('search', { query: { q, includePrivate: true }, signal }),
        enabled: q.trim() !== '',
      }),
    // ---- agendas (kacola wave 2). The views are folded from agenda.* events (EventBridge.foldAgenda);
    // the lists and the session → agenda link are invalidated by them.
    agenda: (id: string) =>
      queryOptions({
        queryKey: keys.agenda(id),
        queryFn: ({ signal }) =>
          api.call('getAgenda', { params: { id }, query: { includePrivate: true }, signal }),
        ...live,
      }),
    agendaHistory: (id: string) =>
      queryOptions({
        queryKey: keys.agendaHistory(id),
        queryFn: async ({ signal }) =>
          (await api.call('getAgendaHistory', { params: { id }, query: { includePrivate: true }, signal }))
            .changes,
        ...live,
      }),
    itemHistory: (id: string, itemId: string) =>
      queryOptions({
        queryKey: keys.itemHistory(id, itemId),
        queryFn: async ({ signal }) =>
          (
            await api.call('getAgendaItemHistory', {
              params: { id },
              query: { itemId, includePrivate: true },
              signal,
            })
          ).versions,
      }),
    moments: (q: string) =>
      queryOptions({
        queryKey: keys.moments(q),
        queryFn: ({ signal }) =>
          api.call('searchMoments', { query: { q, limit: 40, includePrivate: true }, signal }),
        enabled: q.trim() !== '',
      }),
    agendaTracker: (id: string) =>
      queryOptions({
        queryKey: keys.agendaTracker(id),
        queryFn: async ({ signal }) =>
          (await api.call('getAgendaTracker', { params: { id }, signal })).tracker,
        ...live,
      }),
    agendas: () =>
      queryOptions({
        queryKey: keys.agendas(),
        queryFn: async ({ signal }) =>
          (await api.call('listAgendas', { query: { includePrivate: true, limit: 200 }, signal })).agendas,
        ...live,
      }),
    sessionAgenda: (sessionId: string) =>
      queryOptions({
        queryKey: keys.sessionAgenda(sessionId),
        queryFn: async ({ signal }) => {
          const { agendas } = await api.call('listAgendas', {
            query: { sessionId, includePrivate: true, limit: 1 },
            signal,
          })
          return agendas[0]?.id ?? null
        },
        ...live,
      }),
    /** The calendar's next seven days; refreshed on calendar.updated and every few minutes. */
    upcoming: () =>
      queryOptions({
        queryKey: keys.upcoming(),
        queryFn: ({ signal }) => {
          const from = new Date()
          const to = new Date(from.getTime() + 7 * 86_400_000)
          return api.call('listMeetings', {
            query: { from: from.toISOString(), to: to.toISOString() },
            signal,
          })
        },
        staleTime: 60_000,
        refetchInterval: 5 * 60_000,
      }),
    /** One local day of calendar meetings (home's Today); refreshed on calendar.updated and every few minutes. */
    day: (dayStart: number) => {
      const range = {
        from: new Date(dayStart).toISOString(),
        to: new Date(dayStart + 86_400_000).toISOString(),
      }
      return queryOptions({
        queryKey: keys.meetings(range),
        queryFn: ({ signal }) => api.call('listMeetings', { query: range, signal }),
        staleTime: 60_000,
        refetchInterval: 5 * 60_000,
      })
    },
    /** Connected agents (+ the ones that ended this run, for the history); refetched on agent.presence. */
    leases: (sessionId: string) =>
      queryOptions({
        queryKey: keys.leases(sessionId),
        queryFn: async ({ signal }) =>
          (
            await api.call('listAgentLeases', {
              params: { id: sessionId },
              query: { includeEnded: true },
              signal,
            })
          ).leases,
        ...live,
      }),
    /** An agenda's sharing (team sharing): agenda.share events carry the whole status (EventBridge.foldStatus). */
    agendaShare: (id: string) =>
      queryOptions({
        queryKey: keys.agendaShare(id),
        queryFn: ({ signal }) => api.call('getAgendaShare', { params: { id }, signal }),
        ...live,
      }),
    /** The merge history of a shared agenda; refetched (while shown) when a sync finishes. */
    agendaShareHistory: (id: string) =>
      queryOptions({
        queryKey: keys.agendaShareHistory(id),
        queryFn: async ({ signal }) =>
          (await api.call('getAgendaShareHistory', { params: { id }, signal })).changes,
        ...live,
      }),
    agentAccess: (sessionId: string) =>
      queryOptions({
        queryKey: keys.agentAccess(sessionId),
        queryFn: ({ signal }) => api.call('getAgentAccess', { params: { id: sessionId }, signal }),
        ...live,
      }),
  }
}

export type Queries = ReturnType<typeof createQueries>

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // offline = the event stream is down (onlineManager follows the bridge): wait, do not fail
        networkMode: 'online',
        retry: (n, err) => n < 2 && !(err as { status?: number }).status,
        staleTime: 30_000,
      },
      mutations: { networkMode: 'online', retry: false },
    },
  })
}
