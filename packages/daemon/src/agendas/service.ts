import {
  type Agenda,
  type AgendaMeeting,
  type AgendaView,
  type ChangedBy,
  CreateAgendaBody,
  type DurableEvent,
  formatAgendaLink,
  formatMeetingLink,
  type InviteBlockResult,
  type Meeting,
  type NewAgendaItem,
  parseAgendaMarkdown,
  parseKacolaLink,
  RESOLVED_STATUSES,
  type ResolvedLink,
  removeInviteBlock,
  renderInviteBlock,
  type Session,
  upsertInviteBlock,
} from '@kacola/protocol'
import { AgendaStore, type Store } from '@kacola/store'
import type { z } from 'zod'
import { attending } from '../calendar/meetings.ts'
import type { CalendarService } from '../calendar/service.ts'
import { DaemonError } from '../errors.ts'
import type { Logger } from '../logger.ts'

// Agendas in the daemon (kacola phases 1–2): everything that needs the calendar or the recording.
//
//   create         from a calendar occurrence (by meeting id, or by iCalendar UID + start), or unlinked;
//                  a recurring meeting's new occurrence is seeded with the previous occurrence's
//                  unresolved items (carry-over)
//   attach         when recording starts for a meeting, its agenda gets the session id
//   roll over      when that recording stops, a recurring meeting's unresolved items are carried to the
//                  next occurrence's agenda (created if needed)
//   recap hook     called when a linked recording stops — the recap wave plugs the LLM in here
//   deep links     resolveLink(): what `kacola://agenda/…` and `kacola://meeting/<uid>?start=…` open
//   invite block   the "Agenda: https://… / Open in kacola: kacola://…" text, written into the event when the provider can
//
// The status rules themselves (forward-only, manual wins, history) live in the store (AgendaStore), so
// no path — HTTP, a later tracker, replay — can bypass them.

export type RecapContext = { agenda: AgendaView; session: Session }
export type RecapHook = (ctx: RecapContext) => Promise<void> | void

export type AgendaServiceDeps = {
  store: Store
  calendar: CalendarService
  logger: Logger
  now?: () => Date
}

type Body = z.output<typeof CreateAgendaBody>

export function toAgendaMeeting(m: Meeting): AgendaMeeting {
  return {
    eventUid: m.uid,
    start: m.start,
    end: m.end,
    recurrenceId: m.recurrenceId,
    meetingId: m.id,
    title: m.title,
    calendar: m.calendar.name,
    recurring: m.recurring,
  }
}

const sameInstant = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && Date.parse(a) === Date.parse(b)

export class AgendaService {
  readonly agendas: AgendaStore
  private readonly d: AgendaServiceDeps
  private readonly now: () => Date
  private readonly recapHooks = new Set<RecapHook>()
  private readonly stopped = new Set<string>()
  private unsubscribe: (() => void) | null = null
  private rollOverFilter: ((a: Agenda) => boolean) | null = null
  private webLink: ((a: Agenda) => string | null) | null = null

  constructor(d: AgendaServiceDeps) {
    this.d = d
    this.now = d.now ?? (() => new Date())
    this.agendas = new AgendaStore(d.store).withClock(this.now)
  }

