import { readFileSync } from 'node:fs'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'

// A local stand-in for api.anthropic.com that replays recorded responses byte-for-byte. The real
// Anthropic SDK (inside the real daemon, inside a child process) talks to it via ANTHROPIC_BASE_URL, so
// the whole chain — CLI, daemon, llm package, SDK, SSE parsing — runs for real; only the network peer is
// replaced. Every request is recorded so tests can assert what was actually sent.

export type CannedResponse = { status: number; headers: Record<string, string>; body: string }
export type SeenRequest = { method: string; path: string; headers: IncomingHttpHeaders; body: unknown }

export function loadCassette(path: string): CannedResponse[] {
  const c = JSON.parse(readFileSync(path, 'utf8')) as {
    interactions: { response: { status: number; headers: Record<string, string>; body: unknown } }[]
  }
  return c.interactions.map((i) => ({
    status: i.response.status,
    headers: i.response.headers,
    body: typeof i.response.body === 'string' ? i.response.body : JSON.stringify(i.response.body),
  }))
}

export type FakeAnthropicOptions = {
  /**
   * Write a streamed (text/event-stream) body one SSE event at a time, this many ms apart, so a UI
   * can be watched while the answer streams. 0 (the default) writes the whole body at once.
   */
  eventDelayMs?: number
}

export async function startFakeAnthropic(opts: FakeAnthropicOptions = {}) {
  let eventDelayMs = opts.eventDelayMs ?? 0
  const seen: SeenRequest[] = []
  let queue: CannedResponse[] = []
  let fallback: CannedResponse | null = null
  /** Pause the next streamed body after this many SSE events, until released (a UI caught mid-stream). */
  let hold: { after: number; gate: Promise<void> } | null = null
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const raw = Buffer.concat(chunks).toString('utf8')
    seen.push({
      method: req.method ?? '',
      path: req.url ?? '',
      headers: req.headers,
      body: raw ? JSON.parse(raw) : null,
    })
    const next = queue.shift() ?? fallback
    if (!next) {
      res.writeHead(500, { 'content-type': 'application/json' })
      return res.end(
        JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'fake: no response queued' } }),
      )
    }
    res.writeHead(next.status, next.headers)
    const streamed = String(next.headers['content-type'] ?? '').includes('text/event-stream')
    if (!eventDelayMs || !streamed) return res.end(next.body)
    const h = hold
    hold = null
    let n = 0
    for (const event of next.body.split(/(?<=\n\n)/)) {
      if (res.destroyed) return
      res.write(event)
      if (h && ++n === h.after) await h.gate
      await new Promise((r) => setTimeout(r, eventDelayMs))
    }
    res.end()
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    url,
    seen,
    /** Responses served in order, one per request. */
    enqueue: (...r: CannedResponse[]) => queue.push(...r),
    /** Served once the queue is empty (e.g. for retry storms). */
    always: (r: CannedResponse | null) => {
      fallback = r
    },
    /** Change the per-event delay for responses served from now on. */
    setEventDelay: (ms: number) => {
      eventDelayMs = ms
    },
    /**
     * Stop the next streamed response after `events` SSE events (needs an event delay); returns the
     * release function. Deterministic mid-stream states for screenshots.
     */
    holdAfter: (events: number): (() => void) => {
      let release!: () => void
      hold = { after: events, gate: new Promise<void>((r) => (release = r)) }
      return () => release()
    },
    reset: () => {
      queue = []
      fallback = null
      seen.length = 0
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  }
}
export type FakeAnthropic = Awaited<ReturnType<typeof startFakeAnthropic>>
