import { formatOffset, type QaMessage } from '@kacola/protocol'
import type { Ctx } from '../context.ts'
import { CliError, EXIT, usage } from '../errors.ts'
import { renderJson } from '../output.ts'
import { mapApiError, resolveSessionId } from '../sessions.ts'

export type AskOpts = { session?: string; since?: string; effort?: string }

/**
 * Answered by the daemon against its prompt-cached transcript. The transcript never enters the caller's
 * context — only the answer and its citations do, which is what makes this the cheapest way to ask.
 */
export async function ask(ctx: Ctx, question: string | undefined, o: AskOpts) {
  if (!question?.trim())
    throw usage('a question is required', 'e.g. kacola ask "what did we decide about retries?"')
  if (o.session && o.since) throw usage('use either --session or --since, not both')
  if (o.effort && !['low', 'medium', 'high'].includes(o.effort))
    throw usage('--effort must be low, medium or high')
  const sessionId = o.session ? await resolveSessionId(ctx, o.session) : undefined
  const since = sessionId ? undefined : (o.since ?? '7d')

  let answer: QaMessage | null = null
  const streamed: string[] = []
  const live = ctx.format === 'text' && ctx.io.isTTY
  try {
    for await (const ev of ctx.client.ask({
      question,
      sessionId,
      since,
      effort: (o.effort as 'low' | 'medium' | 'high' | undefined) ?? 'low',
    })) {
      if (ev.type === 'delta') {
        streamed.push(ev.text)
        if (live) ctx.io.stdout(ev.text)
      } else if (ev.type === 'answer') answer = ev.message
      else if (ev.type === 'error') {
        const code =
          ev.error.code === 'unavailable'
            ? EXIT.UNAVAILABLE
            : ev.error.code === 'not_found'
              ? EXIT.NOT_FOUND
              : EXIT.ERROR
        // the daemon's copy names the provider and the fix; a billing page rides along as the hint
        throw new CliError(code, ev.error.message, ev.error.link)
      }
    }
  } catch (err) {
    if (err instanceof CliError) throw err
    mapApiError(err)
  }
  if (!answer) throw new CliError(EXIT.ERROR, 'the answer stream ended without an answer')

  const citations = answer.citations.map((c) => ({
    sessionId: c.sessionId,
    segmentId: c.segmentId,
    t: formatOffset(c.startMs),
    speaker: c.speaker,
  }))
  if (ctx.format === 'json') {
    return ctx.io.stdout(
      renderJson(
        {
          question,
          scope: sessionId ? { sessionId } : { since },
          answer: answer.text,
          citations,
          stopReason: answer.stopReason,
          model: answer.model,
        },
        ctx.io,
      ),
    )
  }
  if (answer.stopReason === 'refusal') {
    // The engine empties a refused answer; anything already streamed must not be read as an answer.
    ctx.io.stdout(
      `${live ? '\n' : ''}(the model declined to answer this question${live ? ' — disregard the partial text above' : ''})\n`,
    )
    return
  }
  if (!live) ctx.io.stdout(answer.text)
  ctx.io.stdout('\n')
  if (citations.length) {
    ctx.io.stdout('\nsources:\n')
    for (const [i, c] of citations.entries())
      ctx.io.stdout(`  [${i + 1}] ${c.t} ${c.speaker} — ${c.sessionId} ${c.segmentId}\n`)
  }
}
