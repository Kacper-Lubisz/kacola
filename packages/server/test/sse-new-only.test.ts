import { type DurableEvent, isDurable } from '@gnomeola/protocol'
import { afterEach, expect, it } from 'vitest'
import { type Hosted, sleep, startHosted } from './helpers.ts'

// A subscription that asks for NEW events only (no `since`) resumes exactly across reconnects even
// before it has seen its first event: the stream announces its starting cursor (a data-less id line) and
// the client adopts it. Without that, anything committed while a fresh subscriber was between two
// streams — on a hosted server, after every duration cap — was silently skipped.

let h: Hosted | null = null
afterEach(async () => {
  await h?.close()
  h = null
})

it('a new-events-only subscriber gets what was committed while it was between streams', async () => {
  h = await startHosted({ maxStreamMs: 100, pollMs: 10, heartbeatMs: 1000 })
  for (let i = 0; i < 5; i++) await h.store.createSession({ title: `before ${i}` }) // history it must NOT get
  const got: DurableEvent[] = []
  let disconnects = 0
  const ac = new AbortController()
  const sub = h.client.subscribe({
    signal: ac.signal,
    reconnectDelayMs: 300,
    ephemeral: false,
    onEvent: (e) => {
      if (isDurable(e)) got.push(e)
    },
    onDisconnect: () => {
      disconnects++
    },
  })
  // the first stream ends at its cap with nothing to deliver; commit while the client waits to reconnect
  while (disconnects < 1) await sleep(5)
  const inTheGap = await h.store.createSession({ title: 'committed between two streams' })
  const deadline = Date.now() + 3000
  while (!got.length && Date.now() < deadline) await sleep(10)
  ac.abort()
  await sub
  expect(got.map((e) => e.seq)).toEqual([6])
  expect(got[0]!.sessionId).toBe(inTheGap.id)
})
