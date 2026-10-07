import { formatOffset, type Session } from '@kacola/protocol'
import type { Ctx } from '../context.ts'
import { CliError, EXIT, usage } from '../errors.ts'
import { renderJson } from '../output.ts'
import { briefSession, mapApiError, resolveSessionId } from '../sessions.ts'

// The only verbs that change anything. Everything else in this CLI is read-only by design, so an agent
// that is talked into something by a transcript still has no way to delete or rewrite history.

const active = (s: Session) => s.status === 'recording' || s.status === 'paused'

function print(ctx: Ctx, s: Session, verb: string) {
  if (ctx.format === 'json') return ctx.io.stdout(renderJson(briefSession(s), ctx.io))
  ctx.io.stdout(`${verb}: ${s.title} (${s.id}) — ${s.status}, ${formatOffset(s.durationMs)}\n`)
}

export async function recordStart(ctx: Ctx, o: { title?: string }) {
  const { sessions } = await ctx.client.call('listSessions', { query: { limit: 50 } }).catch(mapApiError)
  const running = sessions.find(active)
  if (running) {
    throw new CliError(
      EXIT.ERROR,
      `already recording "${running.title}" (${running.id})`,
      'stop it first: kacola record stop',
    )
  }
  const created = await ctx.client.call('createSession', { body: { title: o.title } }).catch(mapApiError)
  const started = await ctx.client.call('startSession', { params: { id: created.id } }).catch(mapApiError)
  print(ctx, started, 'recording')
}

export async function recordStop(ctx: Ctx, idArg: string | undefined) {
  const id = await resolveSessionId(ctx, idArg ?? 'current')
  const stopped = await ctx.client.call('stopSession', { params: { id } }).catch(mapApiError)
  print(ctx, stopped, 'stopped')
}

export async function recordStatus(ctx: Ctx) {
  const { sessions } = await ctx.client.call('listSessions', { query: { limit: 50 } }).catch(mapApiError)
  const running = sessions.filter(active)
  if (ctx.format === 'json')
    return ctx.io.stdout(renderJson({ recording: running.map(briefSession) }, ctx.io))
  if (!running.length) return ctx.io.stdout('not recording\n')
  for (const s of running) print(ctx, s, s.status)
}

export function recordUsage(): never {
  throw usage('usage: kacola record start [--title T] | stop [id] | status')
}
