import { readFileSync } from 'node:fs'
import {
  type AgendaItem,
  AgendaItemKind,
  AgendaItemStatus,
  type AgendaSummary,
  type AgendaView,
  type ContextCard,
  GnomeolaApiError,
  type Meeting,
  parseDuration,
  parseItemText,
  type StatusChange,
  type Suggestion,
  SuggestionKind,
} from '@gnomeola/protocol'
import type { Ctx } from '../context.ts'
import { CliError, EXIT, refused, usage } from '../errors.ts'
import { leaseAgenda } from '../lease.ts'
import { localStamp, renderJson, truncate } from '../output.ts'
import { mapApiError } from '../sessions.ts'
import { BUDGET, countTokens } from '../tokens.ts'

// Agendas from the CLI (kacola phases 1–2) — the first verbs besides `record` that write. They are the
// owner's verbs: what the user, or their own Claude preparing a meeting with them, does to plan it.
// Every write goes to exactly one agenda route; nothing here deletes meetings or notes. Private agendas
// (marked private, or linked to a private recording) stay invisible, as everywhere in this CLI.
//
// Refs an agent can type:
//   agenda   agd_… id or a unique prefix, `next` (the agenda of the meeting in progress or next), `latest`
//   item     an item id / prefix, a 1-based position (`2`), or its text (exact, else a unique substring)

// --------------------------------------------------------------------------------- rendering

export function briefItem(i: AgendaItem, n: number) {
  return {
    n,
    id: i.id,
    text: i.text,
    kind: i.kind,
    owner: i.owner,
    timeboxMin: i.timeboxMin,
    status: i.status,
    outcome: i.outcome,
  }
}

const briefCard = (c: ContextCard) => ({
  id: c.id,
  title: c.title,
  visibility: c.visibility,
  pinned: c.pinned,
  chars: c.body.length,
})

const briefSuggestion = (s: Suggestion) => ({
  id: s.id,
  kind: s.kind,
  text: s.text,
  itemId: s.itemId,
  source: s.source,
})

const briefChange = (c: StatusChange) => ({
  itemId: c.itemId,
  from: c.from,
  to: c.to,
  by: c.by,
  at: c.at,
  ...(c.note ? { note: c.note } : {}),
  ...(c.override ? { override: true } : {}),
  ...(c.auto ? { auto: true } : {}),
})

function briefAgenda(a: AgendaView['agenda']) {
  return {
    id: a.id,
    title: a.title,
    meeting: a.meeting
      ? {
          eventUid: a.meeting.eventUid,
          title: a.meeting.title,
          start: a.meeting.start,
          recurring: a.meeting.recurring,
        }
      : null,
    goals: a.goals,
    private: a.private,
    version: a.version,
    sessionId: a.sessionId,
    ...(a.carriedFrom ? { carriedFrom: a.carriedFrom } : {}),
  }
}

export function briefView(v: AgendaView, links?: { app: string; web: string | null }) {
  const now = Date.now()
  return {
    agenda: briefAgenda(v.agenda),
    items: v.items.map((i, n) => briefItem(i, n + 1)),
    context: v.context.map(briefCard),
    suggestions: v.suggestions
      .filter((s) => s.state === 'open' && (!s.expiresAt || Date.parse(s.expiresAt) > now))
      .map(briefSuggestion),
    ...(links ? { links } : {}),
  }
}

const MARK: Record<AgendaItem['status'], string> = {
  open: ' ',
  'in-progress': '~',
  covered: 'x',
  skipped: '-',
  parked: '>',
}

function itemLine(i: AgendaItem, n: number): string {
  const meta = [i.timeboxMin ? `${i.timeboxMin}m` : null, i.owner ? `@${i.owner}` : null]
    .filter(Boolean)
    .join(', ')
  let line = `${String(n).padStart(2)}. [${MARK[i.status]}] ${i.text}`
  if (meta) line += ` (${meta})`
  if (i.kind !== 'topic') line += ` [${i.kind}]`
  if (i.outcome) line += `\n      → ${truncate(i.outcome.replace(/\s+/g, ' '), 200)}`
  return line
}

