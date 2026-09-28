import type { AnyEvent, Session } from '@gnomeola/protocol'

// Where the UI's data comes from. Two implementations: the real daemon over the protocol client,
// and an in-process demo that fabricates a live-updating list (GNOMEOLA_UI_DEMO=1). The store and
// every component see only this interface, so the demo exercises exactly the UI code the daemon does.

export type Snapshot = {
  sessions: Session[]
  /** The durable seq the snapshot is known to include; subscribe from here. */
  seq: number
}

export type SubscribeHandlers = {
  since: number
  signal: AbortSignal
  onEvent: (e: AnyEvent) => void
  onConnect: () => void
  onDisconnect: (err: unknown) => void
}

export interface DataSource {
  /** Human-readable origin for status text: a URL, or "demo". */
  readonly origin: string
  load(signal: AbortSignal): Promise<Snapshot>
  /** Stream events after `since` until the signal aborts, reconnecting on its own. */
  subscribe(h: SubscribeHandlers): Promise<void>
  /** Create a session and start recording it. */
  startRecording(): Promise<Session>
  stopRecording(id: string): Promise<Session>
}
