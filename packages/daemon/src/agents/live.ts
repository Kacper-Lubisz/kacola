import type { AnyEvent, DurableEvent, LeaseEndReason, LiveEvent, Segment } from '@kacola/protocol'
import type { Store } from '@kacola/store'
import type { EventBus } from '../bus.ts'
import type { SseWriter } from '../http.ts'
import type { AgentChannel, AgentLeaseRecord } from './channel.ts'
import { runGuard } from './guard.ts'

// GET /sessions/:id/live: one agent's view of one recording, as typed LiveEvents.
//
// Same discipline as /events (events-stream.ts), since this is a projection of the same log:
//   1. subscribe to the bus first, buffering;
//   2. replay the session's durable events after the cursor, in pages;
//   3. drain the buffer, dropping durable events at or below the cursor;
//   4. go live.
// Every message derived from a durable event carries that event's seq as its SSE id, and a durable event
// of the session that renders to nothing still sends a bare `id:` line, so a client's cursor always
// reaches the log's head. Resuming from it gives no gaps and no duplicates. Rendering can be async (the
// SpeechGuard may be a model call), so every item, replayed or live, goes through ONE ordered queue:
// nothing is reordered, and nothing slips past the seam.
//
// What an agent sees:
//   segment.upserted  → segment.final (the first time a segment closes, and again only when its text or
//                       speaker changes), after the guard
//   transcript.partial → partial, at most one per track per `partialEveryMs`, after the guard
//   agenda.*          → agenda.updated (the whole view), suggestion, context
//   agent.presence    → agent.presence (every agent on this recording)
//   session stops / is deleted → meeting.ended, then the stream closes
//   the lease ends    → lease.ended, then the stream closes

export type LiveStreamOptions = {
  store: Store
  bus: EventBus
  channel: AgentChannel
  rec: AgentLeaseRecord
  sse: SseWriter
  sessionId: string
  /** Replay after this seq; undefined = from now on. */
  since: number | undefined
  partials: boolean
  partialEveryMs: number
  heartbeatMs: number
  pageSize: number
}

type Item = { kind: 'event'; e: AnyEvent } | { kind: 'end'; reason: LeaseEndReason }

const ENDED = new Set(['stopped', 'recovered', 'failed'])

