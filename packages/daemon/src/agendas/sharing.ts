import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  type Agenda,
  type AgendaMeeting,
  type ChangedBy,
  createClient,
  type DurableEvent,
  formatShareLink,
  KacolaApiError,
  type KacolaClient,
  LEGACY_PARTICIPANT_HEADER,
  PARTICIPANT_HEADER,
  parseShareLink,
  peerAttribution,
  type SharedAgendaState,
  type SharedChange,
  type ShareOp,
  type ShareStatus,
} from '@kacola/protocol'
import type { Store } from '@kacola/store'
import type { EventBus } from '../bus.ts'
import { DaemonError } from '../errors.ts'
import type { Logger } from '../logger.ts'
import { type AgendaService, toAgendaMeeting } from './service.ts'
import { changeKey, isLocalAuthor, memberOps, ownerOps } from './share-projection.ts'

// Team sharing on the device (kacola phase 5). The daemon keeps each shared agenda in step with the
// hosted server, in both directions, without ever sending its log:
//
//   push   the projection of the local agenda (./share-projection.ts — the privacy boundary): the
//          owner's header, items, shared cards, recap; anyone's own status changes, each with an
//          idempotency key. The server judges every status change (store/shares.ts: forward-only,
//          the owner's override wins, latest wins between equals) and records it, applied or not.
//   pull   the server's state, mirrored into the local agenda: items invitees and other attendees
//          added, statuses other devices set (attributed `peer:<who>[/tracker|/agent:x]` or
//          `invitee:<email>`), the owner's shared cards on a member's copy. Push first, then mirror —
//          and an item that changed locally while the push was in flight is left for the next round.
//
// The owner shares from their device with the configured host's pairing token (KACOLA_SHARE_URL /
// KACOLA_SHARE_TOKEN, else the hybrid-sync ones). A member follows with the link and their email
// (a magic-link code) and keeps a participant token. Secrets live in `<dataDir>/agenda-shares.json`
// (0600), never in the event log.

/** `peer:ana@x/tracker` → `peer:ana@x`: the person behind another device's change. */
const peerPerson = (by: ChangedBy): ChangedBy => by.split('/')[0] as ChangedBy

export type ShareConfig = {
  /** The owner's hosted server and its pairing token. */
  url: string | null
  token: string | null
  /** Base of the web link (`<base>/a/<token>`); default `url`. */
  webBase: string | null
  ownerName: string | null
  /** The owner's label on shared changes (`peer:<label>` on other devices): an email or a handle. */
  ownerLabel: string | null
  /** Pull period (ms); 0 = only on demand and after local changes. */
  pollMs: number
  /** Debounce of a push after a local change (ms). */
  debounceMs: number
  fetch?: typeof fetch
}

type OccurrenceRecord = {
  /** The local agenda that holds this occurrence. */
  agendaId: string
  recapShared: boolean
  /** Remote item ids mirrored into the local agenda. */
  seenRemote: string[]
}

type ShareRecord = {
  shareId: string
  role: 'owner' | 'member'
  host: string
  token: string
  participantId: string
  participantToken: string | null
  email: string | null
  ownerName: string
  shareGoals: boolean
  allowInvitees: boolean
  members: string[]
  /** Owner agenda id → local occurrence record. */
  occurrences: Record<string, OccurrenceRecord>
  /** The owner's current occurrence (the link opens it). */
  current: string
  /** Status change keys this device has pushed. */
  pushed: string[]
  revoked: string | null
}

type Runtime = {
  state: ShareStatus['state']
  error: string | null
  lastSyncAt: string | null
  server: SharedAgendaState | null
  refused: number
  running: Promise<void> | null
  again: boolean
  timer: ReturnType<typeof setTimeout> | null
}

export type SharingDeps = {
  store: Store
  agendas: AgendaService
  bus: EventBus
  logger: Logger
  dataDir: string
  config: ShareConfig
  now?: () => Date
}

