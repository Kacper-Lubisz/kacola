import type { AnyEvent, AskStreamEvent, Citation, ErrorDetail, QaMessage } from '@kacola/protocol'

// Q&A for one session as the UI sees it: history from GET /sessions/:id/qa, durable `qa.message`
// events (from this window or any other client), the POST /ask stream of the question this window is
// asking, and ephemeral `qa.delta` events (another client's answer arriving). Pure.
//
// A turn is one question and its answer, keyed by requestId. While this window's own ask is in
// flight its turn is keyed `local:<n>` until the stream's `question` event names the real requestId.
// Deltas are kept per origin (`own` from the ask stream, `bus` from qa.delta) because the daemon
// sends every delta both ways; showing `own` when present never double-counts.

/** `reason` / `action` (protocol ai.ts) say what went wrong and the one action that fixes it. */
export type AskError = { code: string; message: string } & ErrorDetail

export type QaTurn = {
  requestId: string
  question: string
  askedAt: string | null
  answer: QaMessage | null
  own: string | null
  bus: string | null
  /** This window is streaming it right now. */
  pending: boolean
  error: AskError | null
}

export type QaState = { readonly turns: readonly QaTurn[] }

export const emptyQa: QaState = { turns: [] }

const blankTurn = (requestId: string, question: string, askedAt: string | null): QaTurn => ({
  requestId,
  question,
  askedAt,
  answer: null,
  own: null,
  bus: null,
  pending: false,
  error: null,
})

function update(state: QaState, requestId: string, fn: (t: QaTurn) => QaTurn): QaState {
  const i = state.turns.findIndex((t) => t.requestId === requestId)
  if (i === -1) return state
  const next = fn(state.turns[i]!)
  if (next === state.turns[i]) return state
  const turns = state.turns.slice()
  turns[i] = next
  return { turns }
}

/** Fold one persisted message (history, `qa.message` event, or the ask stream's question/answer). */
export function applyQaMessage(state: QaState, m: QaMessage): QaState {
  const exists = state.turns.some((t) => t.requestId === m.requestId)
  if (m.role === 'user') {
    if (exists) {
      return update(state, m.requestId, (t) =>
        t.askedAt === m.createdAt && t.question === m.text
          ? t
          : { ...t, question: m.text, askedAt: m.createdAt },
      )
    }
    return { turns: [...state.turns, blankTurn(m.requestId, m.text, m.createdAt)] }
  }
  if (!exists) {
    // an answer whose question we never saw (history trimmed): still show it
    return { turns: [...state.turns, { ...blankTurn(m.requestId, '', null), answer: m }] }
  }
  return update(state, m.requestId, (t) => (t.answer?.id === m.id ? t : { ...t, answer: m, error: null }))
}

export function fromHistory(messages: readonly QaMessage[]): QaState {
  let s = emptyQa
  for (const m of messages) s = applyQaMessage(s, m)
  return s
}

/** Durable qa.message and ephemeral qa.delta events for this session. */
export function applyQaEvent(state: QaState, sessionId: string, e: AnyEvent): QaState {
  if (e.sessionId !== sessionId) return state
  const d = e.data
  if (d.type === 'qa.message')
    return d.message.sessionId === sessionId ? applyQaMessage(state, d.message) : state
  if (d.type === 'qa.delta') {
    return update(state, d.requestId, (t) => (t.answer ? t : { ...t, bus: (t.bus ?? '') + d.text }))
  }
  return state
}

/** This window starts asking: a provisional turn until the stream names its requestId. */
export function beginAsk(state: QaState, localId: string, question: string): QaState {
  return { turns: [...state.turns, { ...blankTurn(localId, question, null), pending: true, own: '' }] }
}

