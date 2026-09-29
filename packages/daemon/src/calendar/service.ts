import type { CalendarState, CalendarStatus, Meeting, MeetingList, NextMeeting } from '@gnomeola/protocol'
import type { EventBus } from '../bus.ts'
import { DaemonError } from '../errors.ts'
import type { Logger } from '../logger.ts'
import { currentAndNext, endOfLocalDay, inWindow, isTimedMeeting, toMeetings, upcoming } from './meetings.ts'
import type { CalendarInfo, CalendarProvider } from './providers.ts'

// C-3: the daemon's calendar. Holds the latest snapshot from the provider in memory (the calendar
// itself is the source of truth — nothing here is durable), keeps the provider's expansion window
// rolling forward, and drives two moments per timed meeting:
//
//   starting   ANNOUNCE_MS before its start: the `meeting.starting` event (the Shell notification)
//   begin      at its start: auto-record's calendar rule (./auto-record.ts)
//
// Each fires once per occurrence per daemon run. Meetings that had already begun when the daemon
// started (or when a snapshot first revealed them) do not fire `begin` late: auto-record starting in
// the middle of a meeting nobody asked it to record would be a surprise, not a feature.

export const ANNOUNCE_MS = 60_000
/** The expansion window: from the start of yesterday to this far ahead. */
export const WINDOW_AHEAD_DAYS = 15
/** How often the window is rolled forward (and the provider asked to re-expand). */
export const ROLL_EVERY_MS = 3_600_000
/** The longest range one query may ask the provider to expand. */
export const MAX_QUERY_DAYS = 366
/** How long a query outside the window waits for the provider to re-expand. */
const WIDEN_TIMEOUT_MS = 15_000
/** A meeting revealed by a snapshot up to this long after its start still counts as beginning now. */
const BEGIN_GRACE_MS = 5_000

export type CalendarServiceDeps = {
  provider: CalendarProvider
  bus: EventBus
  logger: Logger
  now?: () => Date
}

type Listener = (m: Meeting) => void

export class CalendarService {
  private readonly d: CalendarServiceDeps
  private readonly now: () => Date
  private meetings: Meeting[] = []
  private calendars: CalendarInfo[] = []
  private state: CalendarState = 'starting'
  private detail: string | null = null
  private updatedAt: string | null = null
  private readonly announced = new Set<string>()
  private readonly begun = new Set<string>()
  private readonly startingListeners = new Set<Listener>()
  private readonly beginListeners = new Set<Listener>()
  private readonly changeListeners = new Set<() => void>()
  private timer: NodeJS.Timeout | null = null
  private rollTimer: NodeJS.Timeout | null = null
  private started = false
  private firstSnapshot = true
  private window: { from: Date; to: Date } | null = null
  private snapshotWaiters: (() => void)[] = []

  constructor(deps: CalendarServiceDeps) {
    this.d = deps
    this.now = deps.now ?? (() => new Date())
  }

  get providerName(): string {
    return this.d.provider.name
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.d.provider.start({
      snapshot: (s) => {
        this.meetings = toMeetings(s.occurrences)
        this.calendars = s.calendars
        this.updatedAt = this.now().toISOString()
        this.onMeetingsChanged()
        for (const w of this.snapshotWaiters.splice(0)) w()
      },
      status: (state, detail) => {
        if (state === this.state && detail === this.detail) return
        this.state = state
        this.detail = detail
        this.d.logger[state === 'unavailable' ? 'warn' : 'info']('calendar state', {
          provider: this.d.provider.name,
          state,
          detail,
        })
        this.publish()
      },
    })
    this.roll()
  }

  async stop(): Promise<void> {
    this.started = false
    if (this.timer) clearTimeout(this.timer)
    if (this.rollTimer) clearTimeout(this.rollTimer)
    this.timer = this.rollTimer = null
    await this.d.provider.stop()
  }

  /** Re-read the calendars now (e.g. after resume from suspend). */
  refresh(): void {
    this.d.provider.refresh()
  }

