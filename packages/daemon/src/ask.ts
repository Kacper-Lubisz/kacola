import {
  type AskBody,
  type AskStreamEvent,
  type Citation,
  isOnDeviceLlm,
  newId,
  parseSince,
  type QaMessage,
  type Session,
  type Settings,
} from '@gnomeola/protocol'
import type { Store } from '@gnomeola/store'
import type { EventBus } from './bus.ts'
import { DaemonError, streamError, toDaemonError } from './errors.ts'
import type { SseWriter } from './http.ts'
import type { QaEngine, QaTranscript } from './interfaces.ts'
import type { Logger } from './logger.ts'
import { assertMayLeave, mayLeave, notReadyError } from './privacy.ts'
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

export type AskScope = {
  transcripts: QaTranscript[]
  /** Private meetings left out of a cross-meeting question because the provider is in the cloud. */
  excludedPrivate: number
}

/**
 * Resolve which transcripts a question is about. Runs before the stream opens so a missing or private
 * session is a plain 404, not a stream error. Private sessions are only included on explicit request,
 * and even then only for an on-device provider: a private meeting is never sent to the cloud. Asking
 * about one private meeting with a cloud provider is a typed 409 (`private-meeting`); a cross-meeting
 * question leaves private meetings out (and says how many in the stream's `question` event).
 */
export function resolveScope(
  store: Store,
  body: AskBody,
  llm: Pick<Settings['llm'], 'provider' | 'ollamaUrl'>,
): AskScope {
  let sessions: Session[]
  let excludedPrivate = 0
  if (body.sessionId !== undefined) {
    const s = store.getSession(body.sessionId)
    if (!s || (s.private && !body.includePrivate))
      throw new DaemonError('not_found', `no session ${body.sessionId}`)
    assertMayLeave(s, llm, 'Ask')
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
    const listed = store.listSessions({
      since,
      includePrivate: body.includePrivate ?? false,
      // room for the private ones a cloud provider leaves out, so the limit counts what is sent
      limit: body.includePrivate ? MAX_CROSS_SESSION * 5 : MAX_CROSS_SESSION,
    })
    const allowed = listed.filter((s) => mayLeave(s, llm))
    excludedPrivate = listed.length - allowed.length
    sessions = allowed.slice(0, MAX_CROSS_SESSION)
  }
  return {
    transcripts: sessions.map((session) => ({ session, segments: store.segments(session.id) })),
    excludedPrivate,
  }
}

export async function runAsk(deps: AskDeps, body: AskBody, scope: AskScope, sse: SseWriter): Promise<void> {
  const { transcripts } = scope
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
  const settings = deps.settings.get().llm
  send({
    type: 'question',
    message: question,
    scope: {
      sessionIds: transcripts.map((t) => t.session.id),
      excludedPrivate: scope.excludedPrivate,
      provider: settings.provider,
      onDevice: isOnDeviceLlm(settings),
    },
  })

  const fail = (e: DaemonError) => {
    send({ type: 'error', error: streamError(e) })
    sse.end()
  }

  if (!engine) return fail(notReadyError(settings, false, 'Ask'))
  const apiKey = await deps.settings.apiKey()
  if (!engine.ready({ settings, apiKeyConfigured: apiKey !== null }))
    return fail(notReadyError(settings, apiKey !== null, 'Ask'))

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
    // Engine errors can echo request details; never let a secret ride out on one.
    return fail(
      e.withMessage(
        deps.logger.redact(e.code === 'internal' && err instanceof Error ? err.message : e.message),
      ),
    )
  }
  if (!answered) {
    if (!sse.closed) return fail(new DaemonError('internal', 'the engine finished without an answer'))
    return
  }
  sse.end()
}
