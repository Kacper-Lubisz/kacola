import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import {
  type AgendaItem,
  type AgendaItemStatus,
  type AgendaView,
  type AgentAccess,
  type AgentAction,
  type AgentLease,
  type AgentMode,
  type AgentPresenceState,
  type ChangedBy,
  type ContextCard,
  type ContextSource,
  type DurableEvent,
  type Evidence,
  isForwardMove,
  LEASE_HEADER,
  type LeaseEndReason,
  type LeaseGrant,
  type LeaseInfo,
  type LiveSession,
  type NewAgendaItem,
  NewAgendaItem as NewAgendaItemSchema,
  newAgendaId,
  type Segment,
  type Session,
  type StatusChange,
  type Suggestion,
  type SuggestionKind,
} from '@gnomeola/protocol'
import type { Store } from '@gnomeola/store'
import type { AgendaService } from '../agendas/service.ts'
import type { EventBus } from '../bus.ts'
import { DaemonError } from '../errors.ts'
import type { Logger } from '../logger.ts'
import type { SettingsService } from '../settings.ts'
import {
  INJECTION_FLAG,
  looksSecret,
  passThroughGuard,
  runGuard,
  type SpeechGuard,
  type SpeechVerdict,
} from './guard.ts'

// The agent channel (kacola phase 4): a connected agent's lease on one recording, and every rule its
// writes go through.
//
// Security model: the daemon is a loopback service, and any local process can reach it. That is the
// same trust level as the user's own CLI, so the lease is not about keeping local code out. It exists
// to make an agent's writes BOUNDED and ATTRIBUTED, whatever the agent was talked into by what it heard:
//
//   - a lease is scoped to ONE session (and so to that session's agenda), carries a mode, and dies at
//     the meeting's end, on a missed heartbeat, on revoke, or when the session becomes unattachable.
//   - an agent's request carries the lease token (LEASE_HEADER). Its attribution is bound to the lease
//     (`agent:<name>`), never read from the body. The loopback owner path (no token) is the user, as
//     before. A body claiming `agent:*` or `tracker` without a token is refused.
//   - mode: observe = read only; suggest = status changes and new items become suggestions for the
//     user to accept, suggestions and context cards allowed; act = direct, still forward-only, never
//     over the user's override, undoable by the user.
//   - rate limits per lease (token buckets), a secret filter on everything an agent writes, evidence
//     that must cite a real, unflagged segment of this session, agent context cards that stay private.
//   - owner routes (grant, mode change, access, delete/reorder/import/invite/...) refuse lease tokens.
//
// Leases live in memory. A daemon restart ends them all, and `live attach` then takes a new one and
// resumes its stream from its cursor. The durable record of what an agent did is the agenda events
// themselves (by / source / createdBy = agent:<name>, the status history), so replay == state holds
// with no new event types. The per-lease activity list (LeaseInfo.actions) is this run's view for the
// window.

export type AgentLimits = {
  /** A lease with no heartbeat (or authenticated write) for this long expires. */
  heartbeatTimeoutMs: number
  /** How long past the meeting's scheduled end a lease still lives (meetings overrun). */
  overrunGraceMs: number
  /** Lifetime of a lease on a recording with no calendar meeting. */
  defaultWindowMs: number
  /** Presence drops from `reading` to `idle` after this long with nothing streamed. */
  idleAfterMs: number
  /** Every write: a burst, then this many per minute. */
  writes: { burst: number; perMinute: number }
  /** Suggestions (and suggest-mode proposals): a burst, then this many per minute. */
  suggestions: { burst: number; perMinute: number }
  /** How often expiry is checked. */
  sweepMs: number
}

export const DEFAULT_AGENT_LIMITS: AgentLimits = {
  heartbeatTimeoutMs: 60_000,
  overrunGraceMs: 30 * 60_000,
  defaultWindowMs: 4 * 3_600_000,
  idleAfterMs: 30_000,
  writes: { burst: 10, perMinute: 20 },
  suggestions: { burst: 3, perMinute: 2 },
  sweepMs: 1_000,
}

type Bucket = { tokens: number; at: number }

/** A lease as the channel holds it (opaque outside this module and the live stream). */
export type AgentLeaseRecord = Rec

