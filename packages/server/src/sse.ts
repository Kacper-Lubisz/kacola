import { type AnyEvent, encodeSse, encodeSseComment } from '@gnomeola/protocol'
import type { StoreApi } from '@gnomeola/store/core'

// H-4 — GET /events on a stateless host. There is no in-process bus to go live from (the writer may be
// another function instance, or another region), so the stream IS the log: page `seq > cursor` from
// the store, sleep, page again. That removes the replay→live seam altogether — there is only replay —
// and exactness then rests on one store property the contract suite pins on both dialects: commits
// become visible in seq order, so a page never skips a seq that a later page would reveal.
//
// Every stream ends on its own before the platform kills it (`maxStreamMs`, set below the function's
// maxDuration). The client reconnects with its cursor (Last-Event-ID / ?since=) and resumes exactly.
// V-8 fuzzes this with random kills and a deliberately tiny cap.
//
// In-process commits (the Node server, tests) wake a sleeping stream immediately via onCommit; on
// Vercel the poll interval bounds latency instead.

export type EventStreamOptions = {
  store: StoreApi
  since: number | undefined
  sessionId?: string
  ephemeral: boolean
  signal: AbortSignal
  /** End the stream after this long (the host's duration cap minus a margin). */
  maxStreamMs: number
  pollMs: number
  heartbeatMs: number
  pageSize: number
}

const sleep = (ms: number, signal: AbortSignal, wake: Promise<void>) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(done, Math.max(0, ms))
    function done() {
      clearTimeout(t)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
    void wake.then(done)
  })

export async function* eventStream(o: EventStreamOptions): AsyncGenerator<string> {
  const { store, signal } = o
  const started = Date.now()
  const deadline = started + o.maxStreamMs
  let wake: () => void = () => {}
  let woken = new Promise<void>((r) => {
    wake = r
  })
  const off = store.onCommit(() => wake())
  try {
    const last = await store.lastSeq()
    let cursor = o.since ?? last
    yield encodeSseComment(`gnomeola events; lastSeq=${last}; maxStreamMs=${o.maxStreamMs}`)
    let lastBeat = Date.now()
    while (!signal.aborted) {
      // re-arm the wake-up BEFORE reading, so a commit landing during the read is not missed
      woken = new Promise<void>((r) => {
        wake = r
      })
      const page = await store.eventsAfter(cursor, { limit: o.pageSize, sessionId: o.sessionId })
      for (const e of page) {
        if (signal.aborted) return
        cursor = e.seq
        yield encodeSse({ id: String(e.seq), data: JSON.stringify(e) })
      }
      if (page.length === o.pageSize) continue
      const now = Date.now()
      if (now >= deadline) break
      if (now - lastBeat >= o.heartbeatMs) {
        lastBeat = now
        if (o.ephemeral) {
          const beat: AnyEvent = {
            seq: null,
            at: new Date(now).toISOString(),
            sessionId: null,
            data: { type: 'heartbeat', lastSeq: await store.lastSeq() },
          }
          yield encodeSse({ data: JSON.stringify(beat) })
        } else yield encodeSseComment('heartbeat')
      }
      await sleep(Math.min(o.pollMs, deadline - now, o.heartbeatMs - (now - lastBeat)), signal, woken)
    }
    if (!signal.aborted)
      yield encodeSseComment(`stream cap reached at seq ${cursor}; reconnect with Last-Event-ID`)
  } finally {
    off()
  }
}
