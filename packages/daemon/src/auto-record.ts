import type { AnyEvent, AutoRecordSettings, Meeting, Session, StartReason } from '@kacola/protocol'
import type { RecordJudgement } from './auto-record-judge.ts'
import type { EventBus } from './bus.ts'
import { sessionMeeting } from './calendar/meetings.ts'
import type { CalendarService } from './calendar/service.ts'
import type { RecordingControl } from './control.ts'
import type { Logger } from './logger.ts'
import type { MicActivitySource, MicUser } from './mic-activity.ts'
import type { SettingsService } from './settings.ts'

// C-8: the auto-record rules, both off by default (Preferences → Auto-record).
//
//   calendar      when a timed calendar meeting (not declined, not cancelled) starts, record it —
//                 titled and linked like Join, without opening anything. With
//                 `calendarFilter: likely` (the default) only a meeting the user will likely want recorded
//                 (./auto-record-judge.ts), judged when it is announced so recording starts on time; the
//                 verdict goes out as `auto-record.decided` either way, so a skipped one can be recorded.
//   micActivity   when another application starts capturing from a microphone (a call started), record;
//                 when no other application has used the microphone for `micIdleStopMs`, stop — but only
//                 a session this rule started, and only if it is still the one recording.
//
// A rule never interrupts or replaces a recording that is already running. If a calendar meeting is
// in progress when the microphone rule fires, the session is linked to (and named after) it.
//
// A recording made FOR a meeting (the calendar rule's, or Join's) ends with it, whether or not the rule
// is on: once the meeting's end has passed, after `meetingQuietStopMs` with no new words, or
// `meetingOverrunStopMs` past the end however loud the room, or when the next meeting the calendar
// rule records begins. Meetings overrun, so its end alone is not enough; a laptop left recording an
// empty room (or a frozen app sending no audio) all afternoon is worse than a clipped goodbye.

export type AutoRecorderDeps = {
  calendar: CalendarService
  control: RecordingControl
  settings: SettingsService
  bus: EventBus
  logger: Logger
  mic: MicActivitySource
  /** Default 30 s. */
  micIdleStopMs?: number
  /** Default 5 min. */
  meetingQuietStopMs?: number
  /** Default 60 min. */
  meetingOverrunStopMs?: number
  /** How often a meeting's recording is checked for having ended. Default 30 s. */
  meetingEndCheckMs?: number
  /** Smart mode's judgement (absent: every meeting is recorded, as with `calendarFilter: all`). */
  judge?: (m: Meeting) => Promise<RecordJudgement>
}

export class AutoRecorder {
  private readonly d: AutoRecorderDeps
  private rules: AutoRecordSettings
  private micRunning = false
  private micSession: string | null = null
  private idleTimer: NodeJS.Timeout | null = null
  private endTimer: NodeJS.Timeout | null = null
  private readonly heard = new SpeechClock()
  private readonly unsubscribe: (() => void)[] = []
  /** Judgements started when a meeting was announced, by meeting id (with the title they judged). */
  private readonly judged = new Map<string, { title: string; verdict: Promise<RecordJudgement> }>()

  constructor(d: AutoRecorderDeps) {
    this.d = d
    this.rules = d.settings.get().autoRecord
  }

  start(): void {
    this.unsubscribe.push(
      this.d.calendar.onBegin((m) => void this.onMeetingBegins(m)),
      this.d.calendar.onStarting((m) => {
        if (this.smart()) this.judgement(m)
      }),
      this.d.bus.subscribe((e) => {
        if (e.data.type === 'settings.updated') this.apply(e.data.settings.autoRecord)
        if (e.sessionId) this.heard.observe(e.sessionId, e.data)
        if (e.data.type === 'session.upserted') {
          const st = e.data.session.status
          if (st === 'recording' || st === 'paused') return
          this.heard.forget(e.data.session.id)
          if (e.data.session.id === this.micSession) this.forgetMicSession()
        }
      }),
    )
    this.apply(this.rules, true)
    this.endTimer = setInterval(() => void this.stopIfMeetingEnded(), this.d.meetingEndCheckMs ?? 30_000)
    this.endTimer.unref()
  }

  stop(): void {
    for (const u of this.unsubscribe.splice(0)) u()
    if (this.endTimer) clearInterval(this.endTimer)
    this.endTimer = null
    this.stopMic()
  }

  /** The meeting this recording was made for, if it was made for one (and it has ended by `now`). */
  private endedMeeting(s: Session, now: number): { end: number } | null {
    if (!s.meeting || !ENDS_WITH_MEETING.has(this.d.control.reason(s.id))) return null
    // the calendar's copy: the meeting may have been moved or extended since it started
    const end = Date.parse(this.d.calendar.get(s.meeting.id)?.end ?? s.meeting.end)
    return now >= end ? { end } : null
  }

  private async stopIfMeetingEnded(): Promise<void> {
    const s = this.d.control.active()
    const now = Date.now()
    const ended = s && this.endedMeeting(s, now)
    if (!s || !ended) return
    const lastWords = Math.max(this.heard.last(s.id) ?? 0, Date.parse(s.startedAt ?? s.createdAt))
    const quiet = now - lastWords >= (this.d.meetingQuietStopMs ?? 5 * 60_000)
    const overrun = now - ended.end >= (this.d.meetingOverrunStopMs ?? 60 * 60_000)
    if (!quiet && !overrun) return
    await this.stopForMeeting(s, quiet ? 'quiet since it ended' : 'still going long after it ended')
  }

