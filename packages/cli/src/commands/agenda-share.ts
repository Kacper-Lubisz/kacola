import {
  type AgendaView,
  parseShareLink,
  type SharedActor,
  type SharedChange,
  type ShareStatus,
} from '@gnomeola/protocol'
import type { Ctx } from '../context.ts'
import { usage } from '../errors.ts'
import { renderJson } from '../output.ts'
import { mapApiError } from '../sessions.ts'
import { resolveAgendaId } from './agenda.ts'

// Team sharing from the CLI (docs/sharing.md): share an agenda on the hosted server (a web link for
// invitees; attendees who run kacola follow it), unshare it, read its sharing status and its merge
// history, share a recap, and follow someone else's agenda by its link and a code the host emails.
//
// Sharing puts the agenda's items (never transcripts, notes, evidence or private cards) on a server
// other people read, so it is the USER's act: an agent runs `share`, `unshare`, `share-recap` and
// `follow` only when the user asked for exactly that (the skill says so). The MCP surface exposes the
// reads only (status, history). Exit codes: 6 no sharing host configured (503), 1 refused by the
// daemon (409: a private agenda, someone else's copy), 5 a wrong or expired code (403), 4 not found.

const brief = (s: ShareStatus, v?: AgendaView) => {
  const text = (id: string | null) => (id ? (v?.items.find((i) => i.id === id)?.text ?? null) : null)
  return {
    agendaId: s.agendaId,
    shared: s.shared,
    role: s.role,
    link: s.link,
    state: s.state,
    ...(s.error ? { error: s.error } : {}),
    lastSyncAt: s.lastSyncAt,
    pending: s.pending,
    refused: s.refused,
    ...(s.role === 'owner' || s.shared
      ? {
          ownerName: s.ownerName,
          shareGoals: s.shareGoals,
          allowInvitees: s.allowInvitees,
          members: s.members,
          recapShared: s.recapShared,
        }
      : {}),
    // an unshared agenda's comments and people went with the share
    comments: (s.shared || s.state === 'revoked' ? s.comments : [])
      .filter((c) => !c.hidden)
      .slice(-50)
      .map((c) => ({
        itemId: c.itemId,
        ...(c.itemId ? { item: text(c.itemId) } : {}),
        author: who(c.author),
        role: c.author.role,
        text: c.text,
        at: c.at,
      })),
    ...(s.role === 'owner' && s.shared
      ? {
          participants: s.participants.map((p) => ({
            email: p.email,
            name: p.name,
            role: p.role,
            ...(p.revokedAt ? { removed: true } : {}),
          })),
        }
      : {}),
  }
}

/** "Ben", "ben@example.com (tracker)", "Kacper (agent:claude)". */
function who(a: SharedActor): string {
  const name = a.name ?? a.label
  return a.by === 'tracker' || a.by.startsWith('agent:') ? `${name} (${a.by})` : name
}

const briefChange = (c: SharedChange, v?: AgendaView) => ({
  itemId: c.itemId,
  item: v?.items.find((i) => i.id === c.itemId)?.text ?? null,
  from: c.from,
  to: c.to,
  by: who(c.actor),
  role: c.actor.role,
  outcome: c.outcome,
  ...(c.reason ? { reason: c.reason } : {}),
  ...(c.auto ? { auto: true } : {}),
  at: c.at,
})

const STATE: Record<ShareStatus['state'], string> = {
  off: 'not shared',
  ok: 'up to date',
  syncing: 'syncing',
  error: 'sync failed',
  revoked: 'no longer shared (the owner unshared it)',
}

async function viewOrNull(ctx: Ctx, id: string): Promise<AgendaView | undefined> {
  return ctx.client
    .call('getAgenda', { params: { id }, query: { includePrivate: false } })
    .catch(() => undefined)
}

function print(ctx: Ctx, s: ShareStatus, v?: AgendaView) {
  if (ctx.format === 'json') return ctx.io.stdout(renderJson(brief(s, v), ctx.io))
  const lines = [
    s.role === 'member'
      ? `following ${s.ownerName ?? 'the organizer'}'s agenda — ${STATE[s.state]}`
      : STATE[s.state],
  ]
  if (s.link) lines.push(`link: ${s.link}`)
  if (s.error) lines.push(`error: ${s.error}`)
  if (s.shared && s.role === 'owner') {
    lines.push(
      `invitees: ${s.allowInvitees ? 'may add items and comment' : 'read only'} · goals ${s.shareGoals ? 'shared' : 'kept private'} · recap ${s.recapShared ? 'shared' : 'not shared'}`,
    )
    if (s.members.length) lines.push(`attendees who follow in kacola: ${s.members.join(', ')}`)
  }
  if (s.pending) lines.push(`${s.pending} change(s) waiting to be pushed`)
  if (s.refused) lines.push(`${s.refused} change(s) refused or superseded — see \`agenda share-history\``)
  for (const c of s.comments.filter((x) => !x.hidden).slice(-20))
    lines.push(
      `  ${who(c.author)}${c.itemId ? ` on "${v?.items.find((i) => i.id === c.itemId)?.text ?? c.itemId}"` : ''}: ${c.text}`,
    )
  ctx.io.stdout(`${lines.join('\n')}\n`)
}