export async function streamLive(o: LiveStreamOptions): Promise<void> {
  const { store, bus, sse, channel, rec, sessionId } = o
  let cursor = 0
  let done = false
  let live = false
  const buffer: Item[] = []
  const queue: Item[] = []
  let pumping: Promise<void> | null = null
  const sent = new Map<string, { text: string; speaker: string }>()
  const lastPartial = new Map<string, number>()

  const send = (ev: LiveEvent, seq?: number) => {
    sse.send({ ...(seq !== undefined ? { id: String(seq) } : {}), data: JSON.stringify(ev) })
  }
  const advance = (seq: number) => sse.send({ id: String(seq), data: '' })
  const finish = () => {
    if (done) return
    done = true
    sse.end()
  }

  const agendaOf = (): string | null => rec.lease.agendaId

  async function render(item: Item): Promise<void> {
    if (done) return
    if (item.kind === 'end') {
      send({ type: 'lease.ended', leaseId: rec.lease.id, reason: item.reason })
      finish()
      return
    }
    const e = item.e
    if (e.seq === null) {
      const d = e.data
      if (d.type === 'transcript.partial' && o.partials) {
        const now = Date.now()
        if (now - (lastPartial.get(d.track) ?? 0) < o.partialEveryMs) return
        lastPartial.set(d.track, now)
        const v = await runGuard(channel.guard, {
          sessionId,
          segmentId: null,
          speaker: d.speaker,
          text: d.text,
          kind: 'partial',
        })
        if (done) return
        send({ type: 'partial', speaker: d.speaker, startMs: d.startMs, text: v.text })
        channel.delivered(rec)
      } else if (d.type === 'agent.presence') {
        send({ type: 'agent.presence', leaseId: d.leaseId, name: d.name, mode: d.mode, state: d.state })
      }
      return
    }
    if (e.seq <= cursor) return
    const seq = e.seq
    const ev = await project(e)
    if (done) return
    cursor = seq
    if (!ev) {
      advance(seq)
      return
    }
    send(ev, seq)
    if (ev.type === 'segment.final') channel.delivered(rec)
    if (ev.type === 'meeting.ended') finish()
  }

  async function project(e: DurableEvent): Promise<LiveEvent | null> {
    const d = e.data
    switch (d.type) {
      case 'segment.upserted': {
        const seg: Segment = d.segment
        if (seg.sessionId !== sessionId) return null
        const prev = sent.get(seg.id)
        if (prev && prev.text === seg.text && prev.speaker === seg.speaker) return null
        sent.set(seg.id, { text: seg.text, speaker: seg.speaker })
        const v = await channel.verdict(seg)
        return {
          type: 'segment.final',
          segmentId: seg.id,
          speaker: seg.speaker,
          startMs: seg.startMs,
          endMs: seg.endMs,
          text: v.text,
          revision: seg.revision,
          quality: seg.quality,
          flags: v.flags,
        }
      }
      case 'session.upserted':
        return d.session.id === sessionId && ENDED.has(d.session.status)
          ? { type: 'meeting.ended', sessionId }
          : null
      case 'session.deleted':
        return d.sessionId === sessionId ? { type: 'meeting.ended', sessionId } : null
      case 'agenda.suggestion.upserted':
        return d.agendaId === agendaOf() ? { type: 'suggestion', suggestion: d.suggestion } : null
      case 'agenda.context.upserted':
        return d.agendaId === agendaOf() ? { type: 'context', card: d.card } : null
      case 'agenda.upserted': {
        if (d.agenda.sessionId !== sessionId) return null
        const view = channel.agendaView(d.agenda.id)
        return view ? { type: 'agenda.updated', agenda: view } : null
      }
      case 'agenda.item.upserted':
      case 'agenda.item.status':
      case 'agenda.item.deleted':
      case 'agenda.items.reordered':
      case 'agenda.context.deleted': {
        if (d.agendaId !== agendaOf()) return null
        const view = channel.agendaView(d.agendaId)
        return view ? { type: 'agenda.updated', agenda: view } : null
      }
      default:
        return null
    }
  }

  // One consumer at a time, in order. (`pumping` is cleared before the drain loop can finish
  // synchronously, so an empty queue never leaves a settled promise behind that blocks the next pump.)
  const drain = async () => {
    await Promise.resolve()
    while (queue.length && !done) {
      try {
        await render(queue.shift()!)
      } catch {
        finish()
      }
    }
    pumping = null
  }
  const pump = (): Promise<void> => {
    if (!pumping) pumping = drain()
    return pumping
  }
  const enqueue = (item: Item) => {
    if (done) return
    queue.push(item)
    void pump()
  }

  const relevant = (e: AnyEvent) =>
    e.sessionId === sessionId ||
    (e.seq !== null && (e.data.type === 'session.deleted' || e.data.type.startsWith('agenda.')))

  // (1) subscribe first
  const unsubscribe = bus.subscribe((e) => {
    if (!relevant(e)) return
    const item: Item = { kind: 'event', e }
    if (live) enqueue(item)
    else if (e.seq !== null) buffer.push(item) // ephemeral events from before we are live are moot
  })
  const offEnd = channel.onEnd(rec.lease.id, (reason) => {
    // a meeting that ended says so itself (meeting.ended, from the log, in order)
    if (reason === 'meeting-ended') return
    const item: Item = { kind: 'end', reason }
    if (live) enqueue(item)
    else buffer.push(item)
  })
  const heartbeat = setInterval(() => sse.comment('heartbeat'), o.heartbeatMs)
  heartbeat.unref()
  channel.streamOpened(rec)
  sse.onClose(() => {
    done = true
    unsubscribe()
    offEnd()
    clearInterval(heartbeat)
    buffer.length = 0
    queue.length = 0
    channel.streamClosed(rec)
  })

  // the head of the log is where "now" is; the snapshot says where this stream starts
  const head = store.lastSeq()
  cursor = o.since ?? head
  send({
    type: 'attached',
    lease: { ...rec.lease },
    agenda: rec.lease.agendaId ? channel.agendaView(rec.lease.agendaId) : null,
    lastSeq: cursor,
  })
  sse.send({ id: String(cursor), data: '' })

  // (2) replay
  if (o.since !== undefined) {
    let after = o.since
    for (;;) {
      if (sse.closed || done) return
      const page = store.eventsAfter(after, { limit: o.pageSize, sessionId })
      if (!page.length) break
      for (const e of page) await render({ kind: 'event', e })
      after = page.at(-1)!.seq
      await sse.drained()
      await new Promise((r) => setImmediate(r))
    }
  }
  if (sse.closed || done) return
  // the session may have ended before we got here (between the lease and the stream)
  const s = store.getSession(sessionId)
  if (!s || ENDED.has(s.status)) {
    send({ type: 'meeting.ended', sessionId })
    finish()
    return
  }
  // (3) + (4): drain the buffer through the queue (render drops what replay already sent), go live
  for (const item of buffer.splice(0)) queue.push(item)
  live = true
  await pump()
  await sse.whenClosed()
}
