import type { Session, SessionMeeting } from '@gnomeola/protocol'
import type { Store } from '@gnomeola/store'
import { sessionMeeting } from './calendar/meetings.ts'
import type { CalendarService } from './calendar/service.ts'
import type { StartReason } from './dbus/bridge-protocol.ts'
import { DaemonError } from './errors.ts'
import type { Logger } from './logger.ts'
import type { SessionManager } from './sessions.ts'

// M4: "the one recording" — the verbs the desktop surfaces use (the Shell extension over D-Bus, Join
// over HTTP, auto-record). They act on THE active session rather than on ids: there is at most one
// thing recording at a time from the desktop's point of view, and starting a second one is refused
// rather than silently running two captures of the same microphone.

export class RecordingControl {
  private readonly d: {
    store: Store
    sessions: SessionManager
    calendar: CalendarService
    logger: Logger
  }
  private readonly reasons = new Map<string, StartReason>()

  constructor(d: RecordingControl['d']) {
    this.d = d
  }

  /** The live (recording or paused) session — the most recently started if, somehow, there are several. */
  active(): Session | null {
    const live = this.d.store.sessionsWithStatus(['recording', 'paused'])
    if (!live.length) return null
    return live.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))[0]!
  }

  /** Why a session was started; `manual` for anything not started through here. */
  reason(id: string): StartReason {
    return this.reasons.get(id) ?? 'manual'
  }

  async startNew(o: {
    title?: string
    reason: StartReason
    meeting?: SessionMeeting
    private?: boolean
  }): Promise<Session> {
    const running = this.active()
    if (running) throw new DaemonError('conflict', `already recording "${running.title}" (${running.id})`)
    const created = this.d.store.createSession({
      title: o.title?.trim() || o.meeting?.title,
      private: o.private,
      meeting: o.meeting,
    })
    this.reasons.set(created.id, o.reason)
    this.d.logger.info('starting session', {
      sessionId: created.id,
      reason: o.reason,
      meeting: o.meeting?.id,
    })
    return this.d.sessions.start(created.id)
  }

  /** Join a calendar meeting: record it (linked and titled), and hand back its link to open. */
  async join(
    meetingId: string,
    o: { private?: boolean } = {},
  ): Promise<{ session: Session; joinUrl: string | null }> {
    const m = this.d.calendar.get(meetingId)
    if (!m) throw new DaemonError('not_found', `no meeting ${meetingId}`)
    const session = await this.startNew({ reason: 'join', meeting: sessionMeeting(m), private: o.private })
    return { session, joinUrl: m.join?.url ?? null }
  }

  private requireActive(): Session {
    const s = this.active()
    if (!s) throw new DaemonError('conflict', 'nothing is recording')
    return s
  }

  async stopActive(): Promise<Session> {
    return this.d.sessions.stop(this.requireActive().id)
  }
  async pauseActive(): Promise<Session> {
    return this.d.sessions.pause(this.requireActive().id)
  }
  async resumeActive(): Promise<Session> {
    return this.d.sessions.resume(this.requireActive().id)
  }
}