type Rec = {
  lease: AgentLease
  tokenHash: Buffer
  state: AgentPresenceState
  endedAt: string | null
  endReason: LeaseEndReason | null
  counts: LeaseInfo['counts']
  actions: AgentAction[]
  writes: Bucket
  suggestions: Bucket
  idle: NodeJS.Timeout | null
  streams: number
}

export type AgentChannelDeps = {
  store: Store
  bus: EventBus
  agendas: AgendaService
  settings: SettingsService
  logger: Logger
  guard?: SpeechGuard
  limits?: Partial<AgentLimits>
  now?: () => Date
}

const MODE_RANK: Record<AgentMode, number> = { observe: 0, suggest: 1, act: 2 }
const LIVE: Session['status'][] = ['recording', 'paused']
const ENDED: Session['status'][] = ['stopped', 'recovered', 'failed']
const MAX_ACTIONS = 50
const MAX_ENDED = 100

/** Routes a lease token may reach (handlers still check scope and mode). */
const AGENT_ROUTES = new Set([
  'health',
  'nextMeeting',
  'listAgendas',
  'getAgenda',
  'getAgendaHistory',
  'exportAgendaMarkdown',
  'agendaInviteBlock', // reading the links only: writing to the calendar is refused in the handler
  'setAgendaItemStatus',
  'addAgendaItems',
  'updateAgendaItem',
  'addContextCard',
  'addSuggestion',
  'heartbeatAgentLease',
  'releaseAgentLease',
  'liveAttach',
  'listLiveSessions',
  'getAgentAccess',
])
/** …and these for its own recording only. */
const OWN_SESSION_ROUTES = new Set(['getSession', 'getTranscript', 'listSpeakers'])