  private roll(): void {
    const now = this.now()
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + WINDOW_AHEAD_DAYS)
    this.window = { from, to }
    this.d.provider.setWindow(from, to)
    if (this.rollTimer) clearTimeout(this.rollTimer)
    this.rollTimer = setTimeout(() => this.roll(), ROLL_EVERY_MS)
    this.rollTimer.unref()
  }

  // ------------------------------------------------------------------------------- queries

  status(): CalendarStatus {
    return {
      state: this.state,
      provider: this.d.provider.name,
      detail: this.detail,
      calendars: this.calendars,
      updatedAt: this.updatedAt,
    }
  }

  all(): Meeting[] {
    return this.meetings
  }

  get(id: string): Meeting | null {
    return this.meetings.find((m) => m.id === id) ?? null
  }

  /**
   * Meetings overlapping [from, to). A range outside the rolling window is expanded on demand: the
   * window is widened to cover it and the query waits for the provider's next snapshot. (The hourly
   * roll shrinks it back; a later query just widens it again.)
   */
  async list(from: Date, to: Date, includeDeclined = false): Promise<MeetingList> {
    await this.cover(from, to)
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      meetings: inWindow(this.meetings, from, to, includeDeclined),
      calendar: this.status(),
    }
  }

  private async cover(from: Date, to: Date): Promise<void> {
    const w = this.window
    if (!w || !this.d.provider.expands || this.state === 'off') return
    if (from >= w.from && to <= w.to) return
    if (to.getTime() - from.getTime() > MAX_QUERY_DAYS * 86_400_000)
      throw new DaemonError('bad_request', `a meetings query may span at most ${MAX_QUERY_DAYS} days`)
    const wider = { from: from < w.from ? from : w.from, to: to > w.to ? to : w.to }
    this.window = wider
    const got = new Promise<void>((resolve) => {
      this.snapshotWaiters.push(resolve)
      setTimeout(resolve, WIDEN_TIMEOUT_MS).unref()
    })
    this.d.provider.setWindow(wider.from, wider.to)
    await got
  }

  next(): NextMeeting {
    return { ...currentAndNext(this.meetings, this.now()), calendar: this.status() }
  }

  /** Timed meetings from now to the end of tomorrow, in progress first. */
  upcoming(max = 12): Meeting[] {
    const now = this.now()
    return upcoming(this.meetings, now, endOfLocalDay(now, 1), max)
  }

  onStarting(fn: Listener): () => void {
    this.startingListeners.add(fn)
    return () => this.startingListeners.delete(fn)
  }
  onBegin(fn: Listener): () => void {
    this.beginListeners.add(fn)
    return () => this.beginListeners.delete(fn)
  }
  /** Meetings or state changed (for the D-Bus view). Also fires on the minute a meeting starts/ends. */
  onChange(fn: () => void): () => void {
    this.changeListeners.add(fn)
    return () => this.changeListeners.delete(fn)
  }

  // ------------------------------------------------------------------------------- moments

  private publish(): void {
    this.d.bus.ephemeral(null, { type: 'calendar.updated', calendar: this.status() })
    for (const fn of [...this.changeListeners]) safe(() => fn())
  }

  private onMeetingsChanged(): void {
    const now = this.now().getTime()
    const live = new Set(this.meetings.map((m) => m.id))
    for (const id of this.announced) if (!live.has(id)) this.announced.delete(id)
    for (const id of this.begun) if (!live.has(id)) this.begun.delete(id)
    // Meetings already under way when first seen never fire `begin`; with the first snapshot that is
    // everything that has started, later only what started longer ago than the grace period.
    for (const m of this.meetings) {
      const s = Date.parse(m.start)
      if (s <= now - (this.firstSnapshot ? 0 : BEGIN_GRACE_MS)) {
        this.begun.add(m.id)
        this.announced.add(m.id)
      }
    }
    this.firstSnapshot = false
    this.publish()
    this.tick()
  }

  /** Fire every due moment, then sleep until the next one (or a boundary where "current" changes). */
  private tick(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (!this.started) return
    const now = this.now().getTime()
    let wake = Number.POSITIVE_INFINITY
    let boundary = false
    for (const m of this.meetings) {
      if (!isTimedMeeting(m)) continue
      const s = Date.parse(m.start)
      const e = Date.parse(m.end)
      if (!this.announced.has(m.id)) {
        if (s - ANNOUNCE_MS <= now) {
          this.announced.add(m.id)
          for (const fn of [...this.startingListeners]) safe(() => fn(m))
          this.d.bus.ephemeral(null, { type: 'meeting.starting', meeting: m })
        } else wake = Math.min(wake, s - ANNOUNCE_MS)
      }
      if (!this.begun.has(m.id)) {
        if (s <= now) {
          this.begun.add(m.id)
          boundary = true
          for (const fn of [...this.beginListeners]) safe(() => fn(m))
        } else wake = Math.min(wake, s)
      }
      if (e > now) wake = Math.min(wake, e) // "current" changes when it ends
    }
    if (boundary) for (const fn of [...this.changeListeners]) safe(() => fn())
    if (wake === Number.POSITIVE_INFINITY) return
    // Timers are capped so a clock jump (suspend, NTP) is corrected within the hour.
    const delay = Math.max(0, Math.min(wake - now, ROLL_EVERY_MS))
    this.timer = setTimeout(() => {
      this.timer = null
      const ended = this.meetings.some((m) => {
        const e = Date.parse(m.end)
        return e <= this.now().getTime() && e > now
      })
      if (ended) for (const fn of [...this.changeListeners]) safe(() => fn())
      this.tick()
    }, delay)
    this.timer.unref()
  }
}

function safe(fn: () => void): void {
  try {
    fn()
  } catch {
    // a broken listener must not stop the others (or the timer chain)
  }
}