  start(): void {
    this.unsubscribe ??= this.d.store.onCommit((e) => this.onEvent(e))
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  /** Team sharing: which agendas roll over by themselves (a follower's copy waits for the owner's). */
  setRollOverFilter(f: (a: Agenda) => boolean): void {
    this.rollOverFilter = f
  }

  /** Team sharing: the https link of a shared agenda (`<host>/a/<token>`), null when it is not shared. */
  setWebLink(f: (a: Agenda) => string | null): void {
    this.webLink = f
  }

  /** The recap wave's hook point: called once per linked recording when it stops. */
  onRecap(hook: RecapHook): () => void {
    this.recapHooks.add(hook)
    return () => this.recapHooks.delete(hook)
  }

  // ------------------------------------------------------------------------------- the calendar

  /** Occurrences of one event the calendar knows, by start. */
  private occurrences(eventUid: string): Meeting[] {
    return this.d.calendar
      .all()
      .filter((m) => m.uid === eventUid)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  }

  /** The occurrence of `eventUid` at `start` (by start or RECURRENCE-ID), or its current/next one. */
  findOccurrence(eventUid: string, start?: string | null): Meeting | null {
    const list = this.occurrences(eventUid)
    if (start)
      return list.find((m) => sameInstant(m.start, start) || sameInstant(m.recurrenceId, start)) ?? null
    const now = this.now().getTime()
    const going = list.filter(attending)
    return (
      going.find((m) => Date.parse(m.start) <= now && Date.parse(m.end) > now) ??
      going.find((m) => Date.parse(m.start) > now) ??
      null
    )
  }

  private isLive(m: Meeting | null): boolean {
    if (!m) return false
    const now = this.now().getTime()
    return Date.parse(m.start) <= now && Date.parse(m.end) > now
  }

  /** The calendar occurrence an agenda is for, if the calendar still has it. */
  meetingOf(a: Agenda): Meeting | null {
    if (!a.meeting) return null
    const byId = a.meeting.meetingId ? this.d.calendar.get(a.meeting.meetingId) : null
    return byId ?? this.findOccurrence(a.meeting.eventUid, a.meeting.recurrenceId ?? a.meeting.start)
  }

  /** Resolve the meeting forms of a create/update body to an occurrence (or null for "unlinked"). */
  private meetingFor(o: { meetingId?: string | null; eventUid?: string; start?: string }, title?: string) {
    if (o.meetingId) {
      const m = this.d.calendar.get(o.meetingId)
      if (!m) throw new DaemonError('not_found', `no meeting ${o.meetingId} in the calendar`)
      return toAgendaMeeting(m)
    }
    if (o.eventUid) {
      const m = this.findOccurrence(o.eventUid, o.start)
      if (m) return toAgendaMeeting(m)
      if (!o.start)
        throw new DaemonError(
          'not_found',
          `no current or upcoming occurrence of event ${o.eventUid} in the calendar (pass start)`,
        )
      // not in the calendar (outside its window, or calendar off): link by what we were told
      return {
        eventUid: o.eventUid,
        start: new Date(o.start).toISOString(),
        end: null,
        recurrenceId: null,
        meetingId: null,
        title: title ?? o.eventUid,
        calendar: null,
        recurring: false,
      } satisfies AgendaMeeting
    }
    return null
  }

  // ------------------------------------------------------------------------------------ create

  create(raw: z.input<typeof CreateAgendaBody>): { view: AgendaView; created: boolean } {
    const body: Body = CreateAgendaBody.parse(raw)
    const md = body.markdown !== undefined ? parseAgendaMarkdown(body.markdown) : null
    const meeting = this.meetingFor(body, body.title ?? md?.title ?? undefined)
    if (meeting) {
      const existing = this.agendas.forOccurrence(meeting)
      if (existing) {
        if (body.ifExists === 'reuse') return { view: this.agendas.view(existing.id)!, created: false }
        throw new DaemonError(
          'conflict',
          `"${meeting.title}" already has an agenda (${existing.id}); add to it, or pass ifExists: reuse`,
        )
      }
    }
    const title = body.title ?? md?.title ?? meeting?.title
    if (!title) throw new DaemonError('bad_request', 'an agenda without a meeting needs a title')
    const items: NewAgendaItem[] = [...(md?.items ?? []), ...(body.items ?? [])]
    const carryFrom =
      meeting?.recurring && body.carryOver !== false
        ? (this.agendas.previousOccurrence(meeting.eventUid, meeting.start)?.id ?? null)
        : null
    const view = this.agendas.create({
      title,
      meeting,
      goals: body.goals ?? md?.goals ?? [],
      private: body.private,
      items,
      carryFrom,
      by: body.by,
    })
    this.d.logger.info('agenda created', {
      agendaId: view.agenda.id,
      meeting: meeting?.meetingId ?? meeting?.eventUid ?? null,
      items: view.items.length,
      carriedFrom: carryFrom,
    })
    // recording may already be under way for this meeting
    if (meeting) {
      const live = this.d.store
        .sessionsWithStatus(['recording', 'paused'])
        .find((s) => this.sessionMatches(s, view.agenda))
      if (live) return { view: this.attach(view.agenda.id, live.id), created: true }
    }
    return { view, created: true }
  }

  private attach(agendaId: string, sessionId: string): AgendaView {
    this.agendas.attachSession(agendaId, sessionId)
    this.d.logger.info('agenda linked to recording', { agendaId, sessionId })
    return this.agendas.view(agendaId)!
  }

  // ---------------------------------------------------------------------- recording lifecycle

  private sessionMatches(s: Session, a: Agenda): boolean {
    const sm = s.meeting
    const am = a.meeting
    if (!sm || !am || sm.uid !== am.eventUid) return false
    if (am.meetingId && am.meetingId === sm.id) return true
    return sameInstant(am.start, sm.start) || sameInstant(am.recurrenceId, sm.start)
  }

  private onEvent(e: DurableEvent): void {
    if (e.data.type !== 'session.upserted') return
    const s = e.data.session
    try {
      if ((s.status === 'recording' || s.status === 'paused') && s.meeting) {
        for (const a of this.agendas.forEvent(s.meeting.uid))
          if (a.sessionId !== s.id && this.sessionMatches(s, a)) this.attach(a.id, s.id)
      } else if ((s.status === 'stopped' || s.status === 'recovered') && !this.stopped.has(s.id)) {
        const linked = this.agendas.bySession(s.id)
        if (!linked.length) return
        this.stopped.add(s.id)
        for (const a of linked) {
          this.rollOver(a.id)
          void this.recap(a.id, s)
        }
      }
    } catch (err) {
      this.d.logger.warn('agenda follow-up failed', { sessionId: s.id, err: String(err) })
    }
  }

  private async recap(agendaId: string, session: Session): Promise<void> {
    const view = this.agendas.view(agendaId)
    if (!view) return
    for (const hook of [...this.recapHooks]) {
      try {
        await hook({ agenda: view, session })
      } catch (err) {
        this.d.logger.warn('agenda recap hook failed', { agendaId, err: String(err) })
      }
    }
  }

  /**
   * Carry a recurring meeting's unresolved items to its next occurrence: that occurrence's agenda is
   * created (seeded by carry-over) if it has none; an existing one is left alone (it was seeded when it
   * was created, or the user built it by hand). Returns the next agenda, or null.
   */
  rollOver(agendaId: string): Agenda | null {
    const a = this.agendas.get(agendaId)
    if (!a?.meeting?.recurring) return null
    if (this.rollOverFilter && !this.rollOverFilter(a)) return null
    const open = this.agendas.items(a.id).filter((i) => !RESOLVED_STATUSES.includes(i.status))
    if (!open.length) return null
    const after = Date.parse(a.meeting.start)
    const next = this.occurrences(a.meeting.eventUid).find((m) => Date.parse(m.start) > after && attending(m))
    if (!next) return null
    const existing = this.agendas.forOccurrence(toAgendaMeeting(next))
    if (existing) return existing
    const { view } = this.create({ meetingId: next.id, private: a.private, by: 'user' })
    this.d.logger.info('agenda rolled over', { from: a.id, to: view.agenda.id, items: open.length })
    return view.agenda
  }

  // ---------------------------------------------------------------------------------- deep links

  /**
   * What a deep link opens (`resolveMeetingLink` in the plan): the agenda (created when asked and the
   * meeting is known), the calendar occurrence, and whether it is live now (the app offers Join and
   * record). A private agenda resolves to null unless includePrivate.
   */
  resolveLink(o: {
    link?: string
    eventUid?: string
    start?: string
    create?: boolean
    includePrivate?: boolean
  }): ResolvedLink {
    let eventUid = o.eventUid
    let start: string | null = o.start ?? null
    if (o.link !== undefined) {
      const parsed = parseKacolaLink(o.link)
      if (!parsed) throw new DaemonError('bad_request', `not a kacola:// link: ${o.link.slice(0, 200)}`)
      if (parsed.kind === 'agenda') {
        const a = this.agendas.get(parsed.agendaId)
        if (!a || !this.agendas.isVisible(a, o.includePrivate))
          throw new DaemonError('not_found', `no agenda ${parsed.agendaId}`)
        const m = this.meetingOf(a)
        return { agenda: this.agendas.view(a.id), meeting: m, live: this.isLive(m), created: false }
      }
      eventUid = parsed.eventUid
      start = parsed.start
    }
    if (!eventUid) throw new DaemonError('bad_request', 'pass a link, or an eventUid')
    return this.resolveMeetingLink(eventUid, start, o)
  }

  resolveMeetingLink(
    eventUid: string,
    start: string | null,
    o: { create?: boolean; includePrivate?: boolean } = {},
  ): ResolvedLink {
    const m = this.findOccurrence(eventUid, start)
    let agenda: Agenda | null = m ? this.agendas.forOccurrence(toAgendaMeeting(m)) : null
    if (!agenda) {
      const all = this.agendas.forEvent(eventUid)
      agenda = start
        ? (all.find(
            (a) => sameInstant(a.meeting?.start, start) || sameInstant(a.meeting?.recurrenceId, start),
          ) ?? null)
        : m
          ? null
          : (all.at(-1) ?? null)
    }
    if (agenda && !this.agendas.isVisible(agenda, o.includePrivate)) agenda = null
    else if (!agenda && m && o.create) {
      const { view } = this.create({ meetingId: m.id, ifExists: 'reuse' })
      return { agenda: view, meeting: m, live: this.isLive(m), created: true }
    }
    return {
      agenda: agenda ? this.agendas.view(agenda.id) : null,
      meeting: m,
      live: this.isLive(m),
      created: false,
    }
  }

  // --------------------------------------------------------------------------------- invite block

  links(a: Agenda): { appLink: string; webLink: string | null } {
    // a series gets the series link: it opens whichever occurrence is current or next, so the invitation
    // stays right for every occurrence; a one-off gets its agenda.
    const appLink = a.meeting?.recurring ? formatMeetingLink(a.meeting.eventUid) : formatAgendaLink(a.id)
    // the web page exists only once the agenda is shared (team sharing: `<host>/a/<token>`)
    return { appLink, webLink: this.webLink?.(a) ?? null }
  }

  async inviteBlock(agendaId: string, o: { write?: boolean; remove?: boolean }): Promise<InviteBlockResult> {
    const a = this.agendas.get(agendaId)
    if (!a) throw new DaemonError('not_found', `no agenda ${agendaId}`)
    const { appLink, webLink } = this.links(a)
    const block = renderInviteBlock({ appLink, webLink })
    const out = { block, appLink, webLink, written: false, reason: null as string | null }
    if (!o.write && !o.remove) return out
    if (!a.meeting) return { ...out, reason: 'this agenda is not linked to a calendar event' }
    const m = this.meetingOf(a)
    if (!m) return { ...out, reason: 'the calendar event is not in the calendar right now' }
    const r = await this.d.calendar.editDescription(m, (d) =>
      o.remove ? removeInviteBlock(d) : upsertInviteBlock(d, block),
    )
    if (!r.ok) return { ...out, reason: r.reason }
    this.d.logger.info('agenda invite block', { agendaId, remove: Boolean(o.remove), changed: r.changed })
    return { ...out, written: true }
  }

  // ----------------------------------------------------------------------------------- helpers

  /** A header patch from an update body: title, goals, privacy, and a meeting relink. */
  relink(o: {
    meetingId?: string | null
    eventUid?: string
    start?: string
  }): AgendaMeeting | null | undefined {
    if (o.meetingId === null) return null
    if (o.meetingId === undefined && o.eventUid === undefined) return undefined
    return this.meetingFor({ meetingId: o.meetingId ?? undefined, eventUid: o.eventUid, start: o.start })
  }

  /** `by` defaults to the user. */
  by(v: ChangedBy | undefined): ChangedBy {
    return v ?? 'user'
  }
}
