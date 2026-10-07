import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Ctx } from '../context.ts'
import { renderJson } from '../output.ts'
import { mapApiError } from '../sessions.ts'

export async function bugReport(ctx: Ctx, o: { out?: string }) {
  const d = await ctx.client.call('diagnostics').catch(mapApiError)
  const stamp = d.generatedAt.replace(/[:.]/g, '-')
  const path = resolve(o.out ?? `kacola-diagnostics-${stamp}.json`)
  writeFileSync(path, `${JSON.stringify(d, null, 2)}\n`, { mode: 0o600 })
  if (ctx.format === 'json') return ctx.io.stdout(renderJson({ path, lines: d.logTail.length }, ctx.io))
  ctx.io.stdout(`wrote ${path} (${d.logTail.length} log lines, secrets redacted by the daemon)\n`)
}