function viewText(v: AgendaView): string {
  const a = v.agenda
  const out = [`${a.title}${a.private ? ' (private)' : ''}  ${a.id}`]
  if (a.meeting)
    out.push(
      `meeting: ${a.meeting.title} · ${localStamp(a.meeting.start)}${a.meeting.recurring ? ' · recurring' : ''}`,
    )
  if (a.sessionId) out.push(`recording: ${a.sessionId}`)
  if (a.goals.length) out.push(`goals: ${a.goals.join('; ')}`)
  out.push(...(v.items.length ? v.items.map((i, n) => itemLine(i, n + 1)) : ['(no items yet)']))
  if (v.context.length)
    out.push(`context: ${v.context.map((c) => `${c.title} [${c.visibility}]`).join(', ')}`)
  return `${out.join('\n')}\n`
}

// ------------------------------------------------------------------------------------ refs

const AGENDA_ID = /^agd_[0-9a-z]{9}[0-9a-f]{12}$/

async function nextMeetingOrNull(ctx: Ctx): Promise<Meeting | null> {
  const r = await ctx.client.call('nextMeeting').catch(mapApiError)
  return r.current ?? r.next
}

export async function resolveAgendaId(ctx: Ctx, input: string | undefined): Promise<string> {
  // an attached agent's default is the agenda of the recording it is attached to
  const ref = input ?? (ctx.lease ? 'live' : 'next')
  if (AGENDA_ID.test(ref)) return ref
  if (ref === 'live') {
    if (ctx.lease) return leaseAgenda(ctx, ctx.lease)
    const { sessions } = await ctx.client.call('listLiveSessions', { query: {} }).catch(mapApiError)
    const s = sessions.find((x) => x.agendaId)
    if (!s) throw new CliError(EXIT.NOT_FOUND, 'no recording in progress has an agenda')
    return s.agendaId!
  }
  if (ref === 'next') {
    const m = await nextMeetingOrNull(ctx)
    if (!m) throw new CliError(EXIT.NOT_FOUND, 'there is no meeting in progress or coming up')
    const r = await ctx.client
      .call('resolveAgendaLink', { body: { eventUid: m.uid, start: m.start } })
      .catch(mapApiError)
    if (!r.agenda)
      throw new CliError(
        EXIT.NOT_FOUND,
        `"${m.title}" has no agenda yet`,
        'create one: gnomeola agenda create --meeting next',
      )
    return r.agenda.agenda.id
  }
  const { agendas } = await ctx.client.call('listAgendas', { query: { limit: 200 } }).catch(mapApiError)
  if (ref === 'latest' || ref === 'last') {
    const a = agendas[0]
    if (!a) throw new CliError(EXIT.NOT_FOUND, 'there are no agendas yet')
    return a.id
  }
  const needle = ref.startsWith('agd_') ? ref : `agd_${ref}`
  const matches = agendas.filter((a) => a.id.startsWith(needle))
  if (matches.length === 1) return matches[0]!.id
  if (!matches.length) throw new CliError(EXIT.NOT_FOUND, `no agenda matches ${JSON.stringify(ref)}`)
  throw usage(
    `${JSON.stringify(ref)} is ambiguous (${matches.length} agendas)`,
    `candidates: ${matches
      .slice(0, 5)
      .map((m) => `${m.id} "${m.title}"`)
      .join(', ')}`,
  )
}

