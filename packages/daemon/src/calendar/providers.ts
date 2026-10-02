import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { type CalendarState, OfflineCalendar } from '@gnomeola/protocol'
import { z } from 'zod'
import { LineChild } from '../line-child.ts'
import type { Logger } from '../logger.ts'
import { AgentMessage, CAL_AGENT_PROTOCOL, type DaemonToAgent, RawOccurrence } from './agent-protocol.ts'

// C-1: where meetings come from. A provider delivers whole snapshots (every occurrence in the window)
// and reports its state; the CalendarService (./service.ts) does everything else.
//
//   EdsCalendarProvider   Evolution Data Server via the cal-agent GJS helper — every calendar the user
//                         has in GNOME (local, GNOME Online Accounts: Google, Microsoft 365, CalDAV)
//   FileCalendarProvider  a JSON file of occurrences, re-read when it changes (tests, demos, and anyone
//                         who wants to feed meetings from a script)
//   NoCalendar            calendar reading is off

export type CalendarInfo = { id: string; name: string }
export type CalendarSnapshot = {
  calendars: CalendarInfo[]
  occurrences: RawOccurrence[]
  /** Calendars that could not be brought up to date (absent: all are). */
  offline?: OfflineCalendar[]
}

export type ProviderListener = {
  snapshot: (s: CalendarSnapshot) => void
  status: (state: CalendarState, detail: string | null) => void
}

export interface CalendarProvider {
  readonly name: string
  /** Whether the provider expands recurrences over a window (so a query outside it needs a new one). */
  readonly expands: boolean
  start(listener: ProviderListener): void
  /** The range recurrences are expanded over. Providers without expansion may ignore it. */
  setWindow(from: Date, to: Date): void
  /** Re-read every calendar now (and retry the ones that failed); a new snapshot follows when it can. */
  refresh(): void
  stop(): Promise<void>
  /**
   * Agendas: rewrite an event's description with `edit` (which gets the current description and returns
   * the new one). Only providers that can write implement it (EDS); the others are read-only, and the
   * caller hands the user the text to paste instead. A recurring event is edited as a whole series.
   */
  editDescription?(target: DescriptionTarget, edit: (current: string) => string): Promise<DescriptionEdit>
}

/** Which event to edit: the calendar (ESource UID), the iCalendar UID, and the occurrence. */
export type DescriptionTarget = {
  sourceUid: string
  uid: string
  recurrenceId: string | null
  recurring: boolean
}
/** `changed: false` = the description already said exactly that (idempotent). `reason` says why not. */
export type DescriptionEdit = { ok: true; changed: boolean } | { ok: false; reason: string }

export class NoCalendar implements CalendarProvider {
  readonly name = 'none'
  readonly expands = false
  start(l: ProviderListener): void {
    l.status('off', null)
  }
  setWindow(): void {}
  refresh(): void {}
  async stop(): Promise<void> {}
}

/** Scripted provider for tests: push snapshots and states by hand. */
export class ManualCalendarProvider implements CalendarProvider {
  readonly name = 'manual'
  readonly expands: boolean
  constructor(o: { expands?: boolean } = {}) {
    this.expands = o.expands ?? false
  }
  private l: ProviderListener | null = null
  window: { from: Date; to: Date } | null = null
  refreshes = 0
  /** What a refresh re-reads: the last pushed snapshot, again (or this, when set). */
  onRefresh: (() => CalendarSnapshot | null) | null = null
  private last: CalendarSnapshot | null = null
  start(l: ProviderListener): void {
    this.l = l
    l.status('starting', null)
  }
  setWindow(from: Date, to: Date): void {
    this.window = { from, to }
  }
  refresh(): void {
    this.refreshes++
    const s = this.onRefresh ? this.onRefresh() : this.last
    if (s) this.push(s)
  }
  async stop(): Promise<void> {
    this.l = null
  }
  push(s: CalendarSnapshot): void {
    this.last = s
    this.l?.snapshot(s)
  }
  /** Descriptions by event UID, as editDescription sees and leaves them; `readOnly` UIDs refuse. */
  readonly descriptions = new Map<string, string>()
  readonly readOnly = new Set<string>()
  async editDescription(t: DescriptionTarget, edit: (current: string) => string): Promise<DescriptionEdit> {
    if (this.readOnly.has(t.uid)) return { ok: false, reason: 'the calendar is read-only' }
    const cur = this.descriptions.get(t.uid) ?? ''
    const next = edit(cur)
    this.descriptions.set(t.uid, next)
    return { ok: true, changed: next !== cur }
  }
  state(state: CalendarState, detail: string | null = null): void {
    this.l?.status(state, detail)
  }
}

// ------------------------------------------------------------------------------------------ file