/** Fold one event of this window's own /ask stream into the turn it started as `localId`. */
export function applyAskStream(state: QaState, localId: string, ev: AskStreamEvent): QaState {
  switch (ev.type) {
    case 'question': {
      const q = ev.message
      const local = state.turns.find((t) => t.requestId === localId)
      // the durable qa.message may have raced ahead of the stream and created the turn already
      const already = state.turns.find((t) => t.requestId === q.requestId)
      const renamed: QaTurn = {
        ...(local ?? already ?? blankTurn(q.requestId, q.text, q.createdAt)),
        requestId: q.requestId,
        question: q.text,
        askedAt: q.createdAt,
        pending: true,
        own: local?.own ?? '',
        bus: already?.bus ?? null,
      }
      if (local) {
        // keep the turn where the user saw it appear: in the local placeholder's slot
        const turns = state.turns.filter((t) => t !== already).map((t) => (t === local ? renamed : t))
        return { turns }
      }
      if (already) return update(state, q.requestId, () => renamed)
      return { turns: [...state.turns, renamed] }
    }
    case 'delta':
      return updateOwn(state, localId, (t) => (t.answer ? t : { ...t, own: (t.own ?? '') + ev.text }))
    case 'answer': {
      const s = applyQaMessage(state, ev.message)
      return update(s, ev.message.requestId, (t) => ({ ...t, pending: false, error: null }))
    }
    case 'error':
      return updateOwn(state, localId, (t) => ({ ...t, pending: false, error: ev.error }))
  }
}

/** The turn this window is asking: the `localId` placeholder, else the pending turn it became. */
function updateOwn(state: QaState, localId: string, fn: (t: QaTurn) => QaTurn): QaState {
  if (state.turns.some((t) => t.requestId === localId)) return update(state, localId, fn)
  const pending = [...state.turns].reverse().find((t) => t.pending)
  return pending ? update(state, pending.requestId, fn) : state
}

/** The ask failed before or outside the stream (daemon unreachable, 404…). */
export function failAsk(state: QaState, localId: string, error: AskError): QaState {
  return updateOwn(state, localId, (t) => ({ ...t, pending: false, error }))
}

// -------------------------------------------------------------------------------- presenting a turn

export type TurnView =
  | { kind: 'streaming'; text: string }
  | { kind: 'answer'; text: string; citations: readonly Citation[] }
  | { kind: 'refusal' }
  | { kind: 'error'; error: AskError }
  | { kind: 'unanswered' }

/**
 * What to show under a question. A refusal replaces whatever partial text streamed before it — the
 * model declined, so a half answer must not be left on screen.
 */
export function viewTurn(t: QaTurn): TurnView {
  if (t.answer) {
    if (t.answer.stopReason === 'refusal') return { kind: 'refusal' }
    return { kind: 'answer', text: t.answer.text, citations: t.answer.citations }
  }
  if (t.error) return { kind: 'error', error: t.error }
  const streamed = t.own ?? t.bus
  if (streamed !== null || t.pending) return { kind: 'streaming', text: streamed ?? '' }
  return { kind: 'unanswered' }
}

export type AnswerPiece = { kind: 'text'; text: string } | { kind: 'cite'; n: number }

/** Split an answer on its `[n]` markers; a marker with no matching citation stays plain text. */
export function splitCitations(text: string, count: number): AnswerPiece[] {
  const out: AnswerPiece[] = []
  let last = 0
  for (const m of text.matchAll(/\[(\d{1,3})\]/g)) {
    const n = Number(m[1])
    if (n < 1 || n > count) continue
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) })
    out.push({ kind: 'cite', n })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

const SET_UP = new Set(['no-provider', 'no-key', 'bad-key'])

/**
 * The Ask pane should explain "no key / Q&A off" (and offer Preferences) instead of showing a raw error.
 * Not for a busy, rate-limited or out-of-credits provider: those carry a reason whose action is Retry or
 * Add credits, and "set up a provider" would send the user to fix a key that works.
 */
export const isUnavailable = (e: AskError): boolean =>
  e.code === 'unavailable' && (e.reason === undefined || SET_UP.has(e.reason))

// --------------------------------------------------------------------------------------------- feed

export type QaFeedState = {
  status: 'loading' | 'ready' | 'error'
  qa: QaState
  error: string | null
}

