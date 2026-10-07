import type { AnyEvent, DurableEvent } from '@kacola/protocol'
import type { Store } from '@kacola/store'
import type { EventBus } from './bus.ts'
import type { SseWriter } from './http.ts'

// GET /events: replay durable events after a cursor from the store, then go live from the bus, with no
// gap and no duplicate at the seam.
//
// The seam is handled the textbook way, so it stays correct even if replay reads become asynchronous
// (a remote database) or slow (a long history, paged, yielding to the event loop between pages):
//
//   1. subscribe to the bus FIRST, buffering everything that arrives;
//   2. replay from the store in pages until a page comes back empty — anything committed meanwhile is
//      either in a later page or in the buffer, or both;
//   3. drain the buffer, dropping durable events at or below the cursor (already sent);
//   4. switch to direct delivery — synchronously, so nothing can slip between 3 and 4.
//
// Every durable event goes out with an `id:` line (its seq) so EventSource-style clients resume with
// Last-Event-ID; ephemeral events carry none.

export type EventStreamOptions = {
  store: Store
  bus: EventBus
  sse: SseWriter
  /** Replay durable events with seq > since; undefined = only new events. */
  since: number | undefined
  sessionId?: string
  ephemeral: boolean
  heartbeatMs: number
  pageSize: number
}

export async function streamEvents(o: EventStreamOptions): Promise<void> {
  const { store, bus, sse } = o
  const matches = (e: AnyEvent) =>
    (o.ephemeral || e.seq !== null) && (o.sessionId === undefined || e.sessionId === o.sessionId)

  const buffer: AnyEvent[] = []
  let live = false
  let cursor = 0

  const deliver = (e: AnyEvent) => {
    if (e.seq !== null) {
      if (e.seq <= cursor) return // already sent during replay
      cursor = e.seq
      sse.send({ id: String(e.seq), data: JSON.stringify(e) })
    } else {
      sse.send({ data: JSON.stringify(e) })
    }
  }

  // (1) subscribe before reading anything
  const unsubscribe = bus.subscribe((e) => {
    if (!matches(e)) return
    if (live) deliver(e)
    else buffer.push(e)
  })
  const heartbeat = setInterval(() => {
    if (o.ephemeral)
      sse.send({
        data: JSON.stringify({
          seq: null,
          at: new Date().toISOString(),
          sessionId: null,
          data: { type: 'heartbeat', lastSeq: store.lastSeq() },
        } satisfies AnyEvent),
      })
    else sse.comment('heartbeat')
  }, o.heartbeatMs)
  heartbeat.unref()
  sse.onClose(() => {
    unsubscribe()
    clearInterval(heartbeat)
    buffer.length = 0
  })

  // A comment first: flushes headers through any proxy and tells the client the stream is up.
  sse.comment(`kacola events; lastSeq=${store.lastSeq()}`)

  if (o.since === undefined) {
    // only new events: everything already committed is behind us. Say where "now" is (a data-less id
    // line), so the client can resume from exactly here if this connection dies.
    cursor = store.lastSeq()
    sse.send({ id: String(cursor), data: '' })
  } else {
    cursor = o.since
    // (2) replay in pages
    for (;;) {
      if (sse.closed) return
      const page: DurableEvent[] = store.eventsAfter(cursor, { limit: o.pageSize, sessionId: o.sessionId })
      if (!page.length) break
      for (const e of page) deliver(e)
      // yield between pages: lets writers commit (exercising the seam) and the socket drain
      await sse.drained()
      await new Promise((r) => setImmediate(r))
    }
  }
  if (sse.closed) return
  // (3) + (4): drain and go live, synchronously
  for (const e of buffer.splice(0)) deliver(e)
  live = true
  await sse.whenClosed()
}