export class SharingService {
  private readonly d: SharingDeps
  private readonly file: string
  private records: Record<string, ShareRecord>
  private readonly runtime = new Map<string, Runtime>()
  private unsubscribe: (() => void) | null = null
  private poller: ReturnType<typeof setInterval> | null = null
  private stopped = false
  /** Local agendas currently being written by the mirror (their events must not trigger a push). */
  private mirroring = 0

  constructor(d: SharingDeps) {
    this.d = d
    this.file = join(d.dataDir, 'agenda-shares.json')
    this.records = this.load()
  }

  // ------------------------------------------------------------------------------- persistence

  private load(): Record<string, ShareRecord> {
    if (!existsSync(this.file)) return {}
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, ShareRecord>
    } catch (err) {
      this.d.logger.warn('agenda shares file unreadable; starting empty', { err: String(err) })
      return {}
    }
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, `${JSON.stringify(this.records, null, 2)}\n`, { mode: 0o600 })
    chmodSync(tmp, 0o600)
    renameSync(tmp, this.file)
  }

  // ---------------------------------------------------------------------------------- lifecycle

  start(): void {
    this.unsubscribe ??= this.d.store.onCommit((e) => this.onEvent(e))
    // a follower's copy does not roll over by itself: the owner's next occurrence arrives by the sync
    this.d.agendas.setRollOverFilter((a) => this.recordOf(a.id)?.rec.role !== 'member')
    this.d.agendas.setWebLink((a) => this.linkFor(a.id))
    if (this.d.config.pollMs > 0)
      this.poller = setInterval(() => {
        for (const id of Object.keys(this.records)) if (!this.records[id]!.revoked) this.kick(id, 0)
      }, this.d.config.pollMs)
    for (const id of Object.keys(this.records)) if (!this.records[id]!.revoked) this.kick(id, 0)
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.poller) clearInterval(this.poller)
    for (const r of this.runtime.values()) if (r.timer) clearTimeout(r.timer)
    await Promise.allSettled([...this.runtime.values()].map((r) => r.running))
  }

  // ------------------------------------------------------------------------------------ lookups

  private recordOf(agendaId: string): { rec: ShareRecord; occurrence: string } | null {
    for (const rec of Object.values(this.records))
      for (const [occ, o] of Object.entries(rec.occurrences))
        if (o.agendaId === agendaId) return { rec, occurrence: occ }
    return null
  }

  private rt(shareId: string): Runtime {
    let r = this.runtime.get(shareId)
    if (!r) {
      r = {
        state: 'ok',
        error: null,
        lastSyncAt: null,
        server: null,
        refused: 0,
        running: null,
        again: false,
        timer: null,
      }
      this.runtime.set(shareId, r)
    }
    return r
  }

  linkFor(agendaId: string): string | null {
    const f = this.recordOf(agendaId)
    if (!f || f.rec.revoked) return null
    const base = f.rec.role === 'owner' ? (this.d.config.webBase ?? f.rec.host) : f.rec.host
    return formatShareLink(base, f.rec.token)
  }

  private client(rec: ShareRecord): KacolaClient {
    const owner = rec.role === 'owner'
    return createClient({
      baseUrl: rec.host,
      timeoutMs: 20_000,
      ...(this.d.config.fetch ? { fetch: this.d.config.fetch } : {}),
      ...(owner && this.d.config.token ? { token: this.d.config.token } : {}),
      // the gnomeola header too, for hosted servers not yet redeployed since the rename (one release)
      ...(!owner && rec.participantToken
        ? {
            headers: {
              [PARTICIPANT_HEADER]: rec.participantToken,
              [LEGACY_PARTICIPANT_HEADER]: rec.participantToken,
            },
          }
        : {}),
    })
  }

  status(agendaId: string): ShareStatus {
    const f = this.recordOf(agendaId)
    if (!f)
      return {
        agendaId,
        shared: false,
        role: null,
        shareId: null,
        link: null,
        host: this.d.config.url,
        ownerName: this.d.config.ownerName,
        shareGoals: false,
        allowInvitees: true,
        members: [],
        recapShared: false,
        state: 'off',
        error: null,
        lastSyncAt: null,
        pending: 0,
        refused: 0,
        comments: [],
        participants: [],
      }
    const { rec, occurrence } = f
    const r = this.rt(rec.shareId)
    const pushed = new Set(rec.pushed)
    const pending = this.d.agendas.agendas
      .history(agendaId)
      .filter((c) => isLocalAuthor(c.by) && !pushed.has(changeKey(agendaId, c))).length
    return {
      agendaId,
      shared: !rec.revoked,
      role: rec.role,
      shareId: rec.shareId,
      link: this.linkFor(agendaId),
      host: rec.host,
      ownerName: rec.ownerName,
      shareGoals: rec.shareGoals,
      allowInvitees: rec.allowInvitees,
      members: rec.members,
      recapShared: rec.occurrences[occurrence]?.recapShared ?? false,
      state: rec.revoked
        ? 'revoked'
        : r.running || pending
          ? r.state === 'error'
            ? 'error'
            : 'syncing'
          : r.state,
      error: rec.revoked ?? r.error,
      lastSyncAt: r.lastSyncAt,
      pending,
      refused: r.refused,
      comments: (r.server?.comments ?? []).filter((c) => c.occurrence === occurrence),
      participants: r.server?.participants ?? [],
    }
  }

  private announce(shareId: string): void {
    const rec = this.records[shareId]
    if (!rec) return
    for (const o of Object.values(rec.occurrences))
      if (this.d.agendas.agendas.get(o.agendaId))
        this.d.bus.ephemeral(null, {
          type: 'agenda.share',
          agendaId: o.agendaId,
          status: this.status(o.agendaId),
        })
  }

  // ------------------------------------------------------------------------------- owner: share

  /** A hosted server to share on is configured (else sharing, and a link attendees can open, is impossible). */
  hostConfigured(): boolean {
    return Boolean(this.d.config.url && this.d.config.token)
  }

  private requireHost(): { url: string; token: string } {
    const { url, token } = this.d.config
    if (!url || !token)
      throw new DaemonError(
        'unavailable',
        'sharing needs a hosted server: set KACOLA_SHARE_URL and KACOLA_SHARE_TOKEN (from `kacola pair --url …`)',
        503,
        { reason: 'no-share-host', action: 'set-up-sharing' },
      )
    return { url: url.replace(/\/+$/, ''), token }
  }

  private shareable(a: Agenda): void {
    if (a.private)
      throw new DaemonError('conflict', 'this agenda is private: make it public before sharing it')
    const s = a.sessionId ? this.d.store.getSession(a.sessionId) : null
    if (s?.private)
      throw new DaemonError('conflict', 'this agenda belongs to a private recording: it cannot be shared')
  }

  /** Share an agenda (or update its sharing options). Recurring: the next occurrences join the same link. */
  async share(
    agendaId: string,
    o: { ownerName?: string; shareGoals?: boolean; allowInvitees?: boolean; members?: string[] },
  ): Promise<ShareStatus> {
    const a = this.d.agendas.agendas.get(agendaId)
    if (!a) throw new DaemonError('not_found', `no agenda ${agendaId}`)
    const found = this.recordOf(agendaId)
    if (found?.rec.role === 'member')
      throw new DaemonError(
        'conflict',
        'this is a copy of an agenda someone else shared: only they can share it',
      )
    this.shareable(a)
    if (found && !found.rec.revoked) {
      const rec = found.rec
      const next = {
        ownerName: o.ownerName ?? rec.ownerName,
        allowInvitees: o.allowInvitees ?? rec.allowInvitees,
        members: o.members ?? rec.members,
      }
      await this.call(rec, (c) =>
        c.call('updateShare', {
          params: { shareId: rec.shareId },
          body: {
            ownerName: next.ownerName,
            options: { allowInvitees: next.allowInvitees, members: next.members },
          },
        }),
      )
      Object.assign(rec, next, { shareGoals: o.shareGoals ?? rec.shareGoals })
      this.save()
      await this.syncNow(agendaId)
      return this.status(agendaId)
    }
    const host = this.requireHost()
    const ownerName = o.ownerName ?? this.d.config.ownerName ?? 'Organizer'
    const shareGoals = o.shareGoals ?? false
    const options = { allowInvitees: o.allowInvitees ?? true, members: o.members ?? [] }
    const c = createClient({
      baseUrl: host.url,
      token: host.token,
      timeoutMs: 20_000,
      ...(this.d.config.fetch ? { fetch: this.d.config.fetch } : {}),
    })
    const created = await c
      .call('createShare', {
        body: {
          ownerName,
          ownerLabel: this.d.config.ownerLabel ?? 'owner',
          options,
          occurrence: {
            agendaId,
            title: a.title,
            meeting: a.meeting
              ? {
                  eventUid: a.meeting.eventUid,
                  start: a.meeting.start,
                  end: a.meeting.end,
                  recurring: a.meeting.recurring,
                }
              : null,
            goals: shareGoals ? a.goals : [],
          },
        },
      })
      .catch((err) => {
        throw this.remoteError(err)
      })
    this.records[created.share.id] = {
      shareId: created.share.id,
      role: 'owner',
      host: host.url,
      token: created.token,
      participantId: 'owner',
      participantToken: null,
      email: null,
      ownerName,
      shareGoals,
      allowInvitees: options.allowInvitees,
      members: options.members,
      occurrences: { [agendaId]: { agendaId, recapShared: false, seenRemote: [] } },
      current: agendaId,
      pushed: [],
      revoked: null,
    }
    this.save()
    this.d.logger.info('agenda shared', { agendaId, shareId: created.share.id })
    await this.syncNow(agendaId)
    return this.status(agendaId)
  }

  /** Owner: revoke the link (the server deletes everything but a tombstone). Member: stop following. */
  async unshare(agendaId: string, reason = 'unshared'): Promise<ShareStatus> {
    const f = this.recordOf(agendaId)
    if (!f) return this.status(agendaId)
    const { rec } = f
    if (rec.role === 'owner' && !rec.revoked) {
      await this.call(rec, (c) => c.call('revokeShare', { params: { shareId: rec.shareId } })).catch(
        (err) => {
          // already gone on the server is fine; anything else must not leave a share we believe is off
          if (!(err instanceof DaemonError && err.code === 'not_found')) throw err
        },
      )
      this.d.logger.info('agenda unshared', { agendaId, shareId: rec.shareId, reason })
    }
    const status = this.status(agendaId)
    delete this.records[rec.shareId]
    this.runtime.delete(rec.shareId)
    this.save()
    for (const o of Object.values(rec.occurrences))
      this.d.bus.ephemeral(null, {
        type: 'agenda.share',
        agendaId: o.agendaId,
        status: this.status(o.agendaId),
      })
    return { ...status, shared: false, state: 'off', link: null }
  }

  async setRecap(agendaId: string, shared: boolean): Promise<ShareStatus> {
    const f = this.recordOf(agendaId)
    if (!f || f.rec.revoked) throw new DaemonError('conflict', 'this agenda is not shared')
    if (f.rec.role !== 'owner') throw new DaemonError('conflict', 'only the owner shares the recap')
    f.rec.occurrences[f.occurrence]!.recapShared = shared
    this.save()
    await this.syncNow(agendaId)
    return this.status(agendaId)
  }

  async history(agendaId: string): Promise<SharedChange[]> {
    const f = this.recordOf(agendaId)
    if (!f) throw new DaemonError('conflict', 'this agenda is not shared')
    const r = await this.call(f.rec, (c) =>
      c.call('listShareChanges', { params: { shareId: f.rec.shareId }, query: { occurrence: f.occurrence } }),
    )
    return r.changes
  }

  // ------------------------------------------------------------------------------ member: follow

  async follow(o: {
    link: string
    email: string
    name?: string
  }): Promise<{ pending: true; expiresAt: string }> {
    const p = parseShareLink(o.link)
    if (!p) throw new DaemonError('bad_request', 'not a shared agenda link (https://<host>/a/<token>)')
    const c = createClient({
      baseUrl: p.base,
      timeoutMs: 20_000,
      ...(this.d.config.fetch ? { fetch: this.d.config.fetch } : {}),
    })
    const r = await c
      .call('shareVerify', {
        params: { token: p.token },
        body: { email: o.email, ...(o.name ? { name: o.name } : {}) },
      })
      .catch((err) => {
        throw this.remoteError(err)
      })
    return { pending: true, expiresAt: r.expiresAt }
  }

  async confirmFollow(o: { link: string; email: string; code: string }): Promise<ShareStatus> {
    const p = parseShareLink(o.link)
    if (!p) throw new DaemonError('bad_request', 'not a shared agenda link (https://<host>/a/<token>)')
    const c = createClient({
      baseUrl: p.base,
      timeoutMs: 20_000,
      ...(this.d.config.fetch ? { fetch: this.d.config.fetch } : {}),
    })
    const conf = await c
      .call('shareConfirm', { params: { token: p.token }, body: { email: o.email, code: o.code } })
      .catch((err) => {
        throw this.remoteError(err)
      })
    if (conf.participant.role !== 'member')
      throw new DaemonError(
        'unauthorized',
        `the organizer has not listed ${o.email} as an attendee whose kacola may follow this agenda; the web page still works`,
      )
    const existing = this.records[conf.shareId]
    const rec: ShareRecord = existing ?? {
      shareId: conf.shareId,
      role: 'member',
      host: p.base,
      token: p.token,
      participantId: conf.participant.id,
      participantToken: conf.token,
      email: conf.participant.email,
      ownerName: '',
      shareGoals: false,
      allowInvitees: false,
      members: [],
      occurrences: {},
      current: '',
      pushed: [],
      revoked: null,
    }
    rec.participantToken = conf.token
    rec.revoked = null
    this.records[conf.shareId] = rec
    this.save()
    await this.runSync(conf.shareId)
    const current = rec.occurrences[rec.current]
    if (!current) throw new DaemonError('internal', 'following the agenda failed: no local copy was made')
    return this.status(current.agendaId)
  }

  // ------------------------------------------------------------------------------------- the sync

  /** Push and pull now (the route, tests). Resolves when this round (and any queued one) is done. */
  async syncNow(agendaId: string): Promise<ShareStatus> {
    const f = this.recordOf(agendaId)
    if (!f) throw new DaemonError('conflict', 'this agenda is not shared')
    await this.runSync(f.rec.shareId)
    return this.status(agendaId)
  }

  private kick(shareId: string, delay = this.d.config.debounceMs): void {
    if (this.stopped) return
    const r = this.rt(shareId)
    if (r.timer) clearTimeout(r.timer)
    r.timer = setTimeout(() => {
      r.timer = null
      void this.runSync(shareId).catch(() => {})
    }, delay)
  }

  private runSync(shareId: string): Promise<void> {
    const r = this.rt(shareId)
    if (r.running) {
      r.again = true
      return r.running
    }
    r.running = (async () => {
      try {
        do {
          r.again = false
          await this.syncOnce(shareId)
        } while (r.again && !this.stopped)
      } finally {
        r.running = null
        this.announce(shareId)
      }
    })()
    return r.running
  }

  private async syncOnce(shareId: string): Promise<void> {
    const rec = this.records[shareId]
    if (!rec || rec.revoked) return
    const r = this.rt(shareId)
    try {
      if (rec.role === 'owner') {
        // privacy follows the agenda: made private, or its recording made private → unshare
        for (const o of Object.values(rec.occurrences)) {
          const a = this.d.agendas.agendas.get(o.agendaId)
          if (!a) continue
          try {
            this.shareable(a)
          } catch (err) {
            await this.unshare(o.agendaId, (err as Error).message)
            return
          }
        }
      }
      const client = this.client(rec)
      if (!r.server) r.server = await client.call('getShareState', { params: { shareId } })
      this.adopt(rec, r.server)
      const snapshots = new Map<string, string>()
      const ops: ShareOp[] = []
      for (const [occ, o] of Object.entries(rec.occurrences)) {
        const view = this.d.agendas.agendas.view(o.agendaId)
        if (!view) continue
        for (const i of view.items) snapshots.set(i.id, JSON.stringify(i))
        const p = {
          occurrence: occ,
          view,
          history: this.d.agendas.agendas.history(o.agendaId),
          seenRemote: new Set(o.seenRemote),
          recapShared: o.recapShared,
        }
        const pushed = new Set(rec.pushed)
        ops.push(
          ...(rec.role === 'owner'
            ? ownerOps(p, {
                server: r.server,
                current: rec.current === occ,
                shareGoals: rec.shareGoals,
                pushed,
              })
            : memberOps(p, { server: r.server, me: rec.participantId, pushed })),
        )
      }
      let state: SharedAgendaState
      if (ops.length) {
        const res = await client.call('pushShare', { params: { shareId }, body: { ops } })
        const keys = ops.flatMap((x) => (x.op === 'status' ? [x.key] : []))
        rec.pushed = [...new Set([...rec.pushed, ...keys])].slice(-5000)
        r.refused += res.changes.filter((c) => c.outcome === 'refused' || c.outcome === 'superseded').length
        if (res.refused.length)
          this.d.logger.warn('share push: some changes were refused', {
            shareId,
            refused: res.refused.slice(0, 5),
          })
        state = res.state
      } else state = await client.call('getShareState', { params: { shareId } })
      r.server = state
      this.adopt(rec, state)
      this.mirror(rec, state, snapshots)
      this.save()
      r.state = 'ok'
      r.error = null
      r.lastSyncAt = (this.d.now ?? (() => new Date()))().toISOString()
    } catch (err) {
      const e = this.remoteError(err)
      const status = err instanceof KacolaApiError ? err.status : e.status
      if (status === 410) {
        rec.revoked = 'the organizer stopped sharing this agenda'
        this.save()
        this.d.logger.info('shared agenda revoked', { shareId })
        return
      }
      if (status === 401 && rec.role === 'member') {
        rec.revoked = 'the organizer removed you from this agenda'
        this.save()
        return
      }
      r.state = 'error'
      r.error = e.message
      this.d.logger.warn('share sync failed', { shareId, err: e.message })
    }
  }

  /** Take the server's header into the record (a member learns the owner's current occurrence here). */
  private adopt(rec: ShareRecord, s: SharedAgendaState): void {
    rec.ownerName = s.share.ownerName
    // the owner decides the current occurrence (their record leads the server, not the other way round)
    if (rec.role === 'member') {
      rec.current = s.share.current
      rec.allowInvitees = s.share.options.allowInvitees
      // follow the owner's current occurrence (a recurring series' next meeting arrives here)
      if (!rec.occurrences[s.share.current]) {
        const occ = s.share.occurrences.find((x) => x.agendaId === s.share.current)
        if (occ)
          rec.occurrences[occ.agendaId] = {
            agendaId: this.localCopy(rec, occ),
            recapShared: occ.recapShared,
            seenRemote: [],
          }
      }
      for (const [id, o] of Object.entries(rec.occurrences))
        o.recapShared = s.share.occurrences.find((x) => x.agendaId === id)?.recapShared ?? false
    }
  }

  /** A member's local agenda for an occurrence: the one for that calendar occurrence, else a new one. */
  private localCopy(rec: ShareRecord, occ: SharedAgendaState['share']['occurrences'][number]): string {
    const store = this.d.agendas.agendas
    let meeting: AgendaMeeting | null = null
    if (occ.meeting) {
      const m = this.d.agendas.findOccurrence(occ.meeting.eventUid, occ.meeting.start)
      meeting = m
        ? toAgendaMeeting(m)
        : {
            eventUid: occ.meeting.eventUid,
            start: occ.meeting.start,
            end: occ.meeting.end,
            recurrenceId: occ.meeting.recurring ? occ.meeting.start : null,
            meetingId: null,
            title: occ.title,
            calendar: null,
            recurring: occ.meeting.recurring,
          }
      const existing = store.forOccurrence(meeting)
      if (existing) return existing.id
    }
    const view = store.create({
      title: occ.title,
      meeting,
      owner: rec.ownerName || 'organizer',
      goals: occ.goals,
    })
    this.d.logger.info('following a shared agenda', { shareId: rec.shareId, agendaId: view.agenda.id })
    return view.agenda.id
  }

  /** Bring the local agendas in line with the server (what other devices and invitees did). */
  private mirror(rec: ShareRecord, s: SharedAgendaState, snapshots: Map<string, string>): void {
    const store = this.d.agendas.agendas
    this.mirroring++
    try {
      for (const [occ, o] of Object.entries(rec.occurrences)) {
        const view = store.view(o.agendaId)
        if (!view) continue
        const agendaId = o.agendaId
        const seen = new Set(o.seenRemote)
        const remote = s.items.filter((i) => i.occurrence === occ)
        const remoteIds = new Set(remote.map((i) => i.id))
        const local = new Map(view.items.map((i) => [i.id, i]))
        for (const ri of remote) {
          const li = local.get(ri.id)
          const changedMeanwhile = li && snapshots.has(ri.id) && snapshots.get(ri.id) !== JSON.stringify(li)
          if (changedMeanwhile) continue
          const mine = ri.createdBy.participantId === rec.participantId
          const remoteOwned = rec.role === 'member' ? !mine : ri.createdBy.role !== 'owner'
          if (!li) {
            // an item someone else added (or, for a member, the owner's items)
            if (mine || (rec.role === 'owner' && ri.createdBy.role === 'owner')) continue // deleted here, push pending
            if (seen.has(ri.id)) continue // deleted here; the delete is pushed next round
            store.mirrorItem(
              agendaId,
              {
                id: ri.id,
                text: ri.text,
                kind: ri.kind,
                owner: ri.owner,
                timeboxMin: ri.timeboxMin,
                outcome: ri.outcome,
                carriedFrom: ri.carriedFrom
                  ? { agendaId: ri.carriedFrom.occurrence, itemId: ri.carriedFrom.itemId }
                  : null,
              },
              peerAttribution(ri.createdBy),
            )
            seen.add(ri.id)
          } else if (remoteOwned) {
            const sameFields =
              li.text === ri.text &&
              li.kind === ri.kind &&
              li.owner === ri.owner &&
              li.timeboxMin === ri.timeboxMin &&
              (rec.role === 'owner' || li.outcome === ri.outcome)
            if (!sameFields)
              store.mirrorItem(
                agendaId,
                {
                  id: ri.id,
                  text: ri.text,
                  kind: ri.kind,
                  owner: ri.owner,
                  timeboxMin: ri.timeboxMin,
                  ...(rec.role === 'member' ? { outcome: ri.outcome } : {}),
                },
                peerAttribution(ri.createdBy),
              )
            seen.add(ri.id)
          }
          const cur = store.item(agendaId, ri.id)
          if (cur && cur.status !== ri.status)
            store.mirrorStatus(agendaId, ri.id, ri.status, peerAttribution(ri.changedBy), {
              auto: ri.auto,
              confidence: ri.confidence,
            })
        }
        // removed on the server by whoever owned them
        for (const li of store.items(agendaId)) {
          if (remoteIds.has(li.id)) continue
          const wasRemote = seen.has(li.id)
          const ownerCopyOfOwnerItem = rec.role === 'member' && !isLocalAuthor(li.createdBy)
          if (wasRemote || ownerCopyOfOwnerItem) {
            if (snapshots.has(li.id) && snapshots.get(li.id) !== JSON.stringify(li)) continue
            // removed on the server: by its author (an attendee), as far as this device can tell
            store.deleteItem(agendaId, li.id, isLocalAuthor(li.createdBy) ? 'user' : peerPerson(li.createdBy))
            seen.delete(li.id)
          }
        }
        if (rec.role === 'member') {
          // the owner's order; items only this device knows go last
          const order = [...remote].sort((a, b) => a.order - b.order).map((i) => i.id)
          const items = store.items(agendaId)
          const want = [
            ...order.filter((id) => items.some((i) => i.id === id)),
            ...items.filter((i) => !remoteIds.has(i.id)).map((i) => i.id),
          ]
          if (want.join() !== items.map((i) => i.id).join()) store.reorder(agendaId, want)
          // the owner's shared cards, read-only here
          const cards = s.cards.filter((c) => c.occurrence === occ)
          const localCards = new Map(store.context(agendaId).map((c) => [c.id, c]))
          for (const c of cards) {
            const lc = localCards.get(c.id)
            if (!lc || lc.title !== c.title || lc.body !== c.body || lc.pinned !== c.pinned)
              store.mirrorCard(agendaId, c, peerAttribution({ ...ownerOf(s), by: 'user' }))
          }
          const ids = new Set(cards.map((c) => c.id))
          for (const lc of localCards.values())
            if (lc.createdBy.startsWith('peer:') && !ids.has(lc.id)) store.deleteContext(agendaId, lc.id)
        }
        o.seenRemote = [...seen]
      }
    } finally {
      this.mirroring--
    }
  }

  // ----------------------------------------------------------------------------- local changes

  private onEvent(e: DurableEvent): void {
    if (this.mirroring > 0) return
    const d = e.data
    if (d.type === 'agenda.deleted') {
      const f = this.recordOf(d.agendaId)
      if (f) {
        if (f.rec.role === 'owner' && Object.keys(f.rec.occurrences).length === 1)
          void this.unshare(d.agendaId, 'agenda deleted').catch(() => {})
        else {
          delete f.rec.occurrences[f.occurrence]
          this.save()
        }
      }
      return
    }
    if (d.type === 'agenda.upserted') {
      const a = d.agenda
      // a recurring meeting's next occurrence, seeded from a shared one: it joins the same link
      if (a.carriedFrom && !this.recordOf(a.id)) {
        const prev = this.recordOf(a.carriedFrom)
        if (prev && prev.rec.role === 'owner' && !prev.rec.revoked) {
          prev.rec.occurrences[a.id] = { agendaId: a.id, recapShared: false, seenRemote: [] }
          prev.rec.current = a.id
          this.save()
          this.d.logger.info('shared agenda: next occurrence joins the link', {
            shareId: prev.rec.shareId,
            agendaId: a.id,
          })
          this.kick(prev.rec.shareId)
          return
        }
      }
    }
    if (d.type === 'session.upserted' && d.session.private) {
      for (const a of this.d.agendas.agendas.bySession(d.session.id)) {
        const f = this.recordOf(a.id)
        if (f) this.kick(f.rec.shareId, 0)
      }
      return
    }
    if (!d.type.startsWith('agenda.') || d.type === 'agenda.suggestion.upserted') return
    const agendaId =
      (d as { agendaId?: string }).agendaId ?? (d.type === 'agenda.upserted' ? d.agenda.id : undefined)
    if (!agendaId) return
    const f = this.recordOf(agendaId)
    if (f && !f.rec.revoked) this.kick(f.rec.shareId)
  }

  // ------------------------------------------------------------------------------------ helpers

  private async call<T>(rec: ShareRecord, fn: (c: KacolaClient) => Promise<T>): Promise<T> {
    try {
      return await fn(this.client(rec))
    } catch (err) {
      throw this.remoteError(err)
    }
  }

  private remoteError(err: unknown): DaemonError {
    if (err instanceof DaemonError) return err
    if (err instanceof KacolaApiError) {
      const code =
        err.status === 410 || err.status === 404
          ? 'not_found'
          : err.status === 401 || err.status === 403
            ? 'unauthorized'
            : err.status === 409 || err.status === 429
              ? 'conflict'
              : err.status === 400
                ? 'bad_request'
                : 'unavailable'
      return new DaemonError(
        code,
        `the sharing host said: ${err.message}`,
        err.status === 401 ? 403 : err.status,
      )
    }
    return new DaemonError('unavailable', `the sharing host is unreachable: ${(err as Error).message}`, 503)
  }
}

const ownerOf = (s: SharedAgendaState) => ({
  participantId: 'owner',
  role: 'owner' as const,
  label: s.share.ownerLabel,
  name: s.share.ownerName,
})
