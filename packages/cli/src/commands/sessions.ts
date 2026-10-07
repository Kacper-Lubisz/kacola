import { formatOffset } from '@kacola/protocol'
import type { Ctx } from '../context.ts'
import { localStamp, renderJson } from '../output.ts'
import { briefSession, mapApiError, resolveSessionId } from '../sessions.ts'

export async function sessionsList(ctx: Ctx, opts: { since?: string; limit?: number }) {
  const { sessions } = await ctx.client
    .call('listSessions', { query: { since: opts.since, limit: opts.limit ?? 20 } })
    .catch(mapApiError)
  if (ctx.format === 'json')
    return ctx.io.stdout(renderJson({ sessions: sessions.map(briefSession) }, ctx.io))
  if (!sessions.length) return ctx.io.stdout('no sessions\n')
  for (const s of sessions) {
    ctx.io.stdout(
      `${s.id}  ${localStamp(s.createdAt)}  ${formatOffset(s.durationMs).padStart(7)}  ${s.status.padEnd(9)}  ${s.title}\n`,
    )
  }
}

export async function sessionsShow(ctx: Ctx, idArg: string | undefined) {
  const id = await resolveSessionId(ctx, idArg)
  const session = await ctx.client.call('getSession', { params: { id } }).catch(mapApiError)
  // A zero-width window returns no segments but does return the total — the size of what you did not fetch.
  const t = await ctx.client
    .call('getTranscript', { params: { id }, query: { fromMs: 0, toMs: 0 } })
    .catch(mapApiError)
  const out = {
    ...briefSession(session),
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    segments: t.total,
    tracks: session.tracks.map((tr) => ({ kind: tr.kind, device: tr.device, gaps: tr.gaps })),
    error: session.error,
  }
  if (ctx.format === 'json') return ctx.io.stdout(renderJson(out, ctx.io))
  ctx.io.stdout(`${session.title}\n`)
  ctx.io.stdout(`  id        ${session.id}\n  status    ${session.status}\n`)
  ctx.io.stdout(
    `  created   ${localStamp(session.createdAt)}\n  duration  ${formatOffset(session.durationMs)}\n`,
  )
  ctx.io.stdout(`  segments  ${t.total}\n`)
  for (const tr of session.tracks) {
    const gaps = tr.gaps.length ? `, ${tr.gaps.length} gap(s)` : ''
    ctx.io.stdout(`  track     ${tr.kind} ← ${tr.device}${gaps}\n`)
  }
  if (session.error) ctx.io.stdout(`  error     ${session.error}\n`)
}
