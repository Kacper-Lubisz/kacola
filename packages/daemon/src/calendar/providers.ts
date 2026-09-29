import { existsSync, readFileSync, statSync, unwatchFile, watchFile } from 'node:fs'
import { resolve } from 'node:path'
import type { CalendarState } from '@gnomeola/protocol'
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
export type CalendarSnapshot = { calendars: CalendarInfo[]; occurrences: RawOccurrence[] }

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
  refresh(): void
  stop(): Promise<void>
}

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
  start(l: ProviderListener): void {
    this.l = l
    l.status('starting', null)
  }
  setWindow(from: Date, to: Date): void {
    this.window = { from, to }
  }
  refresh(): void {
    this.refreshes++
  }
  async stop(): Promise<void> {
    this.l = null
  }
  push(s: CalendarSnapshot): void {
    this.l?.snapshot(s)
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
  }),
])

export function parseCalendarFile(text: string): CalendarSnapshot {
  const parsed = CalendarFile.parse(JSON.parse(text))
  const occurrences = Array.isArray(parsed) ? parsed : parsed.occurrences
  const calendars = (!Array.isArray(parsed) && parsed.calendars) || [
    ...new Map(occurrences.map((o) => [o.sourceUid, { id: o.sourceUid, name: o.calendarName }])).values(),
  ]
  return { calendars, occurrences }
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
    // watchFile (stat polling) rather than fs.watch: it survives the file being replaced by rename,
    // which is how editors and atomic writers save.
    watchFile(this.path, { interval: this.pollMs }, () => this.read())
  }

  private read(): void {
    const l = this.l
    if (!l) return
    if (!existsSync(this.path)) {
      l.status('unavailable', `calendar file ${this.path} does not exist`)
      this.lastMtime = -1
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
    unwatchFile(this.path)
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
}

export class EdsCalendarProvider implements CalendarProvider {
  readonly name = 'eds'
  readonly expands = true
  private readonly o: EdsProviderOptions
  private child: LineChild | null = null
  private l: ProviderListener | null = null
  private window: { from: Date; to: Date } | null = null
  private greeted = false

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
        this.l?.snapshot({ calendars: m.calendars, occurrences: m.occurrences })
        this.l?.status('ok', null)
        return
      case 'error':
        log[m.fatal ? 'error' : 'warn']('cal-agent error', { message: m.message })
        if (m.fatal) this.l?.status('unavailable', m.message)
        return
      case 'log':
        log[m.level](`cal-agent: ${m.message}`)
        return
    }
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
    await c?.stop()
  }
}

const lastLine = (s: string) => s.trim().split('\n').at(-1)?.slice(0, 300) ?? ''
