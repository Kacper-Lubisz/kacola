import { formatOffset, ME, THEM } from '@kacola/protocol'
import type { Ctx } from '../context.ts'
import { renderJson } from '../output.ts'
import { briefSession, mapApiError, resolveSessionId } from '../sessions.ts'

// M3 — who speaks in a meeting. Read-only: naming, merging and splitting speakers happen in the window.
// The labels printed here are exactly what `--speaker` matches in `search` and `transcript`.

export async function speakers(ctx: Ctx, idArg: string | undefined) {
  const id = await resolveSessionId(ctx, idArg)
  const session = await ctx.client.call('getSession', { params: { id } }).catch(mapApiError)
  const r = await ctx.client.call('listSpeakers', { params: { id } }).catch(mapApiError)
  const list = r.speakers.map((s) => ({
    id: s.id,
    label: s.label,
    track: s.track,
    named: s.named,
    segments: s.segments,
    talkMs: s.talkMs,
    talk: formatOffset(s.talkMs),
  }))
  if (ctx.format === 'json')
    return ctx.io.stdout(renderJson({ session: briefSession(session), speakers: list }, ctx.io))
  const people = list.filter((s) => s.segments > 0 || s.id !== ME)
  ctx.io.stdout(
    `${session.title} · ${session.id} · ${people.length} speaker${people.length === 1 ? '' : 's'}\n`,
  )
  const width = Math.max(8, ...list.map((s) => s.label.length))
  for (const s of list) {
    const note =
      s.id === ME
        ? '  (you: the microphone)'
        : s.id === THEM
          ? '  (far end, not told apart)'
          : s.named
            ? ''
            : '  (unnamed)'
    ctx.io.stdout(
      `  ${s.label.padEnd(width)}  ${String(s.segments).padStart(4)} segment${s.segments === 1 ? ' ' : 's'}  ${s.talk.padStart(6)}${note}\n`,
    )
  }
}
