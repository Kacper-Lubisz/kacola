import type { AskScope, AskStreamEvent, BodyIn, ErrorDetail, QaMessage } from '@gnomeola/protocol'
import type { QaState, QaTurn } from '@gnomeola/ui-core/qa'
import type { EphemeralStore, StreamState } from '../../data/ephemeral.ts'
import type { Api } from '../../data/queries.ts'

// This window's own questions. The answer's tokens stream into the ephemeral store
// (`streams[localId]`, like data/streams.ts' runAsk); the durable question and answer reach the qa query
// through the EventBridge (qa.message), and that is what the pane shows once it is there. The only
// thing the stream contributes beyond tokens is the requestId (from its `question` event), which is how
// the streaming text is put under the right turn, and — for a cross-session question, which no
// session's history holds — the final answer itself.

export type OwnAsk = {
  localId: string
  question: string
  /** null = asked about this session; else the `since` bound of a cross-session question. */
  since: string | null
  requestId: string | null
  /** A cross-session answer (no session history will hold it). */
  answer: QaMessage | null
  /** What the question sent, and where (the stream's `question` event). */
  scope?: AskScope | null
}

export type AskHandlers = {
  onQuestion: (requestId: string, scope: AskScope | null) => void
  onAnswer: (m: QaMessage) => void
}

export async function runOwnAsk(
  api: Pick<Api, 'ask'>,
  store: EphemeralStore,
  localId: string,
  body: BodyIn<'ask'>,
  on: AskHandlers,
  signal?: AbortSignal,
): Promise<StreamState> {
  const set = (s: StreamState) => store.setState((st) => ({ streams: { ...st.streams, [localId]: s } }))
  let text = ''
  set({ text, status: 'streaming' })
  try {
    for await (const e of api.ask(body, signal) as AsyncIterable<AskStreamEvent>) {
      if (e.type === 'question') on.onQuestion(e.message.requestId, e.scope ?? null)
      else if (e.type === 'delta') {
        text += e.text
        set({ text, status: 'streaming' })
      } else if (e.type === 'answer') {
        on.onAnswer(e.message)
        const s: StreamState = { text, status: 'done' }
        set(s)
        return s
      } else {
        const s: StreamState = { text, status: 'error', error: e.error }
        set(s)
        return s
      }
    }
    // a stream that ends with neither answer nor error is a failure too, never a spinner forever
    const s: StreamState = {
      text,
      status: 'error',
      error: { code: 'internal', message: 'the answer stream ended early' },
    }
    set(s)
    return s
  } catch (err) {
    const e = err as { code?: string; message?: string; name?: string; detail?: ErrorDetail }
    const s: StreamState = {
      text,
      status: 'error',
      error: {
        code: e.name === 'AbortError' ? 'aborted' : (e.code ?? 'internal'),
        message: e.message ?? String(err),
        // a GnomeolaApiError carries the structured detail (reason, action, provider, link)
        ...(e.detail ?? {}),
      },
    }
    set(s)
    return s
  }
}

const blank = (requestId: string, question: string): QaTurn => ({
  requestId,
  question,
  askedAt: null,
  answer: null,
  own: null,
  bus: null,
  pending: false,
  error: null,
})

/**
 * The turns to show: the session's history (qa query) with this window's own asks laid over it — the
 * streaming text on the turn its requestId names, or on a placeholder turn until the daemon's durable
 * question arrives. Once the durable answer is in the history, the stream no longer shows.
 */
export function mergeTurns(
  qa: QaState | undefined,
  own: readonly OwnAsk[],
  streams: Readonly<Record<string, StreamState>>,
): QaTurn[] {
  const turns = (qa?.turns ?? []).slice()
  for (const o of own) {
    const s = streams[o.localId]
    const i = o.requestId ? turns.findIndex((t) => t.requestId === o.requestId) : -1
    const base = i === -1 ? blank(o.requestId ?? o.localId, o.question) : turns[i]!
    if (base.answer) continue // the durable answer is in: it wins
    const answer = o.answer
    const t: QaTurn = {
      ...base,
      question: base.question || o.question,
      answer,
      own: s?.text ?? '',
      pending: !answer && (s?.status ?? 'streaming') === 'streaming',
      error: !answer && s?.status === 'error' ? (s.error ?? null) : null,
    }
    if (i === -1) turns.push(t)
    else turns[i] = t
  }
  return turns
}