const emails = (s: string | undefined): string[] | undefined =>
  s === undefined
    ? undefined
    : s
        .split(/[\s,;]+/)
        .map((e) => e.trim())
        .filter(Boolean)

export type ShareOpts = { name?: string; members?: string; goals?: boolean; noInvitees?: boolean }

/** Share the agenda on the configured host (or update its options): prints the status with the link. */
export async function agendaShareOn(ctx: Ctx, ref: string | undefined, o: ShareOpts) {
  const id = await resolveAgendaId(ctx, ref)
  const s = await ctx.client
    .call('shareAgenda', {
      params: { id },
      body: {
        ...(o.name ? { ownerName: o.name } : {}),
        ...(o.goals !== undefined ? { shareGoals: o.goals } : {}),
        ...(o.noInvitees ? { allowInvitees: false } : {}),
        ...(o.members !== undefined ? { members: emails(o.members) } : {}),
      },
    })
    .catch(mapApiError)
  print(ctx, s, await viewOrNull(ctx, id))
}

/** Owner: unshare (the link answers 410). Member: stop following (the local copy stays). */
export async function agendaUnshare(ctx: Ctx, ref: string | undefined) {
  const id = await resolveAgendaId(ctx, ref)
  const s = await ctx.client.call('unshareAgenda', { params: { id } }).catch(mapApiError)
  print(ctx, s)
}

export async function agendaShareStatus(ctx: Ctx, ref: string | undefined) {
  const id = await resolveAgendaId(ctx, ref)
  const s = await ctx.client.call('getAgendaShare', { params: { id } }).catch(mapApiError)
  print(ctx, s, await viewOrNull(ctx, id))
}

/** Owner: share this occurrence's recap (the outcomes), or with `off` stop sharing it. */
export async function agendaShareRecap(ctx: Ctx, ref: string | undefined, o: { off?: boolean }) {
  const id = await resolveAgendaId(ctx, ref)
  const s = await ctx.client
    .call('shareAgendaRecap', { params: { id }, body: { shared: !o.off } })
    .catch(mapApiError)
  print(ctx, s, await viewOrNull(ctx, id))
}

/** Every status change any device submitted, with what became of it (newest last, the latest 100). */
export async function agendaShareHistory(ctx: Ctx, ref: string | undefined) {
  const id = await resolveAgendaId(ctx, ref)
  const { changes } = await ctx.client.call('getAgendaShareHistory', { params: { id } }).catch(mapApiError)
  const v = await viewOrNull(ctx, id)
  const shown = changes.slice(-100)
  if (ctx.format === 'json')
    return ctx.io.stdout(
      renderJson(
        { agendaId: id, total: changes.length, changes: shown.map((c) => briefChange(c, v)) },
        ctx.io,
      ),
    )
  if (!shown.length) return ctx.io.stdout('no status changes yet\n')
  for (const c of shown.map((x) => briefChange(x, v)))
    ctx.io.stdout(
      `${c.at}  ${c.item ?? c.itemId}: ${c.from} → ${c.to} by ${c.by} — ${c.outcome}${c.reason ? ` (${c.reason})` : ''}\n`,
    )
}

const linkOf = (link: string | undefined): string => {
  if (!link || !parseShareLink(link))
    throw usage('which shared agenda? pass its link: https://<host>/a/<token>')
  return link
}

/** Ask to follow someone's shared agenda: the host emails a code (only to an address it may let in). */
export async function agendaFollow(ctx: Ctx, link: string | undefined, o: { email?: string; name?: string }) {
  const l = linkOf(link)
  if (!o.email) throw usage('which address did the organizer invite? --email you@example.com')
  const r = await ctx.client
    .call('followAgenda', { body: { link: l, email: o.email, ...(o.name ? { name: o.name } : {}) } })
    .catch(mapApiError)
  if (ctx.format === 'json') return ctx.io.stdout(renderJson(r, ctx.io))
  ctx.io.stdout(
    `if ${o.email} may follow it, a code is on its way (valid until ${r.expiresAt})\nthen: gnomeola agenda follow-confirm ${l} --email ${o.email} --code <CODE>\n`,
  )
}

/** The emailed code → a local copy of the agenda that follows the share. */
export async function agendaFollowConfirm(
  ctx: Ctx,
  link: string | undefined,
  o: { email?: string; code?: string },
) {
  const l = linkOf(link)
  if (!o.email || !o.code) throw usage('pass --email and the --code the host emailed')
  const s = await ctx.client
    .call('confirmFollowAgenda', { body: { link: l, email: o.email, code: o.code } })
    .catch(mapApiError)
  print(ctx, s, await viewOrNull(ctx, s.agendaId))
}
