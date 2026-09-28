import { createClient, type GnomeolaClient } from '@gnomeola/protocol'
import type { DataSource, Snapshot, SubscribeHandlers } from './source.ts'

// The real thing: every byte from the daemon, through the typed protocol client.

export type DaemonSourceOptions = {
  baseUrl: string
  /** Per-request timeout for JSON calls, so an unresponsive daemon becomes an error, not a hang. */
  timeoutMs?: number
  fetch?: typeof fetch
}

export function createDaemonSource(opts: DaemonSourceOptions): DataSource {
  const client: GnomeolaClient = createClient({
    baseUrl: opts.baseUrl,
    timeoutMs: opts.timeoutMs ?? 5000,
    fetch: opts.fetch,
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
      return { sessions, seq: health.lastSeq }
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
  }
}
