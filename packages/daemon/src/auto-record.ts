import type { AutoRecordSettings, Meeting } from '@kacola/protocol'
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
//                 titled and linked like Join, without opening anything. Never stopped automatically:
//                 meetings overrun, and cutting the end off is worse than a long tail. With
//                 `calendarFilter: likely` (the default) only a meeting the user will likely want recorded
//                 (./auto-record-judge.ts), judged when it is announced so recording starts on time; the
//                 verdict goes out as `auto-record.decided` either way, so a skipped one can be recorded.
//   micActivity   when another application starts capturing from a microphone (a call started), record;
//                 when no other application has used the microphone for `micIdleStopMs`, stop — but only
//                 a session this rule started, and only if it is still the one recording.
//
// A rule never interrupts or replaces a recording that is already running. If a calendar meeting is
// in progress when the microphone rule fires, the session is linked to (and named after) it.

export type AutoRecorderDeps = {
  calendar: CalendarService
  control: RecordingControl
  settings: SettingsService
  bus: EventBus
  logger: Logger
  mic: MicActivitySource
  /** Default 30 s. */
  micIdleStopMs?: number
  /** Smart mode's judgement (absent: every meeting is recorded, as with `calendarFilter: all`). */
  judge?: (m: Meeting) => Promise<RecordJudgement>
}

export class AutoRecorder {
  private readonly d: AutoRecorderDeps
  private rules: AutoRecordSettings
  private micRunning = false
  private micSession: string | null = null
  private idleTimer: NodeJS.Timeout | null = null
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
        if (e.data.type === 'session.upserted' && e.data.session.id === this.micSession) {
          const st = e.data.session.status
          if (st !== 'recording' && st !== 'paused') this.forgetMicSession()
        }
      }),
    )
    this.apply(this.rules, true)
  }

  stop(): void {
    for (const u of this.unsubscribe.splice(0)) u()
    this.stopMic()
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
    if (this.d.control.active()) {
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
      if (this.d.control.active()) return
    }
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
      if (this.micSession !== id || this.d.control.active()?.id !== id) return
      this.d.control.stopActive().then(
        () => this.d.logger.info('auto-record: microphone idle; stopped', { sessionId: id }),
        (err) => this.d.logger.warn('auto-record: could not stop', { sessionId: id, err: String(err) }),
      )
      this.micSession = null
    }, this.d.micIdleStopMs ?? 30_000)
    this.idleTimer.unref()
  }
}
