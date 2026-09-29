import type { ActionItem } from '@gnomeola/protocol'
import type { Ctx } from '../context.ts'
import { CliError, EXIT, refused, usage } from '../errors.ts'
import { localStamp, renderJson } from '../output.ts'
import { briefSession, mapApiError, resolveSessionId } from '../sessions.ts'
import { BUDGET, countTokens } from '../tokens.ts'

// N-5 — read a meeting's notes: the user's own notes, as enhanced and reviewed in the window. Notes are
// already a synthesis, so they are usually the cheapest way to answer "what did we decide / who does
// what" about one meeting. Read-only, private sessions invisible (the CLI never passes includePrivate),
// and capped like a transcript window so a pasted essay cannot flood the reader's context.

export type NotesOpts = { version?: number; actions?: boolean; versions?: boolean; full?: boolean }

export async function notes(ctx: Ctx, idArg: string | undefined, o: NotesOpts) {
  const modes = [o.version !== undefined, Boolean(o.actions), Boolean(o.versions)].filter(Boolean).length
  if (modes > 1) throw usage('use one of --version, --actions or --versions')
  const id = await resolveSessionId(ctx, idArg)
  const session = await ctx.client.call('getSession', { params: { id } }).catch(mapApiError)
  const brief = briefSession(session)

  if (o.actions) {
    const r = await ctx.client.call('getActionItems', { params: { id } }).catch(mapApiError)
    if (ctx.format === 'json')
      return ctx.io.stdout(renderJson({ session: brief, version: r.version, actionItems: r.items }, ctx.io))
    if (!r.items.length) return ctx.io.stdout(`no action items in the notes for ${session.title}\n`)
    ctx.io.stdout(`${session.title} · action items (notes v${r.version})\n`)
    for (const i of r.items) ctx.io.stdout(`${actionLine(i)}\n`)
    return
  }

  if (o.versions) {
    const { versions } = await ctx.client.call('listNoteVersions', { params: { id } }).catch(mapApiError)
    const list = versions.map((v) => ({
      version: v.version,
      kind: v.kind,
      createdAt: v.createdAt,
      baseVersion: v.baseVersion,
      chars: v.markdown.length,
    }))
    if (ctx.format === 'json') return ctx.io.stdout(renderJson({ session: brief, versions: list }, ctx.io))
    if (!list.length) return ctx.io.stdout(`no notes for ${session.title}\n`)
    for (const v of list)
      ctx.io.stdout(
        `v${v.version}  ${v.kind.padEnd(8)}  ${localStamp(v.createdAt)}  from v${v.baseVersion}  ${v.chars} chars\n`,
      )
    return
  }

  let out: { version: number; updatedAt: string | null; markdown: string; pendingEnhancement: number | null }
  if (o.version !== undefined) {
    const { versions } = await ctx.client.call('listNoteVersions', { params: { id } }).catch(mapApiError)
    const v = versions.find((x) => x.version === o.version)
    if (!v)
      throw new CliError(
        EXIT.NOT_FOUND,
        `no version ${o.version} of the notes for "${session.title}"`,
        'see --versions',
      )
    out = { version: v.version, updatedAt: v.createdAt, markdown: v.markdown, pendingEnhancement: null }
  } else {
    const { note } = await ctx.client.call('getNotes', { params: { id } }).catch(mapApiError)
    out = {
      version: note.version,
      updatedAt: note.updatedAt,
      markdown: note.markdown,
      pendingEnhancement: note.pendingEnhancement,
    }
  }
  const tokens = countTokens(out.markdown)
  if (!o.full && tokens > BUDGET.notes)
    throw refused(
      `the notes for "${session.title}" are ~${tokens} tokens, over the ${BUDGET.notes}-token ceiling`,
      'use --actions for just the action items, `gnomeola ask` for a specific question, or --full if you truly need all of it',
    )
  if (ctx.format === 'json') {
    const { pendingEnhancement, ...rest } = out
    // pendingEnhancement describes the head; a specific old version has none
    const extra = o.version === undefined ? { pendingEnhancement } : {}
    return ctx.io.stdout(renderJson({ session: brief, ...rest, ...extra }, ctx.io))
  }
  if (!out.markdown.trim()) return ctx.io.stdout(`no notes for ${session.title}\n`)
  ctx.io.stdout(out.markdown.endsWith('\n') ? out.markdown : `${out.markdown}\n`)
}

function actionLine(i: ActionItem): string {
  const meta = [i.owner ? `owner: ${i.owner}` : null, i.due ? `due: ${i.due}` : null].filter(Boolean)
  return `- [${i.done ? 'x' : ' '}] ${i.text}${meta.length ? ` (${meta.join(', ')})` : ''}`
}