export const CalendarFile = z.union([
  z.array(RawOccurrence),
  z.object({
    calendars: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    occurrences: z.array(RawOccurrence),
    /** Calendars to report as not up to date (tests and demos of the window's quiet notice). */
    offline: z.array(OfflineCalendar).optional(),
  }),
])

export function parseCalendarFile(text: string): CalendarSnapshot {
  const parsed = CalendarFile.parse(JSON.parse(text))
  const occurrences = Array.isArray(parsed) ? parsed : parsed.occurrences
  const calendars = (!Array.isArray(parsed) && parsed.calendars) || [
    ...new Map(occurrences.map((o) => [o.sourceUid, { id: o.sourceUid, name: o.calendarName }])).values(),
  ]
  const offline = Array.isArray(parsed) ? undefined : parsed.offline
  return { calendars, occurrences, ...(offline ? { offline } : {}) }
}

export class FileCalendarProvider implements CalendarProvider {
  readonly name = 'file'
  readonly expands = false
  private readonly path: string
  private readonly pollMs: number
  private l: ProviderListener | null = null
  private lastMtime = -1

  constructor(path: string, opts: { pollMs?: number } = {}) {
    this.path = resolve(path)
    this.pollMs = opts.pollMs ?? 250
  }

  start(l: ProviderListener): void {
    this.l = l
    l.status('starting', null)
    this.read()
    // Stat polling rather than fs.watch, because it survives the file being replaced by rename (how
    // editors and atomic writers save). Our own interval compares against what we last READ; fs.watchFile
    // compares against a baseline it stats asynchronously after start, so a file created in that window
    // was never noticed (a flake under load that was a real miss).
    this.timer = setInterval(() => this.read(), this.pollMs)
    this.timer.unref()
  }
  private timer: NodeJS.Timeout | null = null

  private read(): void {
    const l = this.l
    if (!l) return
    if (!existsSync(this.path)) {
      if (this.lastMtime !== -2) l.status('unavailable', `calendar file ${this.path} does not exist`)
      this.lastMtime = -2
      return
    }
    const mtime = statSync(this.path).mtimeMs
    if (mtime === this.lastMtime) return
    this.lastMtime = mtime
    try {
      const snap = parseCalendarFile(readFileSync(this.path, 'utf8'))
      l.snapshot(snap)
      l.status('ok', null)
    } catch (err) {
      l.status(
        'unavailable',
        `calendar file ${this.path}: ${err instanceof Error ? err.message.slice(0, 300) : String(err)}`,
      )
    }
  }

  setWindow(): void {}
  refresh(): void {
    this.lastMtime = -1
    this.read()
  }
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.l = null
  }
}

// ------------------------------------------------------------------------------------------- EDS

export const CAL_AGENT_PATH = resolve(import.meta.dirname, '../../gjs/cal-agent.js')

export type EdsProviderOptions = {
  logger: Logger
  /** gjs binary. Default `gjs` on PATH (GNOMEOLA_GJS overrides in main.ts). */
  gjs?: string
  agentPath?: string
  env?: NodeJS.ProcessEnv
  minBackoffMs?: number
  maxBackoffMs?: number
  /** How long a description read/write may take before it is given up (default 10 s). */
  requestTimeoutMs?: number
}

type DescriptionReply = Extract<AgentMessage, { type: 'description' | 'description-written' }>

export class EdsCalendarProvider implements CalendarProvider {
  readonly name = 'eds'
  readonly expands = true
  private readonly o: EdsProviderOptions
  private child: LineChild | null = null
  private l: ProviderListener | null = null
  private window: { from: Date; to: Date } | null = null
  private greeted = false
  /** Description requests waiting for the agent's answer, by requestId. */
  private readonly pending = new Map<string, (reply: DescriptionReply | { failed: string }) => void>()

  constructor(o: EdsProviderOptions) {
    this.o = o
  }

  get agentPid(): number | null {
    return this.child?.pid ?? null
  }

  start(l: ProviderListener): void {
    this.l = l
    l.status('starting', null)
    const log = this.o.logger
    this.child = new LineChild({
      name: 'cal-agent',
      command: this.o.gjs ?? 'gjs',
      args: ['-m', this.o.agentPath ?? CAL_AGENT_PATH],
      env: this.o.env,
      minBackoffMs: this.o.minBackoffMs ?? 1000,
      maxBackoffMs: this.o.maxBackoffMs ?? 60_000,
      log: (level, message, fields) => log[level](message, fields),
      onStart: () => {
        this.greeted = false
      },
      onMessage: (raw) => this.onMessage(raw),
      onExit: ({ code, signal, error, stderr, willRestart }) => {
        this.greeted = false
        this.failPending('the calendar helper exited')
        const why = error
          ? `could not run gjs: ${error}`
          : `cal-agent exited (${signal ?? `code ${code}`})${stderr ? `: ${lastLine(stderr)}` : ''}`
        this.l?.status(willRestart ? 'starting' : 'unavailable', why)
        if (!willRestart) log.error('cal-agent gave up', { why })
      },
    })
    this.child.start()
  }

