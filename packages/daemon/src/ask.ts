import {
  type AskBody,
  type AskStreamEvent,
  type Citation,
  newId,
  parseSince,
  type QaMessage,
  type Session,
} from '@gnomeola/protocol'
import type { Store } from '@gnomeola/store'
import type { EventBus } from './bus.ts'
import { DaemonError, toDaemonError } from './errors.ts'
import type { SseWriter } from './http.ts'
import type { QaEngine, QaTranscript } from './interfaces.ts'
import type { Logger } from './logger.ts'
import type { SettingsService } from './settings.ts'

// POST /ask. The stream is: question, delta*, then exactly one of answer | error. The question and the
// answer are both persisted as `qa.message` durable events; deltas are also fanned out as ephemeral
// `qa.delta` events so other windows can watch an answer arrive.

export const MAX_CROSS_SESSION = 20

export type AskDeps = {
  store: Store
  bus: EventBus
  engine: QaEngine | null
  settings: SettingsService
  logger: Logger
}

/**
 * Resolve which transcripts a question is about. Runs before the stream opens so a missing or private
 * session is a plain 404, not a stream error. Private sessions are only included on explicit request.
 */
export function resolveScope(store: Store, body: AskBody): QaTranscript[] {
  let sessions: Session[]
  if (body.sessionId !== undefined) {
    const s = store.getSession(body.sessionId)
    if (!s || (s.private && !body.includePrivate))
      throw new DaemonError('not_found', `no session ${body.sessionId}`)
    sessions = [s]
  } else {
    let since: Date | undefined
    if (body.since !== undefined) {
      try {
        since = parseSince(body.since)
      } catch (err) {
        throw new DaemonError('bad_request', (err as Error).message)
      }
    }
    sessions = store.listSessions({
      since,
      includePrivate: body.includePrivate ?? false,
      limit: MAX_CROSS_SESSION,
    })
  }
  return sessions.map((session) => ({ session, segments: store.segments(session.id) }))
}

export async function runAsk(
  deps: AskDeps,
  body: AskBody,
  transcripts: QaTranscript[],
  sse: SseWriter,
): Promise<void> {
  const { store, bus, engine, logger } = deps
  const send = (e: AskStreamEvent) => sse.send({ data: JSON.stringify(e) })
  const sessionId = body.sessionId ?? null
  const requestId = newId('req')
  const abort = new AbortController()
  sse.onClose(() => abort.abort())

  const history = sessionId ? store.qaHistory(sessionId) : []
  const question: QaMessage = {
    id: newId('qa'),
    sessionId,
    requestId,
    role: 'user',
    text: body.question,
    citations: [],
    model: null,
    usage: null,
    stopReason: null,
    createdAt: new Date().toISOString(),
  }
  store.addQaMessage(question)
  send({ type: 'question', message: question })

  const fail = (code: DaemonError['code'], message: string) => {
    send({ type: 'error', error: { code, message } })
    sse.end()
  }

  const settings = deps.settings.get().llm
  if (!engine) return fail('unavailable', 'no question-answering engine is configured in this daemon')
  const apiKey = await deps.settings.apiKey()
  if (!engine.ready({ settings, apiKeyConfigured: apiKey !== null }))
    return fail('unavailable', `the ${settings.provider} provider is not ready (is an API key configured?)`)

  const known = new Map(transcripts.flatMap((t) => t.segments.map((s) => [s.id, s] as const)))
  let answered = false
  try {
    for await (const chunk of engine.ask({
      requestId,
      question: body.question,
      effort: body.effort,
      transcripts,
      history,
      settings,
      apiKey,
      signal: abort.signal,
    })) {
      if (sse.closed) break
      if (chunk.type === 'delta') {
        send({ type: 'delta', text: chunk.text })
        bus.ephemeral(sessionId, { type: 'qa.delta', requestId, text: chunk.text })
        continue
      }
      // Citations must point at segments the engine was actually shown; anything else is a hallucination.
      const citations: Citation[] = chunk.citations.filter((c) => known.has(c.segmentId))
      if (citations.length !== chunk.citations.length)
        logger.warn('dropped citations to unknown segments', {
          requestId,
          dropped: chunk.citations.length - citations.length,
        })
      const answer: QaMessage = {
        id: newId('qa'),
        sessionId,
        requestId,
        role: 'assistant',
        text: chunk.text,
        citations,
        model: chunk.model,
        usage: chunk.usage,
        stopReason: chunk.stopReason,
        createdAt: new Date().toISOString(),
      }
      store.addQaMessage(answer)
      send({ type: 'answer', message: answer })
      answered = true
      break
    }
  } catch (err) {
    if (abort.signal.aborted) return
    const e = toDaemonError(err)
    logger.error('ask failed', { requestId, err, code: e.code })
    return fail(
      e.code,
      e.code === 'internal' && err instanceof Error ? deps.logger.redact(err.message) : e.message,
    )
  }
  if (!answered) {
    if (!sse.closed) return fail('internal', 'the engine finished without an answer')
    return
  }
  sse.end()
}