export type AskRequest = { question: string; sessionId: string; includePrivate: boolean }

export type QaFeedDeps = {
  history: (sessionId: string, signal: AbortSignal) => Promise<QaMessage[]>
  onEvent: (l: (e: AnyEvent) => void) => () => void
  ask: (body: AskRequest, signal: AbortSignal) => AsyncIterable<AskStreamEvent>
}

const errorOf = (err: unknown): AskError => {
  const e = err as { code?: unknown; message?: unknown; detail?: ErrorDetail } | null
  return {
    code: typeof e?.code === 'string' ? e.code : 'internal',
    message: typeof e?.message === 'string' ? e.message : String(err),
    // a KacolaApiError carries the structured detail (reason, action, provider, link)
    ...(e?.detail && typeof e.detail === 'object' ? e.detail : {}),
  }
}

/**
 * History + live events + this window's own asks for one session. Same shape as TranscriptFeed: listen
 * first, load, then fold what arrived meanwhile (messages are keyed, so the overlap is harmless).
 */
export class QaFeed {
  private state: QaFeedState = { status: 'loading', qa: emptyQa, error: null }
  private readonly listeners = new Set<() => void>()
  private readonly abort = new AbortController()
  private unsubscribe: (() => void) | null = null
  private buffered: AnyEvent[] | null = []
  private asks = 0
  readonly sessionId: string
  private readonly deps: QaFeedDeps

  constructor(sessionId: string, deps: QaFeedDeps) {
    this.sessionId = sessionId
    this.deps = deps
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  getSnapshot = (): QaFeedState => this.state

  private setQa(qa: QaState, patch: Partial<QaFeedState> = {}) {
    if (qa === this.state.qa && Object.keys(patch).length === 0) return
    this.state = { ...this.state, ...patch, qa }
    for (const l of [...this.listeners]) l()
  }

  start(): this {
    this.unsubscribe = this.deps.onEvent((e) => {
      if (this.buffered) this.buffered.push(e)
      else this.setQa(applyQaEvent(this.state.qa, this.sessionId, e))
    })
    void this.load()
    return this
  }

  private async load() {
    try {
      const messages = await this.deps.history(this.sessionId, this.abort.signal)
      if (this.abort.signal.aborted) return
      let qa = fromHistory(messages)
      // anything asked from this window before the history arrived stays, after the history
      for (const t of this.state.qa.turns) {
        if (!qa.turns.some((x) => x.requestId === t.requestId)) qa = { turns: [...qa.turns, t] }
      }
      for (const e of this.buffered ?? []) qa = applyQaEvent(qa, this.sessionId, e)
      this.buffered = null
      this.setQa(qa, { status: 'ready', error: null })
    } catch (err) {
      if (this.abort.signal.aborted) return
      this.buffered = null
      this.setQa(this.state.qa, { status: 'error', error: errorOf(err).message })
    }
  }

  /** Ask a question about this session; resolves when the stream ends (answered, refused or failed). */
  async ask(question: string): Promise<void> {
    const localId = `local:${++this.asks}`
    this.setQa(beginAsk(this.state.qa, localId, question))
    try {
      for await (const ev of this.deps.ask(
        { question, sessionId: this.sessionId, includePrivate: true },
        this.abort.signal,
      )) {
        if (this.abort.signal.aborted) return
        this.setQa(applyAskStream(this.state.qa, localId, ev))
      }
      // a stream that ends with neither answer nor error is a failure too, never a spinner forever
      if (this.state.qa.turns.some((t) => t.pending)) {
        this.setQa(
          failAsk(this.state.qa, localId, { code: 'internal', message: 'the answer stream ended early' }),
        )
      }
    } catch (err) {
      if (this.abort.signal.aborted) return
      this.setQa(failAsk(this.state.qa, localId, errorOf(err)))
    }
  }

  get asking(): boolean {
    return this.state.qa.turns.some((t) => t.pending)
  }

  dispose() {
    this.abort.abort()
    this.unsubscribe?.()
    this.unsubscribe = null
    this.listeners.clear()
  }
}
