import { resolve } from 'node:path'
import type { AnyEvent, Session, SessionStatus } from '@gnomeola/protocol'
import type { Store } from '@gnomeola/store'
import type { EventBus } from '../bus.ts'
import type { CalendarService } from '../calendar/service.ts'
import type { RecordingControl } from '../control.ts'
import { toDaemonError } from '../errors.ts'
import { LineChild } from '../line-child.ts'
import type { Logger } from '../logger.ts'
import type { SessionManager } from '../sessions.ts'
import type { SettingsService } from '../settings.ts'
import {
  type BridgeToDaemon,
  type DaemonToBridge,
  DBUS_ERRORS,
  type DbusCall,
  type DbusProps,
  type DbusSignal,
} from './bridge-protocol.ts'
import { changedProps, dbusMeeting, dbusView } from './view.ts'

// C-4: org.gnome.Gnomeola on the session bus. This side decides every value (./view.ts) and answers
// every method call through RecordingControl; the GJS bridge only transports. Properties are pushed as
// diffs whenever anything they depend on changes: a session event, a settings change, the calendar, or
// a transcript line (throttled — partials arrive many times a second, the panel needs a few).

export const BRIDGE_PATH = resolve(import.meta.dirname, '../../gjs/dbus-bridge.js')
export const INTERFACE_XML = resolve(import.meta.dirname, '../../dbus/org.gnome.Gnomeola.xml')

const LINE_THROTTLE_MS = 250
const LIVE: SessionStatus[] = ['recording', 'paused']

export type DbusServiceDeps = {
  store: Store
  bus: EventBus
  sessions: SessionManager
  calendar: CalendarService
  control: RecordingControl
  settings: SettingsService
  logger: Logger
  url: string
  version: string
  gjs?: string
  env?: NodeJS.ProcessEnv
  minBackoffMs?: number
}

export class DbusService {
  private readonly d: DbusServiceDeps
  private child: LineChild | null = null
  private sent: Partial<DbusProps> = {}
  private owned = false
  /** The panel's last transcript line. `segmentId`/`speakerId` let a later attribution relabel it. */
  private lastLine: {
    sessionId: string
    speaker: string
    text: string
    segmentId?: string
    speakerId?: string
  } | null = null
  private lineTimer: NodeJS.Timeout | null = null
  private readonly statusOf = new Map<string, SessionStatus>()
  private readonly unsubscribe: (() => void)[] = []

  constructor(d: DbusServiceDeps) {
    this.d = d
  }

  /** Whether the bridge currently owns the bus name. */
  get ownsName(): boolean {
    return this.owned
  }

  get bridgePid(): number | null {
    return this.child?.pid ?? null
  }

  start(): void {
    const { bus, calendar, logger } = this.d
    for (const s of this.d.store.sessionsWithStatus(LIVE)) this.statusOf.set(s.id, s.status)
    this.unsubscribe.push(
      bus.subscribe((e) => this.onEvent(e)),
      calendar.onChange(() => this.push()),
      calendar.onStarting((m) => this.signal({ name: 'MeetingStarting', args: [dbusMeeting(m) as never] })),
    )
    this.child = new LineChild({
      name: 'dbus-bridge',
      command: this.d.gjs ?? 'gjs',
      args: ['-m', BRIDGE_PATH, INTERFACE_XML],
      env: this.d.env,
      minBackoffMs: this.d.minBackoffMs ?? 1000,
      maxBackoffMs: 60_000,
      log: (level, message, fields) => logger[level](message, fields),
      onStart: () => {
        // a fresh bridge knows nothing: send everything
        this.sent = {}
        this.push()
      },
      onMessage: (m) => this.onBridge(m as BridgeToDaemon),
      onExit: ({ willRestart, error }) => {
        this.owned = false
        if (!willRestart) logger.error('D-Bus bridge gave up', { error })
      },
    })
    this.child.start()
  }

  async stop(): Promise<void> {
    for (const u of this.unsubscribe.splice(0)) u()
    if (this.lineTimer) clearTimeout(this.lineTimer)
    this.lineTimer = null
    const c = this.child
    this.child = null
    await c?.stop()
  }

  // ---------------------------------------------------------------------------------- state

  private active(): Session | null {
    return this.d.control.active()
  }

  props(): DbusProps {
    const session = this.active()
    const cal = this.d.calendar.next()
    return dbusView({
      session,
      timing: session ? this.d.sessions.timing(session.id) : null,
      lastLine: session && this.lastLine?.sessionId === session.id ? this.lastLine : null,
      current: cal.current,
      next: cal.next,
      upcoming: this.d.calendar.upcoming(),
      calendar: cal.calendar,
      autoRecord: this.d.settings.get().autoRecord,
      url: this.d.url,
      version: this.d.version,
    })
  }

