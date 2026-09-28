import { AnyEvent, type DurableEvent, type GnomeolaClient, isDurable } from '@gnomeola/protocol'

/**
 * Read the raw /events stream (no client-side dedupe, unlike subscribe()) until a durable event with
 * seq >= `untilSeq` arrives. Returns every event received, in order. This is what catches a server
 * that sends a duplicate or skips one at the replay→live seam.
 */
export async function readEvents(
  client: GnomeolaClient,
  opts: { since?: number; untilSeq: number; sessionId?: string; ephemeral?: boolean; timeoutMs?: number },
): Promise<AnyEvent[]> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 20_000)
  const out: AnyEvent[] = []
  try {
    for await (const msg of client.stream('events', {
      query: { since: opts.since, sessionId: opts.sessionId, ephemeral: opts.ephemeral ?? false },
      signal: ac.signal,
    })) {
      if (!msg.data) continue
      const e = AnyEvent.parse(JSON.parse(msg.data))
      if (isDurable(e) && msg.id !== String(e.seq)) throw new Error(`id line ${msg.id} != seq ${e.seq}`)
      if (!isDurable(e) && msg.id !== undefined) throw new Error('ephemeral event carried an id line')
      out.push(e)
      if (isDurable(e) && e.seq >= opts.untilSeq) break
    }
  } catch (err) {
    if (!ac.signal.aborted) throw err
    throw new Error(
      `timed out reading events: got ${out.filter(isDurable).length} durable, wanted seq ${opts.untilSeq}`,
    )
  } finally {
    clearTimeout(timer)
    ac.abort()
  }
  return out
}

export const durable = (es: AnyEvent[]): DurableEvent[] => es.filter(isDurable)

/**
 * A fetch that kills each streaming response after a random number of bytes (so, often mid-message),
 * as a dropped network connection would. Returns the fetch and a counter of cuts made.
 */
export function cuttingFetch(rnd: () => number, minBytes: number, maxBytes: number) {
  const stats = { cuts: 0, connections: 0 }
  const f: typeof fetch = async (input, init) => {
    const res = await fetch(input, init)
    const accept = new Headers(init?.headers).get('accept')
    if (!res.body || accept !== 'text/event-stream') return res
    stats.connections++
    const budget = minBytes + Math.floor(rnd() * (maxBytes - minBytes))
    let seen = 0
    const reader = res.body.getReader()
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read()
        if (done) return controller.close()
        if (seen + value.length >= budget) {
          const keep = budget - seen
          if (keep > 0) controller.enqueue(value.slice(0, keep))
          stats.cuts++
          await reader.cancel()
          controller.error(new Error('connection cut by test'))
          return
        }
        seen += value.length
        controller.enqueue(value)
      },
      cancel: () => reader.cancel(),
    })
    return new Response(body, { status: res.status, headers: res.headers })
  }
  return { fetch: f, stats }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
