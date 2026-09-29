import { createClient, enhanceEvents, type GnomeolaClient } from '@gnomeola/protocol'
import type { DataSource, Snapshot, SubscribeHandlers } from './source.ts'

// The real thing: every byte from the daemon, through the typed protocol client.

export type DaemonSourceOptions = {
  baseUrl: string
  /** Per-request timeout for JSON calls, so an unresponsive daemon becomes an error, not a hang. */
  timeoutMs?: number
  fetch?: typeof fetch
  /** Device token for a remote gnomeola (M8). */
  token?: string
}

export function createDaemonSource(opts: DaemonSourceOptions): DataSource {
  const client: GnomeolaClient = createClient({
    baseUrl: opts.baseUrl,
    timeoutMs: opts.timeoutMs ?? 5000,
    fetch: opts.fetch,
    ...(opts.token ? { token: opts.token } : {}),
  })
  return {
    origin: client.baseUrl,
    async load(signal): Promise<Snapshot> {
      // Read the cursor *before* the list: the snapshot then contains at least everything up to
      // `lastSeq`, and replaying from there converges on the latest state (upserts are whole objects).
      const health = await client.call('health', { signal })
      const { sessions } = await client.call('listSessions', {
        query: { includePrivate: true, limit: 500 },
        signal,
      })
      return { sessions, seq: health.lastSeq, health }
    },
    subscribe(h: SubscribeHandlers) {
      return client.subscribe({
        since: h.since,
        signal: h.signal,
        ephemeral: true,
        onEvent: h.onEvent,
        onConnect: h.onConnect,
        onDisconnect: h.onDisconnect,
        reconnectDelayMs: 1000,
      })
    },
    async startRecording() {
      const created = await client.call('createSession', { body: {} })
      return client.call('startSession', { params: { id: created.id } })
    },
    stopRecording(id) {
      return client.call('stopSession', { params: { id } })
    },
    transcript(id, signal) {
      return client.call('getTranscript', { params: { id }, query: { includePrivate: true }, signal })
    },
    async qaHistory(id, signal) {
      return (await client.call('getQaHistory', { params: { id }, query: { includePrivate: true }, signal }))
        .messages
    },
    ask(body, signal) {
      return client.ask(body, signal)
    },
    health: (signal) => client.call('health', { signal }),
    getSettings: (signal) => client.call('getSettings', { signal }),
    updateSettings: (patch) => client.call('updateSettings', { body: patch }),
    setApiKey: (key) => client.call('setApiKey', { body: { key } }),
    async listDevices(signal) {
      return (await client.call('listDevices', { signal })).devices
    },
    async listModels(signal) {
      return (await client.call('listModels', { signal })).models
    },
    downloadModel: (id) => client.call('downloadModel', { params: { id } }),
    calendarStatus: (signal) => client.call('calendarStatus', { signal }),

    notes: (id, signal) =>
      client.call('getNotes', { params: { id }, query: { includePrivate: true }, signal }),
    putNotes: (id, body) => client.call('putNotes', { params: { id }, body }),
    enhanceNotes: (id, body, signal) =>
      enhanceEvents(client.stream('enhanceNotes', { params: { id }, body, signal })),
    mergeNotes: (id, body) => client.call('mergeNotes', { params: { id }, body }),
    templates: (id, signal) =>
      client.call('listTemplates', { query: { sessionId: id, includePrivate: true }, signal }),
  }
}