  private push(): void {
    if (!this.child?.running) return
    const next = this.props()
    const diff = changedProps(this.sent, next)
    if (!Object.keys(diff).length) return
    if (this.send({ type: 'props', props: diff })) this.sent = { ...this.sent, ...diff }
  }

  private send(msg: DaemonToBridge): boolean {
    return this.child?.send(msg) ?? false
  }

  private signal(s: DbusSignal): void {
    this.send({ type: 'signal', ...s } as DaemonToBridge)
  }

  private onEvent(e: AnyEvent): void {
    const data = e.data
    switch (data.type) {
      case 'session.upserted': {
        const s = data.session
        const was = this.statusOf.get(s.id)
        if (LIVE.includes(s.status)) this.statusOf.set(s.id, s.status)
        else this.statusOf.delete(s.id)
        if (s.status === 'recording' && was === undefined)
          this.signal({
            name: 'SessionStarted',
            args: [s.id, s.private ? 'Private meeting' : s.title, this.d.control.reason(s.id)],
          })
        if (was !== undefined && !LIVE.includes(s.status)) {
          this.signal({ name: 'SessionStopped', args: [s.id, s.status] })
          if (this.lastLine?.sessionId === s.id) this.lastLine = null
        }
        this.push()
        return
      }
      case 'session.deleted':
      case 'settings.updated':
        this.push()
        return
      case 'segment.upserted': {
        const g = data.segment
        this.line(g.sessionId, g.speaker, g.text, g.id, g.speakerId)
        return
      }
      // A far-end line is shown as "them" until diarization attributes it; relabel it when that (or a
      // rename or merge of its speaker) lands, rather than leaving the panel a step behind the window.
      case 'segments.attributed':
        if (this.lastLine?.segmentId && data.segmentIds.includes(this.lastLine.segmentId))
          this.relabel(data.speakerId)
        return
      case 'speaker.upserted':
      case 'speaker.merged':
        if (this.lastLine?.speakerId) this.relabel(this.lastLine.speakerId)
        return
      case 'transcript.partial':
        if (e.sessionId) this.line(e.sessionId, data.speaker, data.text)
        return
      default:
        return
    }
  }

  private relabel(speakerId: string): void {
    const sp = this.d.store.resolveSpeaker(speakerId)
    if (!sp || !this.lastLine) return
    this.line(this.lastLine.sessionId, sp.label, this.lastLine.text, this.lastLine.segmentId, sp.id)
  }

  private line(
    sessionId: string,
    speaker: string,
    text: string,
    segmentId?: string,
    speakerId?: string,
  ): void {
    if (!text.trim()) return
    this.lastLine = { sessionId, speaker, text, segmentId, speakerId }
    if (this.lineTimer) return
    this.lineTimer = setTimeout(() => {
      this.lineTimer = null
      this.push()
    }, LINE_THROTTLE_MS)
    this.lineTimer.unref()
  }

  // ---------------------------------------------------------------------------------- calls

  private onBridge(m: BridgeToDaemon): void {
    const log = this.d.logger
    switch (m.type) {
      case 'acquired':
        this.owned = true
        log.info('D-Bus name acquired', { name: m.name })
        return
      case 'lost':
        this.owned = false
        log.warn('D-Bus name not owned (another gnomeolad has it, or there is no session bus)', {
          name: m.name,
        })
        return
      case 'log':
        log[m.level](`dbus-bridge: ${m.message}`)
        return
      case 'call':
        void this.call(m.id, m)
        return
    }
  }

  private async call(id: number, c: DbusCall): Promise<void> {
    const ctl = this.d.control
    try {
      let result: unknown[]
      switch (c.method) {
        case 'Start':
          result = [(await ctl.startNew({ title: String(c.args[0] ?? ''), reason: 'manual' })).id]
          break
        case 'Stop':
          result = [(await ctl.stopActive()).id]
          break
        case 'Pause':
          await ctl.pauseActive()
          result = []
          break
        case 'Resume':
          await ctl.resumeActive()
          result = []
          break
        case 'Join': {
          const r = await ctl.join(String(c.args[0] ?? ''))
          result = [r.session.id, r.joinUrl ?? '']
          break
        }
        default:
          throw new Error(`unknown method ${(c as { method: string }).method}`)
      }
      this.send({ type: 'reply', id, result })
    } catch (err) {
      const e = toDaemonError(err)
      if (e.code === 'internal')
        this.d.logger.error('D-Bus call failed', { method: c.method, err: String(err) })
      this.send({ type: 'reply', id, error: { name: DBUS_ERRORS[e.code], message: e.message } })
    }
  }
}
