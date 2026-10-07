import { formatOffset } from '@kacola/protocol'
import type { Ctx } from '../context.ts'
import { renderJson } from '../output.ts'
import { mapApiError } from '../sessions.ts'

export async function status(ctx: Ctx) {
  const h = await ctx.client.call('health').catch(mapApiError)
  if (ctx.format === 'json') return ctx.io.stdout(renderJson({ url: ctx.client.baseUrl, ...h }, ctx.io))
  ctx.io.stdout(`kacolad ${h.version} at ${ctx.client.baseUrl} — up ${formatOffset(h.uptimeMs)}\n`)
  ctx.io.stdout(
    `  capture  ${h.capture.available ? 'available' : 'UNAVAILABLE'} (${h.capture.backend})${h.capture.detail ? ` — ${h.capture.detail}` : ''}\n`,
  )
  ctx.io.stdout(`  llm      ${h.llm.provider} ${h.llm.ready ? 'ready' : 'not configured'}\n`)
  for (const m of h.models) ctx.io.stdout(`  model    ${m.role.padEnd(5)} ${m.id} — ${m.state}\n`)
}