  private async stopForMeeting(s: Session, why: string): Promise<void> {
    try {
      if (await this.d.control.stopByRule(s.id, 'meeting-ended'))
        this.d.logger.info(`auto-record: meeting over (${why}); stopped`, { sessionId: s.id })
    } catch (err) {
      this.d.logger.warn('auto-record: could not stop', { sessionId: s.id, err: String(err) })
    }
  }

  private apply(next: AutoRecordSettings, initial = false): void {
    const prev = this.rules
    this.rules = next
    if (!initial && prev.calendar !== next.calendar)
      this.d.logger.info('auto-record calendar rule', { on: next.calendar })
    if (next.micActivity && !this.micRunning) {
      this.micRunning = true
      this.d.logger.info('auto-record mic rule: watching for other applications using the microphone')
      this.d.mic.start((users) => void this.onMicUsers(users))
    } else if (!next.micActivity && this.micRunning) this.stopMic()
  }

  private stopMic(): void {
    if (!this.micRunning) return
    this.micRunning = false
    this.d.mic.stop()
    this.forgetMicSession()
  }

  private forgetMicSession(): void {
    this.micSession = null
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
  }

  private smart(): boolean {
    return this.rules.calendar && this.rules.calendarFilter !== 'all' && this.d.judge !== undefined
  }

  private judgement(m: Meeting): Promise<RecordJudgement> {
    const cached = this.judged.get(m.id)
    if (cached?.title === m.title) return cached.verdict
    const verdict = this.d.judge!(m)
    this.judged.set(m.id, { title: m.title, verdict })
    // only the next few meetings are ever waiting
    if (this.judged.size > 32) this.judged.delete(this.judged.keys().next().value!)
    return verdict
  }

  private async onMeetingBegins(m: Meeting): Promise<void> {
    if (!this.rules.calendar) return
    const running = this.d.control.active()
    if (running && !this.endedMeeting(running, Date.now())) {
      this.d.logger.info('auto-record: meeting began while already recording; left alone', { meeting: m.id })
      return
    }
    if (this.smart()) {
      const v = await this.judgement(m)
      this.judged.delete(m.id)
      this.d.bus.ephemeral(null, {
        type: 'auto-record.decided',
        meeting: m,
        decision: { record: v.record, p: v.p, provider: v.provider },
      })
      if (!v.record) {
        this.d.logger.info('auto-record: not a meeting the user records; left alone', {
          meeting: m.id,
          p: Number(v.p.toFixed(3)),
          provider: v.provider,
        })
        return
      }
      // the judgement may have taken a moment: someone may have started a recording meanwhile
      const current = this.d.control.active()
      if (current && current.id !== running?.id) return
    }
    if (running) await this.stopForMeeting(running, `"${m.title}" began`)
    try {
      const s = await this.d.control.startNew({ reason: 'calendar', meeting: sessionMeeting(m) })
      this.d.logger.info('auto-record: recording calendar meeting', { sessionId: s.id, meeting: m.id })
    } catch (err) {
      this.d.logger.warn('auto-record: could not start for meeting', { meeting: m.id, err: String(err) })
    }
  }

  private async onMicUsers(users: MicUser[]): Promise<void> {
    if (!this.rules.micActivity) return
    if (users.length) {
      if (this.idleTimer) clearTimeout(this.idleTimer)
      this.idleTimer = null
      if (this.micSession || this.d.control.active()) return
      const current = this.d.calendar.next().current
      try {
        const s = await this.d.control.startNew({
          reason: 'mic-activity',
          title: current ? undefined : `Call (${users[0]!.app})`,
          meeting: current ? sessionMeeting(current) : undefined,
        })
        this.micSession = s.id
        this.d.logger.info('auto-record: another application is using the microphone; recording', {
          sessionId: s.id,
          apps: users.map((u) => u.app),
        })
      } catch (err) {
        this.d.logger.warn('auto-record: could not start on microphone activity', { err: String(err) })
      }
      return
    }
    if (!this.micSession || this.idleTimer) return
    const id = this.micSession
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null
      if (this.micSession !== id) return
      this.d.control.stopByRule(id, 'mic-idle').then(
        (s) => s && this.d.logger.info('auto-record: microphone idle; stopped', { sessionId: id }),
        (err) => this.d.logger.warn('auto-record: could not stop', { sessionId: id, err: String(err) }),
      )
      this.micSession = null
    }, this.d.micIdleStopMs ?? 30_000)
    this.idleTimer.unref()
  }
}

const ENDS_WITH_MEETING = new Set<StartReason>(['calendar', 'join'])

/**
 * When each live recording last heard words: a new segment, or a partial line that changed. A quiet
 * room (or no audio at all) sends neither.
 */
class SpeechClock {
  private readonly at = new Map<string, number>()
  private readonly lines = new Map<string, string>()

  observe(sessionId: string, e: AnyEvent['data']): void {
    if (e.type === 'segment.upserted') {
      if (e.segment.revision === 1) this.at.set(sessionId, Date.now())
    } else if (e.type === 'transcript.partial' && e.text.trim()) {
      const key = `${sessionId}:${e.track}`
      const line = `${e.startMs}:${e.text}`
      if (this.lines.get(key) === line) return
      this.lines.set(key, line)
      this.at.set(sessionId, Date.now())
    }
  }

  last(sessionId: string): number | undefined {
    return this.at.get(sessionId)
  }

  forget(sessionId: string): void {
    this.at.delete(sessionId)
    for (const k of this.lines.keys()) if (k.startsWith(`${sessionId}:`)) this.lines.delete(k)
  }
}
