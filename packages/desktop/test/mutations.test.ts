import type { AskStreamEvent, QaMessage, Session } from '@kacola/protocol'
import type { SessionsState } from '@kacola/ui-core/sessions'
import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import { createEphemeralStore } from '../src/renderer/data/ephemeral.ts'
import { EventBridge } from '../src/renderer/data/event-bridge.ts'
import { keys } from '../src/renderer/data/keys.ts'
import { renameSessionMutation } from '../src/renderer/data/mutations.ts'
import type { Api } from '../src/renderer/data/queries.ts'
import { runAsk, runEnhance } from '../src/renderer/data/streams.ts'
import { fakeDaemon, session, until, upserted } from './helpers.ts'

afterEach(() => onlineManager.setOnline(true))

/** A bridge over the fake daemon, plus an Api whose updateSession the test resolves by hand. */
async function setup() {
  const daemon = fakeDaemon({ sessions: [session('a', { title: 'Standup' })], lastSeq: 1 })
  const qc = new QueryClient()
  const bridge = new EventBridge(daemon.client, qc, createEphemeralStore())
  bridge.start()
  await bridge.ready
  qc.setQueryData(keys.session('a'), session('a', { title: 'Standup' }))
  let settle: { resolve: (s: Session) => void; reject: (e: Error) => void } = {
    resolve: () => {},
    reject: () => {},
  }
  const api = {
    call: () => new Promise<Session>((resolve, reject) => (settle = { resolve, reject })),
  } as unknown as Api
  const rename = new MutationObserver(qc, renameSessionMutation(api, qc))
  const listTitle = () => qc.getQueryData<SessionsState>(keys.sessions())!.byId.get('a')!.title
  const detailTitle = () => qc.getQueryData<Session>(keys.session('a'))!.title
  return { daemon, qc, bridge, rename, settle: () => settle, listTitle, detailTitle }
}

describe('optimistic mutations vs the durable echo', () => {
  it('shows the new value at once, and the echo reconciles to the server value', async () => {
    const t = await setup()
    const p = t.rename.mutate({ id: 'a', title: 'Daily standup' })
    await until(() => t.listTitle() !== 'Standup')
    expect(t.listTitle()).toBe('Daily standup')
    expect(t.detailTitle()).toBe('Daily standup')
    // the daemon normalises the title; its echo wins
    t.daemon.emit(upserted(2, session('a', { title: 'Daily Standup' })))
    t.settle().resolve(session('a', { title: 'Daily Standup' }))
    await p
    expect(t.listTitle()).toBe('Daily Standup')
    expect(t.detailTitle()).toBe('Daily Standup')
    t.bridge.stop()
  })

  it('rolls back on error when nothing else wrote meanwhile', async () => {
    const t = await setup()
    const p = t.rename.mutate({ id: 'a', title: 'Oops' }).catch(() => {})
    await until(() => t.listTitle() !== 'Standup')
    expect(t.listTitle()).toBe('Oops')
    t.settle().reject(new Error('400'))
    await p
    expect(t.listTitle()).toBe('Standup')
    expect(t.detailTitle()).toBe('Standup')
    t.bridge.stop()
  })

  it('does not roll back over a newer event: it refetches instead', async () => {
    const t = await setup()
    const p = t.rename.mutate({ id: 'a', title: 'Mine' }).catch(() => {})
    await until(() => t.listTitle() === 'Mine')
    t.daemon.emit(upserted(2, session('a', { title: 'Someone else’s' })))
    t.settle().reject(new Error('409'))
    await p
    expect(t.listTitle()).toBe('Someone else’s') // not "Standup"
    expect(t.qc.getQueryState(keys.sessions())!.isInvalidated).toBe(true)
    t.bridge.stop()
  })
})

async function* events<E>(list: E[], opts: { failAfter?: number } = {}): AsyncGenerator<E> {
  let i = 0
  for (const e of list) {
    if (opts.failAfter !== undefined && i++ >= opts.failAfter) throw new Error('stream broke')
    yield e
  }
}

describe('ask / enhance streams', () => {
  const message = { id: 'qa_2', role: 'assistant' } as unknown as QaMessage

  it('folds ask deltas into the store and ends done on the answer', async () => {
    const store = createEphemeralStore()
    const seen: string[] = []
    store.subscribe((s) => seen.push(s.streams.x?.text ?? ''))
    const api = {
      ask: () =>
        events<AskStreamEvent>([
          { type: 'question', message },
          { type: 'delta', text: 'We ' },
          { type: 'delta', text: 'agreed.' },
          { type: 'answer', message },
        ]),
    }
    const r = await runAsk(api, store, 'x', { question: 'q', effort: 'low' })
    expect(r).toEqual({ text: 'We agreed.', status: 'done' })
    expect(seen).toContain('We ') // streamed, not all at once
    expect(store.getState().streams.x).toEqual(r)
  })

  it('surfaces a stream error event and a broken stream as errors, keeping the partial text', async () => {
    const store = createEphemeralStore()
    const api = {
      ask: () =>
        events<AskStreamEvent>([
          { type: 'delta', text: 'Part' },
          { type: 'error', error: { code: 'unavailable', message: 'no API key' } },
        ]),
    }
    expect(await runAsk(api, store, 'e', { question: 'q', effort: 'low' })).toEqual({
      text: 'Part',
      status: 'error',
      error: { code: 'unavailable', message: 'no API key' },
    })
    const broken = {
      ask: () =>
        events<AskStreamEvent>(
          [
            { type: 'delta', text: 'a' },
            { type: 'delta', text: 'b' },
          ],
          { failAfter: 1 },
        ),
    }
    const r = await runAsk(broken, store, 'b', { question: 'q', effort: 'low' })
    expect(r.status).toBe('error')
    expect(r.text).toBe('a')
  })

  it('decodes the enhance route’s SSE stream', async () => {
    const store = createEphemeralStore()
    const sse = (o: object) => ({ data: JSON.stringify(o) })
    const api = {
      stream: () =>
        events([
          sse({ type: 'started', templateId: 't', baseVersion: 1 }),
          sse({ type: 'delta', text: '# Notes' }),
        ]),
    } as unknown as Pick<Api, 'stream'>
    expect(await runEnhance(api, store, 'n', 'a', { templateId: 't' } as never)).toEqual({
      text: '# Notes',
      status: 'done',
    })
  })
})