const sha = (s: string) => createHash('sha256').update(s).digest()
const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export class AgentChannel {
  private readonly d: AgentChannelDeps
  private readonly now: () => Date
  readonly limits: AgentLimits
  private currentGuard: SpeechGuard
  private readonly recs = new Map<string, Rec>()
  private readonly endListeners = new Map<string, Set<(reason: LeaseEndReason) => void>>()
  private readonly verdicts = new Map<string, { revision: number; verdict: Promise<SpeechVerdict> }>()
  private readonly liveWaiters = new Set<() => void>()
  private unsubscribe: (() => void) | null = null
  private sweeper: NodeJS.Timeout | null = null

  constructor(d: AgentChannelDeps) {
    this.d = d
    this.now = d.now ?? (() => new Date())
    this.limits = { ...DEFAULT_AGENT_LIMITS, ...d.limits }
    this.currentGuard = d.guard ?? passThroughGuard
  }

  start(): void {
    this.unsubscribe ??= this.d.store.onCommit((e) => this.onEvent(e))
    this.sweeper ??= setInterval(() => this.sweep(), this.limits.sweepMs)
    this.sweeper.unref()
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.sweeper) clearInterval(this.sweeper)
    this.sweeper = null
    for (const r of this.recs.values()) if (!r.endedAt) this.end(r, 'meeting-ended')
    for (const w of [...this.liveWaiters]) w()
  }

  // --------------------------------------------------------------------------------- the guard

  /** The SpeechGuard applied to live speech before it reaches agents (the tracker reuses it). */
  get guard(): SpeechGuard {
    return this.currentGuard
  }

  /** Plug a guard in (the decisions wave's classifier). Clears cached verdicts. */
  setGuard(guard: SpeechGuard | null): void {
    this.currentGuard = guard ?? passThroughGuard
    this.verdicts.clear()
  }

  /** The guard's verdict on a segment revision, computed once and cached (the stream and the evidence
   *  check see the same answer). */
  verdict(seg: Segment): Promise<SpeechVerdict> {
    const hit = this.verdicts.get(seg.id)
    if (hit && hit.revision === seg.revision) return hit.verdict
    const verdict = runGuard(this.currentGuard, {
      sessionId: seg.sessionId,
      segmentId: seg.id,
      speaker: seg.speaker,
      text: seg.text,
      kind: 'segment',
    })
    this.verdicts.set(seg.id, { revision: seg.revision, verdict })
    if (this.verdicts.size > 20_000) this.verdicts.delete(this.verdicts.keys().next().value!)
    return verdict
  }

  agendaView(agendaId: string): AgendaView | null {
    return this.d.agendas.agendas.view(agendaId)
  }

  // ---------------------------------------------------------------------------------- access

  private allowList(): string[] {
    return this.d.settings.get().agents?.allowPrivate ?? []
  }

  access(sessionId: string): AgentAccess {
    const s = this.d.store.getSession(sessionId)
    if (!s) throw new DaemonError('not_found', `no session ${sessionId}`)
    const allowAgents = this.allowList().includes(sessionId)
    return { sessionId, private: s.private, allowAgents, attachable: !s.private || allowAgents }
  }

  setAccess(sessionId: string, allow: boolean): AgentAccess {
    this.access(sessionId) // exists
    // keep the list to sessions that still exist (deleted ones drop out on the next change)
    const list = this.allowList().filter((id) => id !== sessionId && this.d.store.getSession(id))
    if (allow) list.push(sessionId)
    this.d.settings.setAgentSettings({ allowPrivate: list })
    const a = this.access(sessionId)
    if (!a.attachable) this.endSession(sessionId, 'access-withdrawn')
    this.wakeWaiters()
    return a
  }

  private attachable(s: Session): boolean {
    return !s.private || this.allowList().includes(s.id)
  }

  /** Recordings an agent may attach to now. With `wait`, long-polls until there is one (or time runs out). */
  async liveSessions(
    o: { wait?: number; meeting?: string; signal?: AbortSignal } = {},
  ): Promise<LiveSession[]> {
    const list = () =>
      this.d.store
        .sessionsWithStatus(LIVE)
        .filter((s) => this.attachable(s))
        .filter((s) => !o.meeting || s.meeting?.id === o.meeting || s.meeting?.uid === o.meeting)
        .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt))
        .map((s) => this.liveSession(s))
    let out = list()
    if (out.length || !o.wait) return out
    const deadline = Date.now() + o.wait * 1000
    while (!out.length && Date.now() < deadline && !o.signal?.aborted) {
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(t)
          this.liveWaiters.delete(done)
          o.signal?.removeEventListener('abort', done)
          resolve()
        }
        const t = setTimeout(done, Math.max(0, deadline - Date.now()))
        this.liveWaiters.add(done)
        o.signal?.addEventListener('abort', done)
      })
      out = list()
    }
    return out
  }

  private liveSession(s: Session): LiveSession {
    return {
      sessionId: s.id,
      title: s.title,
      status: s.status as LiveSession['status'],
      startedAt: s.startedAt,
      meeting: s.meeting
        ? { id: s.meeting.id, uid: s.meeting.uid, title: s.meeting.title, start: s.meeting.start }
        : null,
      agendaId: this.d.agendas.agendas.bySession(s.id)[0]?.id ?? null,
    }
  }

  private wakeWaiters(): void {
    for (const w of [...this.liveWaiters]) w()
  }

  // ---------------------------------------------------------------------------------- leases

  create(sessionId: string, body: { name: string; mode: AgentMode }): LeaseGrant {
    const s = this.d.store.getSession(sessionId)
    // a private session the user has not opened to agents is as invisible here as everywhere else
    if (!s || !this.attachable(s)) throw new DaemonError('not_found', `no session ${sessionId}`)
    if (!LIVE.includes(s.status))
      throw new DaemonError('conflict', `session ${sessionId} is not recording (${s.status})`)
    for (const r of this.recs.values())
      if (!r.endedAt && r.lease.sessionId === sessionId && r.lease.name === body.name)
        this.end(r, 'superseded')
    const now = this.now()
    const end = s.meeting
      ? Math.max(Date.parse(s.meeting.end), now.getTime()) + this.limits.overrunGraceMs
      : null
    const id = newAgendaId('lse', now.getTime())
    const token = `${id}.${randomBytes(24).toString('base64url')}`
    const lease: AgentLease = {
      id,
      sessionId,
      agendaId: this.d.agendas.agendas.bySession(sessionId)[0]?.id ?? null,
      name: body.name,
      mode: body.mode,
      createdAt: now.toISOString(),
      expiresAt: new Date(end ?? now.getTime() + this.limits.defaultWindowMs).toISOString(),
      heartbeatAt: now.toISOString(),
    }
    const full = (b: { burst: number }): Bucket => ({ tokens: b.burst, at: now.getTime() })
    const rec: Rec = {
      lease,
      tokenHash: sha(token),
      state: 'connected',
      endedAt: null,
      endReason: null,
      counts: { statusChanges: 0, suggestions: 0, items: 0, context: 0, refused: 0 },
      actions: [],
      writes: full(this.limits.writes),
      suggestions: full(this.limits.suggestions),
      idle: null,
      streams: 0,
    }
    this.recs.set(id, rec)
    this.trimEnded()
    this.d.logger.info('agent lease granted', { leaseId: id, sessionId, name: body.name, mode: body.mode })
    this.presence(rec)
    return { lease: { ...lease }, token }
  }

  list(sessionId: string, includeEnded = false): LeaseInfo[] {
    return [...this.recs.values()]
      .filter((r) => r.lease.sessionId === sessionId && (includeEnded || !r.endedAt))
      .map((r) => this.info(r))
  }

  info(r: Rec): LeaseInfo {
    return {
      ...r.lease,
      state: r.state,
      endedAt: r.endedAt,
      endReason: r.endReason,
      counts: { ...r.counts },
      actions: r.actions.map((a) => ({ ...a })),
    }
  }

  /** The active lease a token belongs to; 401 for an unknown, ended or expired one. */
  authenticate(token: string): Rec {
    const id = token.split('.')[0] ?? ''
    const r = this.recs.get(id)
    const h = sha(token)
    if (!r || r.tokenHash.length !== h.length || !timingSafeEqual(r.tokenHash, h))
      throw new DaemonError('unauthorized', 'unknown lease token (attach again: gnomeola live attach)', 401)
    this.expireIfDue(r)
    if (r.endedAt) throw new DaemonError('unauthorized', `the lease has ended (${r.endReason})`, 401)
    return r
  }

  /** The lease a request presents, or null for the owner (no token). */
  fromRequest(req: IncomingMessage): Rec | null {
    const v = req.headers[LEASE_HEADER]
    if (v === undefined) return null
    const token = Array.isArray(v) ? v[0]! : v
    return this.authenticate(token.trim())
  }

  /** Owner-only routes: a request carrying a lease token is an agent, and agents may not do this. */
  requireOwner(req: IncomingMessage, what: string): void {
    if (req.headers[LEASE_HEADER] !== undefined)
      throw new DaemonError('unauthorized', `a connected agent cannot ${what}; only the user can`)
  }

  /**
   * The routes a lease token may reach. Anything else with a token is refused before its handler runs:
   * a lease is the agent's identity for every request it makes, not a key it may leave off at will (it
   * can, of course, as any local process can call the loopback API; then it is the user's CLI and gets
   * no agent attribution at all, which the skill forbids). Session reads are for its own recording only.
   */
  gate(req: IncomingMessage, route: string, params: Record<string, string>): void {
    if (req.headers[LEASE_HEADER] === undefined) return
    const r = this.fromRequest(req)!
    if (AGENT_ROUTES.has(route)) return
    if (OWN_SESSION_ROUTES.has(route) && params.id === r.lease.sessionId) return
    throw new DaemonError('unauthorized', `a connected agent cannot use ${route}`)
  }

  private touch(r: Rec): void {
    r.lease.heartbeatAt = this.now().toISOString()
  }

  heartbeat(leaseId: string, req: IncomingMessage, state?: 'reading' | 'idle'): AgentLease {
    const r = this.fromRequest(req)
    if (!r) throw new DaemonError('unauthorized', 'a heartbeat needs the lease token', 401)
    if (r.lease.id !== leaseId) throw new DaemonError('unauthorized', 'that token belongs to another lease')
    this.touch(r)
    if (state) this.setState(r, state)
    return { ...r.lease }
  }

  setMode(leaseId: string, mode: AgentMode): AgentLease {
    const r = this.recs.get(leaseId)
    if (!r || r.endedAt) throw new DaemonError('not_found', `no active lease ${leaseId}`)
    if (r.lease.mode !== mode) {
      r.lease.mode = mode
      this.d.logger.info('agent lease mode changed', { leaseId, mode })
      this.presence(r)
    }
    return { ...r.lease }
  }

  release(leaseId: string, req: IncomingMessage): void {
    const agent = this.fromRequest(req)
    if (agent) {
      if (agent.lease.id !== leaseId)
        throw new DaemonError('unauthorized', 'that token belongs to another lease')
      this.end(agent, 'released')
      return
    }
    const r = this.recs.get(leaseId)
    if (!r) throw new DaemonError('not_found', `no lease ${leaseId}`)
    if (!r.endedAt) this.end(r, 'revoked')
  }

  /** Called with the reason when the lease ends (at once if it already has). Returns an unsubscribe. */
  onEnd(leaseId: string, fn: (reason: LeaseEndReason) => void): () => void {
    const r = this.recs.get(leaseId)
    if (r?.endedAt) {
      fn(r.endReason!)
      return () => {}
    }
    let set = this.endListeners.get(leaseId)
    if (!set) {
      set = new Set()
      this.endListeners.set(leaseId, set)
    }
    set.add(fn)
    return () => set.delete(fn)
  }

  private end(r: Rec, reason: LeaseEndReason): void {
    if (r.endedAt) return
    r.endedAt = this.now().toISOString()
    r.endReason = reason
    if (r.idle) clearTimeout(r.idle)
    r.idle = null
    this.setState(r, 'disconnected')
    this.d.logger.info('agent lease ended', { leaseId: r.lease.id, name: r.lease.name, reason })
    const fns = this.endListeners.get(r.lease.id)
    this.endListeners.delete(r.lease.id)
    for (const fn of fns ?? []) {
      try {
        fn(reason)
      } catch {}
    }
  }

  private endSession(sessionId: string, reason: LeaseEndReason): void {
    for (const r of this.recs.values()) if (!r.endedAt && r.lease.sessionId === sessionId) this.end(r, reason)
  }

  private expireIfDue(r: Rec): void {
    if (r.endedAt) return
    const now = this.now().getTime()
    if (
      now >= Date.parse(r.lease.expiresAt) ||
      now - Date.parse(r.lease.heartbeatAt) > this.limits.heartbeatTimeoutMs
    )
      this.end(r, 'expired')
  }

  private sweep(): void {
    for (const r of this.recs.values()) this.expireIfDue(r)
  }

  private trimEnded(): void {
    const ended = [...this.recs.values()].filter((r) => r.endedAt)
    for (const r of ended.slice(0, Math.max(0, ended.length - MAX_ENDED))) this.recs.delete(r.lease.id)
  }

  private onEvent(e: DurableEvent): void {
    if (e.data.type === 'session.upserted') {
      const s = e.data.session
      if (ENDED.includes(s.status)) this.endSession(s.id, 'meeting-ended')
      else if (!this.attachable(s)) this.endSession(s.id, 'access-withdrawn')
      if (LIVE.includes(s.status)) this.wakeWaiters()
    } else if (e.data.type === 'session.deleted') this.endSession(e.data.sessionId, 'meeting-ended')
    else if (e.data.type === 'agenda.upserted' && e.data.agenda.sessionId) {
      // an agenda linked to the recording after the lease was granted
      for (const r of this.recs.values())
        if (!r.endedAt && r.lease.sessionId === e.data.agenda.sessionId && !r.lease.agendaId)
          r.lease.agendaId = e.data.agenda.id
    }
  }

  // -------------------------------------------------------------------------------- presence

  private presence(r: Rec): void {
    this.d.bus.ephemeral(r.lease.sessionId, {
      type: 'agent.presence',
      leaseId: r.lease.id,
      name: r.lease.name,
      mode: r.lease.mode,
      state: r.state,
    })
  }

  private setState(r: Rec, state: AgentPresenceState): void {
    if (r.state === state) return
    r.state = state
    this.presence(r)
  }

  streamOpened(r: Rec): void {
    r.streams++
    this.setState(r, 'connected')
  }

  streamClosed(r: Rec): void {
    r.streams = Math.max(0, r.streams - 1)
    if (!r.streams && !r.endedAt) {
      if (r.idle) clearTimeout(r.idle)
      r.idle = null
      this.setState(r, 'disconnected')
    }
  }

  /** Speech was just streamed to this agent: it is reading; idle after a quiet spell. */
  delivered(r: Rec): void {
    if (r.endedAt) return
    this.setState(r, 'reading')
    if (r.idle) clearTimeout(r.idle)
    r.idle = setTimeout(() => {
      r.idle = null
      if (!r.endedAt && r.streams) this.setState(r, 'idle')
    }, this.limits.idleAfterMs)
    r.idle.unref()
  }

  // ------------------------------------------------------------------------------ agent writes

  private record(r: Rec, a: Omit<AgentAction, 'at'>): void {
    r.actions.push({ at: this.now().toISOString(), ...a, summary: clip(a.summary, 300) })
    if (r.actions.length > MAX_ACTIONS) r.actions.splice(0, r.actions.length - MAX_ACTIONS)
    if (a.outcome === 'refused') r.counts.refused++
  }

  /** Run a write for an agent: refusals (thrown) are recorded against the lease, then rethrown. */
  private async guarded<T>(
    r: Rec,
    kind: AgentAction['kind'],
    what: string,
    fn: () => Promise<T> | T,
  ): Promise<T> {
    try {
      this.touch(r)
      return await fn()
    } catch (err) {
      this.record(r, { kind, outcome: 'refused', summary: `${what}: ${(err as Error).message}`, ref: null })
      this.d.logger.info('agent write refused', { leaseId: r.lease.id, kind, err: (err as Error).message })
      throw err
    }
  }

  private by(r: Rec): ChangedBy {
    return `agent:${r.lease.name}`
  }

  private scope(r: Rec, agendaId: string): void {
    const a = this.d.agendas.agendas.get(agendaId)
    if (!a || a.sessionId !== r.lease.sessionId)
      throw new DaemonError(
        'unauthorized',
        `this lease is for the agenda of session ${r.lease.sessionId} only`,
      )
    r.lease.agendaId = a.id
  }

  private need(r: Rec, mode: 'suggest' | 'act', what: string): void {
    if (MODE_RANK[r.lease.mode] < MODE_RANK[mode])
      throw new DaemonError(
        'unauthorized',
        `${r.lease.mode} mode cannot ${what}${r.lease.mode === 'observe' ? ' (read only)' : ''}`,
      )
  }

  private take(r: Rec, which: 'writes' | 'suggestions'): void {
    const cfg = this.limits[which]
    const b = r[which]
    const now = this.now().getTime()
    b.tokens = Math.min(cfg.burst, b.tokens + ((now - b.at) / 60_000) * cfg.perMinute)
    b.at = now
    if (b.tokens < 1) {
      const waitS = Math.ceil(((1 - b.tokens) / cfg.perMinute) * 60)
      throw new DaemonError(
        'unavailable',
        `rate limited: too many ${which} from this agent; wait ${waitS}s`,
        429,
      )
    }
    b.tokens -= 1
  }

  private clean(...texts: (string | null | undefined)[]): void {
    for (const t of texts) {
      if (!t) continue
      const what = looksSecret(t)
      if (what) throw new DaemonError('bad_request', `refused: the text looks like it contains ${what}`)
    }
  }

  /** Evidence an agent cites must be real speech from this recording, not flagged by the guard. */
  private async evidence(r: Rec, ev: Evidence[] | undefined): Promise<Evidence[]> {
    const out: Evidence[] = []
    for (const e of ev ?? []) {
      this.clean(e.quote)
      if (!e.segmentId) {
        out.push(e)
        continue
      }
      const seg = this.d.store.getSegment(e.segmentId)
      if (!seg || seg.sessionId !== r.lease.sessionId)
        throw new DaemonError(
          'bad_request',
          `evidence cites ${e.segmentId}, which is not a segment of this recording`,
        )
      const v = await this.verdict(seg)
      if (v.flags.includes(INJECTION_FLAG))
        throw new DaemonError(
          'unauthorized',
          `evidence cites ${e.segmentId}, which the guard flagged as an injection attempt`,
        )
      out.push({ ...e, quote: e.quote || seg.text.slice(0, 500) })
    }
    return out
  }

  /** Would an automated changer be allowed this move? (the store's rules, checked before a proposal) */
  private movable(agendaId: string, item: AgendaItem, to: AgendaItemStatus, by: ChangedBy): void {
    if (item.status === to) return
    if (!isForwardMove(item.status, to))
      throw new DaemonError(
        'conflict',
        `${by} cannot move "${item.text}" from ${item.status} back to ${to}: only the user can`,
      )
    const last: StatusChange | undefined = this.d.agendas.agendas
      .history(agendaId)
      .filter((c) => c.itemId === item.id)
      .at(-1)
    if (last?.by === 'user' && last.override)
      throw new DaemonError(
        'conflict',
        `the user set "${item.text}" to ${item.status} by hand; ${by} cannot change it (manual wins)`,
      )
  }

  async setStatus(
    r: Rec,
    agendaId: string,
    itemId: string,
    body: {
      status: AgendaItemStatus
      evidence?: Evidence[]
      note?: string
      outcome?: string
      confidence?: number
    },
  ): Promise<{ item: AgendaItem; change: StatusChange | null; suggestion?: Suggestion | null }> {
    const store = this.d.agendas.agendas
    return this.guarded(r, 'status', `${body.status} ${itemId}`, async () => {
      this.scope(r, agendaId)
      this.need(r, 'suggest', 'change an item')
      const item = store.item(agendaId, itemId)
      if (!item) throw new DaemonError('not_found', `no item ${itemId} in agenda ${agendaId}`)
      this.clean(body.note, body.outcome)
      const evidence = await this.evidence(r, body.evidence)
      const by = this.by(r)
      this.movable(agendaId, item, body.status, by)
      if (body.status === 'covered' && r.lease.mode === 'act' && !evidence.some((e) => e.segmentId))
        throw new DaemonError(
          'bad_request',
          'an agent checks an item off with evidence: cite the segment that settled it (segmentId)',
        )
      this.take(r, 'writes')
      if (r.lease.mode === 'suggest') {
        this.take(r, 'suggestions')
        const suggestion = store.addSuggestion(agendaId, {
          kind: 'set-status',
          text: body.note?.trim() || `"${clip(item.text, 200)}" looks ${body.status}`,
          itemId,
          source: by,
          ttlSec: 15 * 60,
          proposal: {
            kind: 'status',
            status: body.status,
            // ids only: the words are read back when accepted (a deleted recording leaves none here)
            evidence: evidence.map((e) => ({ ...e, quote: e.segmentId ? '' : e.quote })),
            note: body.note ?? null,
            outcome: body.outcome ?? null,
          },
        })
        r.counts.suggestions++
        this.record(r, {
          kind: 'status',
          outcome: 'suggested',
          summary: `${body.status}: "${item.text}"`,
          ref: suggestion.id,
        })
        return { item, change: null, suggestion }
      }
      const out = store.setStatus(agendaId, itemId, {
        status: body.status,
        by,
        evidence,
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.outcome !== undefined ? { outcome: body.outcome } : {}),
        ...(body.confidence !== undefined ? { confidence: body.confidence } : {}),
      })
      if (out.change) r.counts.statusChanges++
      this.record(r, {
        kind: 'status',
        outcome: 'applied',
        summary: `${body.status}: "${item.text}"`,
        ref: itemId,
      })
      return { ...out, suggestion: null }
    })
  }

  async addItems(
    r: Rec,
    agendaId: string,
    raw: NewAgendaItem[],
    before?: string,
  ): Promise<{ items: AgendaItem[]; version: number; suggestions?: Suggestion[] }> {
    const store = this.d.agendas.agendas
    return this.guarded(r, 'add-item', `add ${raw.length} item(s)`, () => {
      this.scope(r, agendaId)
      this.need(r, 'suggest', 'add items')
      const items = raw.map((i) => NewAgendaItemSchema.parse(i))
      this.clean(...items.flatMap((i) => [i.text, i.outcome, i.owner]))
      if (items.length > 5) throw new DaemonError('bad_request', 'an agent adds at most 5 items at a time')
      for (const _ of items) this.take(r, 'writes')
      if (r.lease.mode === 'suggest') {
        const suggestions = items.map((i) => {
          this.take(r, 'suggestions')
          const s = store.addSuggestion(agendaId, {
            kind: 'add-item',
            text: `Add "${clip(i.text, 200)}"`,
            source: this.by(r),
            ttlSec: 15 * 60,
            proposal: {
              kind: 'add-item',
              item: { text: i.text, kind: i.kind, owner: i.owner ?? null, timeboxMin: i.timeboxMin ?? null },
            },
          })
          r.counts.suggestions++
          this.record(r, { kind: 'add-item', outcome: 'suggested', summary: `add "${i.text}"`, ref: s.id })
          return s
        })
        return { items: [], version: store.get(agendaId)!.version, suggestions }
      }
      // act: added as the agent, always open (a status for a new item is a check-off, which needs evidence)
      const added = store.addItems(
        agendaId,
        items.map((i) => ({ ...i, status: undefined })),
        { before, by: this.by(r) },
      )
      r.counts.items += added.length
      for (const i of added)
        this.record(r, { kind: 'add-item', outcome: 'applied', summary: `added "${i.text}"`, ref: i.id })
      return { items: added, version: store.get(agendaId)!.version }
    })
  }

  async editItem(
    r: Rec,
    agendaId: string,
    itemId: string,
    patch: {
      text?: string
      kind?: AgendaItem['kind']
      owner?: string | null
      timeboxMin?: number | null
      outcome?: string | null
    },
  ): Promise<AgendaItem> {
    const store = this.d.agendas.agendas
    return this.guarded(r, 'edit-item', `edit ${itemId}`, () => {
      this.scope(r, agendaId)
      this.need(r, 'act', 'edit an item')
      // an agent may record what came of an item; the plan itself (text, kind, owner, timebox) is the user's
      const other = Object.entries(patch).filter(([k, v]) => k !== 'outcome' && v !== undefined)
      if (other.length)
        throw new DaemonError('unauthorized', 'a connected agent may set an outcome, not rewrite the item')
      this.clean(patch.outcome)
      this.take(r, 'writes')
      const out = store.updateItem(agendaId, itemId, { outcome: patch.outcome }, this.by(r))
      this.record(r, {
        kind: 'edit-item',
        outcome: 'applied',
        summary: `outcome of "${out.text}"`,
        ref: itemId,
      })
      return out
    })
  }

  async suggest(
    r: Rec,
    agendaId: string,
    body: { kind: SuggestionKind; text: string; itemId?: string; ttlSec?: number },
  ): Promise<Suggestion> {
    const store = this.d.agendas.agendas
    return this.guarded(r, 'suggestion', `suggest ${body.kind}`, () => {
      this.scope(r, agendaId)
      this.need(r, 'suggest', 'post suggestions')
      if (body.kind === 'set-status' || body.kind === 'add-item')
        throw new DaemonError(
          'bad_request',
          `${body.kind} suggestions come from a suggest-mode status change or item`,
        )
      this.clean(body.text)
      this.take(r, 'writes')
      this.take(r, 'suggestions')
      const s = store.addSuggestion(agendaId, {
        kind: body.kind,
        text: body.text,
        itemId: body.itemId ?? null,
        source: this.by(r),
        ttlSec: body.ttlSec ?? 10 * 60,
      })
      r.counts.suggestions++
      this.record(r, {
        kind: 'suggestion',
        outcome: 'applied',
        summary: `${body.kind}: ${body.text}`,
        ref: s.id,
      })
      return s
    })
  }

  async addContext(
    r: Rec,
    agendaId: string,
    body: { title: string; body: string; source?: ContextSource; pinned?: boolean },
  ): Promise<ContextCard> {
    const store = this.d.agendas.agendas
    return this.guarded(r, 'context', `context "${clip(body.title, 60)}"`, () => {
      this.scope(r, agendaId)
      this.need(r, 'suggest', 'add context cards')
      this.clean(body.title, body.body, body.source?.ref)
      this.take(r, 'writes')
      const ref = body.source?.ref ?? null
      const card = store.addContext(agendaId, {
        title: body.title,
        body: body.body,
        // where it came from, as the agent said (a path or URL), else the agent itself
        source:
          body.source && (body.source.kind === 'path' || body.source.kind === 'url')
            ? { kind: body.source.kind, ref }
            : { kind: 'agent', ref: r.lease.name },
        // an agent's card is private: only the user shares things with invitees
        visibility: 'private',
        pinned: body.pinned ?? false,
        by: this.by(r),
      })
      r.counts.context++
      this.record(r, { kind: 'context', outcome: 'applied', summary: `card "${card.title}"`, ref: card.id })
      return card
    })
  }
}