  private onMessage(raw: unknown): void {
    const parsed = AgentMessage.safeParse(raw)
    const log = this.o.logger
    if (!parsed.success) {
      log.warn('cal-agent sent an invalid message', { issues: parsed.error.issues.slice(0, 3) })
      return
    }
    const m = parsed.data
    switch (m.type) {
      case 'hello':
        if (m.protocol !== CAL_AGENT_PROTOCOL) {
          this.l?.status(
            'unavailable',
            `cal-agent speaks protocol ${m.protocol}, expected ${CAL_AGENT_PROTOCOL}`,
          )
          void this.child?.stop()
          return
        }
        this.greeted = true
        if (this.window) this.sendWindow()
        return
      case 'snapshot':
        this.l?.snapshot({
          calendars: m.calendars,
          occurrences: m.occurrences,
          ...(m.offline ? { offline: m.offline } : {}),
        })
        this.l?.status('ok', null)
        return
      case 'error':
        log[m.fatal ? 'error' : 'warn']('cal-agent error', { message: m.message })
        if (m.fatal) this.l?.status('unavailable', m.message)
        return
      case 'log':
        log[m.level](`cal-agent: ${m.message}`)
        return
      case 'description':
      case 'description-written': {
        const done = this.pending.get(m.requestId)
        this.pending.delete(m.requestId)
        done?.(m)
        return
      }
    }
  }

  private failPending(reason: string): void {
    for (const [id, done] of [...this.pending]) {
      this.pending.delete(id)
      done({ failed: reason })
    }
  }

  /** One request to the agent, answered by requestId (or failed on timeout / exit / not running). */
  private request(
    msg:
      | Omit<Extract<DaemonToAgent, { type: 'read-description' }>, 'requestId'>
      | Omit<Extract<DaemonToAgent, { type: 'write-description' }>, 'requestId'>,
  ): Promise<DescriptionReply | { failed: string }> {
    if (!this.child || !this.greeted) return Promise.resolve({ failed: 'the calendar helper is not running' })
    const requestId = randomUUID()
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        resolve({ failed: 'the calendar helper did not answer' })
      }, this.o.requestTimeoutMs ?? 10_000)
      timer.unref()
      this.pending.set(requestId, (r) => {
        clearTimeout(timer)
        resolve(r)
      })
      if (!this.child?.send({ ...msg, requestId } as DaemonToAgent)) {
        this.pending.delete(requestId)
        clearTimeout(timer)
        resolve({ failed: 'the calendar helper is not running' })
      }
    })
  }

  /**
   * Compare-and-swap through the agent: read the description (and whether we may write it), compute the
   * new one with `edit`, write it only if it is still what we read. A concurrent change is retried once.
   */
  async editDescription(t: DescriptionTarget, edit: (current: string) => string): Promise<DescriptionEdit> {
    const target = {
      sourceUid: t.sourceUid,
      uid: t.uid,
      recurrenceId: t.recurrenceId,
      recurring: t.recurring,
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const read = await this.request({ type: 'read-description', ...target })
      if ('failed' in read) return { ok: false, reason: read.failed }
      if (read.type !== 'description')
        return { ok: false, reason: 'the calendar helper answered out of turn' }
      if (!read.ok || !read.writable)
        return { ok: false, reason: read.reason ?? 'the event cannot be written' }
      const next = edit(read.description)
      if (next === read.description) return { ok: true, changed: false }
      const w = await this.request({
        type: 'write-description',
        ...target,
        expect: read.description,
        description: next,
      })
      if ('failed' in w) return { ok: false, reason: w.failed }
      if (w.type !== 'description-written')
        return { ok: false, reason: 'the calendar helper answered out of turn' }
      if (w.ok) return { ok: true, changed: w.changed }
      if (!w.conflict) return { ok: false, reason: w.reason ?? 'the calendar refused the change' }
    }
    return { ok: false, reason: 'the event kept changing while we wrote to it; try again' }
  }

  private sendWindow(): void {
    if (!this.window || !this.greeted) return
    const msg: DaemonToAgent = {
      type: 'window',
      from: this.window.from.toISOString(),
      to: this.window.to.toISOString(),
    }
    this.child?.send(msg)
  }

  setWindow(from: Date, to: Date): void {
    this.window = { from, to }
    this.sendWindow()
  }

  refresh(): void {
    if (this.greeted) this.child?.send({ type: 'refresh' } satisfies DaemonToAgent)
  }

  async stop(): Promise<void> {
    const c = this.child
    this.child = null
    this.l = null
    this.failPending('the calendar provider stopped')
    await c?.stop()
  }
}

const lastLine = (s: string) => s.trim().split('\n').at(-1)?.slice(0, 300) ?? ''