export function resolveItem(v: AgendaView, input: string | undefined): AgendaItem {
  if (!input) throw usage('an item is required', 'an item id, its position (1, 2, …) or its text')
  const ref = input.trim().replace(/^#/, '')
  const items = v.items
  if (/^\d+$/.test(ref)) {
    const i = items[Number(ref) - 1]
    if (!i) throw new CliError(EXIT.NOT_FOUND, `the agenda has ${items.length} items, not ${ref}`)
    return i
  }
  const byId = items.filter((i) => i.id === ref || (ref.startsWith('itm_') && i.id.startsWith(ref)))
  if (byId.length === 1) return byId[0]!
  const low = ref.toLowerCase()
  const exact = items.filter((i) => i.text.toLowerCase() === low)
  if (exact.length === 1) return exact[0]!
  const partial = items.filter((i) => i.text.toLowerCase().includes(low))
  if (partial.length === 1) return partial[0]!
  if (!partial.length && !exact.length)
    throw new CliError(EXIT.NOT_FOUND, `no item matches ${JSON.stringify(input)} in "${v.agenda.title}"`)
  const c = exact.length ? exact : partial
  throw usage(
    `${JSON.stringify(input)} matches ${c.length} items`,
    `use a position or id: ${c
      .slice(0, 5)
      .map((i) => `${items.indexOf(i) + 1} "${i.text}"`)
      .join(', ')}`,
  )
}

/** A meeting ref: next | today | a meeting id (mtg_…) | an iCalendar UID. */
async function resolveMeeting(ctx: Ctx, ref: string): Promise<{ meetingId?: string; eventUid?: string }> {
  const calendarOff = (err: unknown): never => {
    if (err instanceof CliError && err.exitCode === EXIT.UNAVAILABLE) throw err
    return mapApiError(err)
  }
  if (ref === 'next') {
    const r = await ctx.client.call('nextMeeting').catch(calendarOff)
    requireCalendar(r.calendar)
    const m = r.current ?? r.next
    if (!m) throw new CliError(EXIT.NOT_FOUND, 'there is no meeting in progress or coming up')
    return { meetingId: m.id }
  }
  if (ref === 'today') {
    const d = ctx.now
    const from = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    const r = await ctx.client
      .call('listMeetings', { query: { from: from.toISOString(), to: to.toISOString() } })
      .catch(calendarOff)
    requireCalendar(r.calendar)
    const m = r.meetings.find((x) => !x.allDay && Date.parse(x.end) > d.getTime())
    if (!m) throw new CliError(EXIT.NOT_FOUND, 'no meeting left today')
    return { meetingId: m.id }
  }
  return ref.startsWith('mtg_') ? { meetingId: ref } : { eventUid: ref }
}

function requireCalendar(c: { state: string; detail: string | null }): void {
  if (c.state === 'off')
    throw new CliError(
      EXIT.UNAVAILABLE,
      'calendar reading is off in the daemon',
      'set GNOMEOLA_CALENDAR=eds for gnomeolad',
    )
  if (c.state === 'unavailable')
    throw new CliError(EXIT.UNAVAILABLE, `calendar unavailable: ${c.detail ?? 'unknown reason'}`)
}

// ------------------------------------------------------------------------------------ input

export type SourceOpts = { from?: string; stdin?: boolean }

async function readSource(ctx: Ctx, o: SourceOpts, what: string): Promise<string | undefined> {
  if (o.from && o.stdin) throw usage('pass --from FILE or --stdin, not both')
  if (o.from) {
    try {
      return readFileSync(o.from, 'utf8')
    } catch (err) {
      throw new CliError(EXIT.NOT_FOUND, `cannot read ${o.from}: ${(err as Error).message}`)
    }
  }
  if (o.stdin) {
    if (!ctx.io.stdin) throw usage(`--stdin is not available here; pass ${what} with --from FILE`)
    return ctx.io.stdin()
  }
  return undefined
}

const timebox = (v: string | undefined): number | undefined => {
  if (v === undefined) return undefined
  let ms: number
  try {
    ms = parseDuration(/^\d+$/.test(v) ? `${v}m` : v)
  } catch {
    throw usage(`--timebox must be a duration like 10m or 1h30m (got ${v})`)
  }
  const min = Math.round(ms / 60_000)
  if (min < 1 || min > 480) throw usage('--timebox must be between 1m and 8h')
  return min
}

const kind = (v: string | undefined) => {
  if (v === undefined) return undefined
  const k = AgendaItemKind.safeParse(v)
  if (!k.success) throw usage(`--kind must be one of ${AgendaItemKind.options.join(', ')}`)
  return k.data
}

/** Suggestions come only from an attached agent: its lease says who it is. */
function requireLease(ctx: Ctx, what: string): NonNullable<Ctx['lease']> {
  if (!ctx.lease)
    throw new CliError(
      EXIT.LEASE,
      `${what} needs a live lease (suggestions come from a connected agent)`,
      'attach first: gnomeola live attach [--as NAME] — and keep it running while you suggest',
    )
  return ctx.lease
}

function conflictHint(err: unknown): never {
  if (err instanceof GnomeolaApiError && err.code === 'conflict')
    throw new CliError(
      EXIT.ERROR,
      err.message,
      /already has an agenda/.test(err.message)
        ? 'rerun with --reuse to add to it, or see it with `gnomeola agenda show next`'
        : /version|changed/.test(err.message)
          ? 'export it again and reapply your edit'
          : undefined,
    )
  return mapApiError(err)
}

// --------------------------------------------------------------------------------- commands

async function view(ctx: Ctx, id: string): Promise<AgendaView> {
  return ctx.client.call('getAgenda', { params: { id } }).catch(mapApiError)
}

async function linksOf(ctx: Ctx, id: string) {
  const r = await ctx.client.call('agendaInviteBlock', { params: { id }, body: {} }).catch(mapApiError)
  return { app: r.appLink, web: r.webLink }
}

async function printView(ctx: Ctx, v: AgendaView, o: { full?: boolean; history?: StatusChange[] } = {}) {
  const payload = {
    ...briefView(v, await linksOf(ctx, v.agenda.id)),
    ...(o.history ? { history: o.history.slice(-50).map(briefChange) } : {}),
  }
  const json = renderJson(payload, ctx.io)
  const tokens = countTokens(json)
  if (!o.full && tokens > BUDGET.agenda)
    throw refused(
      `the agenda "${v.agenda.title}" is ~${tokens} tokens, over the ${BUDGET.agenda}-token ceiling`,
      'use `gnomeola agenda export` for the compact markdown form, or --full',
    )
  if (ctx.format === 'json') return ctx.io.stdout(json)
  ctx.io.stdout(viewText(v))
  if (o.history?.length)
    for (const c of o.history.slice(-50))
      ctx.io.stdout(
        `  ${localStamp(c.at)}  ${c.from} → ${c.to}  by ${c.by}${c.override ? ' (override)' : ''}\n`,
      )
}

export type CreateOpts = SourceOpts & {
  meeting?: string
  start?: string
  title?: string
  private?: boolean
  noCarryOver?: boolean
  reuse?: boolean
}

export async function agendaCreate(ctx: Ctx, o: CreateOpts) {
  if (!o.meeting && !o.title && !o.from && !o.stdin)
    throw usage('say which meeting (--meeting next|today|<id>) or give a --title', 'see gnomeola --help')
  const markdown = await readSource(ctx, o, 'the agenda')
  const meeting = o.meeting ? await resolveMeeting(ctx, o.meeting) : {}
  const v = await ctx.client
    .call('createAgenda', {
      body: {
        ...meeting,
        ...(o.start ? { start: new Date(o.start).toISOString() } : {}),
        ...(o.title ? { title: o.title } : {}),
        ...(markdown !== undefined ? { markdown } : {}),
        ...(o.private ? { private: true } : {}),
        ...(o.noCarryOver ? { carryOver: false } : {}),
        ...(o.reuse ? { ifExists: 'reuse' as const } : {}),
      },
    })
    .catch(conflictHint)
  await printView(ctx, v)
}

/** The iCalendar UID behind a meeting ref (a UID stays as it is). */
async function eventUidOf(ctx: Ctx, ref: string): Promise<string> {
  const m = await resolveMeeting(ctx, ref)
  if (m.eventUid) return m.eventUid
  const from = new Date(ctx.now.getTime() - 86_400_000)
  const to = new Date(ctx.now.getTime() + 60 * 86_400_000)
  const r = await ctx.client
    .call('listMeetings', {
      query: { from: from.toISOString(), to: to.toISOString(), includeDeclined: true },
    })
    .catch(mapApiError)
  const hit = r.meetings.find((x) => x.id === m.meetingId)
  if (!hit) throw new CliError(EXIT.NOT_FOUND, `no meeting ${m.meetingId} in the calendar`)
  return hit.uid
}

export async function agendaList(ctx: Ctx, o: { meeting?: string; since?: string; limit?: number }) {
  // --meeting takes any meeting ref: every occurrence of that event is listed
  const eventUid = o.meeting ? await eventUidOf(ctx, o.meeting) : undefined
  const { agendas } = await ctx.client
    .call('listAgendas', { query: { eventUid, since: o.since, limit: o.limit ?? 20 } })
    .catch(mapApiError)
  const brief = (a: AgendaSummary) => ({
    id: a.id,
    title: a.title,
    meeting: a.meeting ? { eventUid: a.meeting.eventUid, start: a.meeting.start } : null,
    counts: a.counts,
    sessionId: a.sessionId,
    updatedAt: a.updatedAt,
  })
  if (ctx.format === 'json') return ctx.io.stdout(renderJson({ agendas: agendas.map(brief) }, ctx.io))
  if (!agendas.length) return ctx.io.stdout('no agendas\n')
  for (const a of agendas) {
    const when = a.meeting ? localStamp(a.meeting.start) : 'no meeting      '
    ctx.io.stdout(`${a.id}  ${when}  ${a.title}  (${a.counts.covered}/${a.counts.items} covered)\n`)
  }
}

export async function agendaShow(
  ctx: Ctx,
  ref: string | undefined,
  o: { history?: boolean; full?: boolean },
) {
  const id = await resolveAgendaId(ctx, ref)
  const v = await view(ctx, id)
  const history = o.history
    ? (await ctx.client.call('getAgendaHistory', { params: { id } }).catch(mapApiError)).changes
    : undefined
  await printView(ctx, v, { full: o.full, history })
}

export type AddOpts = { kind?: string; owner?: string; timebox?: string; before?: string }

export async function agendaAdd(ctx: Ctx, ref: string | undefined, texts: string[], o: AddOpts) {
  if (!texts.length)
    throw usage(
      'what should be added?',
      'gnomeola agenda add <agenda> "Promo timeline (10m, @ana) [must-cover]"',
    )
  const id = await resolveAgendaId(ctx, ref)
  const before = o.before ? resolveItem(await view(ctx, id), o.before).id : undefined
  const items = texts.map((t) => {
    const parsed = parseItemText(t)
    if (!parsed.text) throw usage(`an item needs text (got ${JSON.stringify(t)})`)
    return {
      text: parsed.text,
      kind: kind(o.kind) ?? parsed.kind,
      owner: o.owner ?? parsed.owner,
      timeboxMin: timebox(o.timebox) ?? parsed.timeboxMin,
    }
  })
  const r = await ctx.client
    .call('addAgendaItems', { params: { id }, body: { items, ...(before ? { before } : {}) } })
    .catch(mapApiError)
  if (r.suggestions?.length) {
    // a suggest-mode agent: the items wait for the user to accept them
    const suggested = r.suggestions.map(briefSuggestion)
    if (ctx.format === 'json')
      return ctx.io.stdout(renderJson({ agendaId: id, added: [], suggested }, ctx.io))
    for (const s of r.suggestions) ctx.io.stdout(`suggested: ${s.text}\n`)
    return
  }
  const all = await view(ctx, id)
  const added = r.items.map((i) => briefItem(i, all.items.findIndex((x) => x.id === i.id) + 1))
  if (ctx.format === 'json')
    return ctx.io.stdout(renderJson({ agendaId: id, added, version: r.version }, ctx.io))
  for (const i of r.items)
    ctx.io.stdout(`added ${itemLine(i, all.items.findIndex((x) => x.id === i.id) + 1)}\n`)
}

export type EditOpts = {
  text?: string
  kind?: string
  owner?: string
  noOwner?: boolean
  timebox?: string
  outcome?: string
}

export async function agendaEdit(
  ctx: Ctx,
  ref: string | undefined,
  itemRef: string | undefined,
  o: EditOpts,
) {
  const id = await resolveAgendaId(ctx, ref)
  const item = resolveItem(await view(ctx, id), itemRef)
  if (o.owner !== undefined && o.noOwner) throw usage('pass --owner or --no-owner, not both')
  const body = {
    ...(o.text !== undefined ? { text: o.text } : {}),
    ...(o.kind !== undefined ? { kind: kind(o.kind) } : {}),
    ...(o.owner !== undefined ? { owner: o.owner } : o.noOwner ? { owner: null } : {}),
    ...(o.timebox !== undefined ? { timeboxMin: timebox(o.timebox) } : {}),
    ...(o.outcome !== undefined ? { outcome: o.outcome } : {}),
  }
  if (!Object.keys(body).length)
    throw usage('nothing to change', 'pass --text, --kind, --owner, --timebox or --outcome')
  const out = await ctx.client
    .call('updateAgendaItem', { params: { id, itemId: item.id }, body })
    .catch(mapApiError)
  const n = item.order + 1
  if (ctx.format === 'json')
    return ctx.io.stdout(renderJson({ agendaId: id, item: briefItem(out, n) }, ctx.io))
  ctx.io.stdout(`${itemLine(out, n)}\n`)
}

export async function agendaRemove(ctx: Ctx, ref: string | undefined, itemRef: string | undefined) {
  const id = await resolveAgendaId(ctx, ref)
  const item = resolveItem(await view(ctx, id), itemRef)
  await ctx.client.call('deleteAgendaItem', { params: { id, itemId: item.id } }).catch(mapApiError)
  if (ctx.format === 'json') return ctx.io.stdout(renderJson({ agendaId: id, removed: item.id }, ctx.io))
  ctx.io.stdout(`removed "${item.text}"\n`)
}

export type StatusOpts = { evidence?: string; segment?: string; note?: string; outcome?: string }

export async function agendaStatus(
  ctx: Ctx,
  ref: string | undefined,
  itemRef: string | undefined,
  status: string | undefined,
  o: StatusOpts,
) {
  const s = AgendaItemStatus.safeParse(status)
  if (!s.success) throw usage(`the status must be one of ${AgendaItemStatus.options.join(', ')}`)
  const id = await resolveAgendaId(ctx, ref)
  const v = await view(ctx, id)
  const item = resolveItem(v, itemRef)
  const r = await ctx.client
    .call('setAgendaItemStatus', {
      params: { id, itemId: item.id },
      body: {
        status: s.data,
        ...(o.evidence !== undefined || o.segment !== undefined
          ? {
              evidence: [
                { segmentId: o.segment ?? null, quote: (o.evidence ?? '').slice(0, 500), confidence: null },
              ],
            }
          : {}),
        ...(o.note ? { note: o.note } : {}),
        ...(o.outcome !== undefined ? { outcome: o.outcome } : {}),
      },
    })
    .catch(mapApiError)
  const n = v.items.findIndex((x) => x.id === item.id) + 1
  if (ctx.format === 'json')
    return ctx.io.stdout(
      renderJson(
        {
          agendaId: id,
          item: briefItem(r.item, n),
          change: r.change && briefChange(r.change),
          ...(r.suggestion ? { suggested: briefSuggestion(r.suggestion) } : {}),
        },
        ctx.io,
      ),
    )
  if (r.suggestion) return ctx.io.stdout(`suggested (the user decides): ${r.suggestion.text}\n`)
  ctx.io.stdout(`${itemLine(r.item, n)}${r.change ? '' : '  (unchanged)'}\n`)
}

export async function agendaExport(ctx: Ctx, ref: string | undefined) {
  const id = await resolveAgendaId(ctx, ref)
  const r = await ctx.client.call('exportAgendaMarkdown', { params: { id } }).catch(mapApiError)
  if (ctx.format === 'json') return ctx.io.stdout(renderJson({ agendaId: id, ...r }, ctx.io))
  ctx.io.stdout(r.markdown)
}

export async function agendaImport(ctx: Ctx, ref: string | undefined, o: SourceOpts & { merge?: boolean }) {
  const markdown = await readSource(ctx, o, 'the markdown')
  if (markdown === undefined) throw usage('pass the markdown with --from FILE or --stdin')
  const id = await resolveAgendaId(ctx, ref)
  const { version } = await ctx.client.call('exportAgendaMarkdown', { params: { id } }).catch(mapApiError)
  const v = await ctx.client
    .call('importAgendaMarkdown', {
      params: { id },
      body: { markdown, baseVersion: version, ...(o.merge ? { mode: 'merge' as const } : {}) },
    })
    .catch(conflictHint)
  await printView(ctx, v)
}

export async function agendaLink(ctx: Ctx, ref: string | undefined, o: { meeting?: string; start?: string }) {
  if (!o.meeting) throw usage('which meeting? --meeting next|today|<meeting id|event uid>')
  const id = await resolveAgendaId(ctx, ref)
  const m = await resolveMeeting(ctx, o.meeting)
  await ctx.client
    .call('updateAgenda', {
      params: { id },
      body: { ...m, ...(o.start ? { start: new Date(o.start).toISOString() } : {}) },
    })
    .catch(conflictHint)
  await printView(ctx, await view(ctx, id))
}

/** The invitation block (`Agenda: https://…` then `Open in kacola: kacola://…`); `write` puts it into the calendar event. */
export async function agendaInvite(
  ctx: Ctx,
  ref: string | undefined,
  o: { write?: boolean; remove?: boolean },
) {
  if (o.write && o.remove) throw usage('pass --write or --remove, not both')
  const id = await resolveAgendaId(ctx, ref)
  const r = await ctx.client
    .call('agendaInviteBlock', { params: { id }, body: { write: o.write, remove: o.remove } })
    .catch(mapApiError)
  if (ctx.format === 'json') return ctx.io.stdout(renderJson({ agendaId: id, ...r }, ctx.io))
  ctx.io.stdout(`${r.block}\n`)
  if (o.write || o.remove)
    ctx.io.stdout(
      r.written
        ? `${o.remove ? 'removed from' : 'written to'} the invitation\n`
        : `not written: ${r.reason}\n`,
    )
}

export type ContextOpts = SourceOpts & {
  agenda?: string
  title?: string
  file?: string
  body?: string
  shared?: boolean
  pinned?: boolean
}

export async function contextAdd(ctx: Ctx, o: ContextOpts) {
  if (!o.title) throw usage('a context card needs --title')
  const sources = [o.file !== undefined, Boolean(o.stdin), o.body !== undefined].filter(Boolean).length
  if (sources !== 1) throw usage('pass exactly one of --file F, --stdin or --body TEXT')
  if (ctx.lease && o.shared)
    throw refused("a connected agent's cards are private", 'only the user shares a card with invitees')
  const body = o.body ?? (await readSource(ctx, { from: o.file, stdin: o.stdin }, 'the card'))!
  if (countTokens(body) > BUDGET.contextCard)
    throw refused(
      `that card is ~${countTokens(body)} tokens, over the ${BUDGET.contextCard}-token ceiling for one card`,
      'summarise it first: a card is what the user should glance at in the meeting',
    )
  const id = await resolveAgendaId(ctx, o.agenda)
  const card = await ctx.client
    .call('addContextCard', {
      params: { id },
      body: {
        title: o.title,
        body,
        source: o.file ? { kind: 'path', ref: o.file } : { kind: 'user', ref: null },
        visibility: o.shared ? 'shared' : 'private',
        ...(o.pinned ? { pinned: true } : {}),
      },
    })
    .catch(mapApiError)
  if (ctx.format === 'json') return ctx.io.stdout(renderJson({ agendaId: id, card: briefCard(card) }, ctx.io))
  ctx.io.stdout(`added context "${card.title}" (${card.visibility})\n`)
}

export type SuggestOpts = { agenda?: string; kind?: string; item?: string }

export async function suggest(ctx: Ctx, text: string, o: SuggestOpts) {
  if (!text.trim())
    throw usage('what is the suggestion?', 'gnomeola suggest "ask about the Q1 hiring plan" --kind question')
  const k = SuggestionKind.safeParse(o.kind)
  const kinds = SuggestionKind.options.filter((x) => x !== 'set-status' && x !== 'add-item')
  if (!k.success || !(kinds as string[]).includes(k.data))
    throw usage(`--kind must be one of ${kinds.join(', ')}`)
  const lease = requireLease(ctx, 'suggest')
  const id = await resolveAgendaId(ctx, o.agenda)
  const itemId = o.item ? resolveItem(await view(ctx, id), o.item).id : undefined
  const s = await ctx.client
    .call('addSuggestion', {
      params: { id },
      // the daemon takes the author from the lease, whatever is sent here
      body: { kind: k.data, text, source: `agent:${lease.name ?? 'claude'}`, ...(itemId ? { itemId } : {}) },
    })
    .catch(mapApiError)
  if (ctx.format === 'json')
    return ctx.io.stdout(renderJson({ agendaId: id, suggestion: briefSuggestion(s) }, ctx.io))
  ctx.io.stdout(`suggested (${s.kind}): ${s.text}\n`)
}
