import type {
  DaemonInfo,
  LiveRecording,
  PendingRestart,
  RestartMode,
  RestartResponse,
  Session,
} from '@kacola/protocol'
import type { Store } from '@kacola/store'
import type { EventBus } from './bus.ts'
import { DaemonError } from './errors.ts'
import type { Logger } from './logger.ts'
import type { SessionManager } from './sessions.ts'

// Restarts that wait for the recording (GET /daemon, POST/DELETE /daemon/restart; `kacola daemon …`;
// SIGHUP, which the systemd unit's ExecReload sends).
//
//   when-idle  the daemon exits (DAEMON_EXIT.RESTART) as soon as nothing is recording or paused — at
//              once if that is already so. Its supervisor starts it again.
//   now        exit straight away. Refused while recording unless `force`, and then the recording is
//              suspended, not stopped: the next daemon resumes it into the same session (sessions.ts).
//
// "Recording" is asked of THIS daemon's live state (what it is capturing, or about to resume) and of the
// database (a session still marked live) together — the 2026-10-01 incident restarted a daemon whose
// database had wrongly been told the meeting was over.

export type RestartHook = (o: { suspend: boolean; by: string }) => void

export type RestartControlDeps = {
  store: Store
  bus: EventBus
  sessions: SessionManager
  logger: Logger
  dataDir: string
  version: string
  startedAt: Date
  /** What actually restarts the process (main.ts: close, then exit 76). null: this daemon cannot. */
  onRestart: RestartHook | null
  supervised: boolean
}

const PRIVATE_TITLE = 'a private recording'

export class RestartControl {
  private readonly d: RestartControlDeps
  private pending: PendingRestart | null = null
  private fired = false
  private unsubscribe: (() => void) | null = null

  constructor(d: RestartControlDeps) {
    this.d = d
  }

  /** What is recording right now: this daemon's captures, plus any session the database calls live. */
  live(): LiveRecording[] {
    const ids = new Set(this.d.sessions.activeIds())
    const out = new Map<string, Session>()
    for (const s of this.d.store.sessionsWithStatus(['recording', 'paused'])) out.set(s.id, s)
    for (const id of ids)
      if (!out.has(id)) {
        const s = this.d.store.getSession(id)
        if (s) out.set(id, s)
      }
    return [...out.values()].map((s) => ({
      id: s.id,
      title: s.private ? PRIVATE_TITLE : s.title,
      status: s.status,
      private: s.private,
      startedAt: s.startedAt,
    }))
  }

  private idle(): boolean {
    return !this.d.sessions.busy && this.live().length === 0
  }

  info(): DaemonInfo {
    return {
      pid: process.pid,
      version: this.d.version,
      dataDir: this.d.dataDir,
      startedAt: this.d.startedAt.toISOString(),
      supervised: this.d.supervised,
      recording: this.live(),
      restart: this.pending,
      resumed: [...this.d.sessions.resumed],
    }
  }

  request(o: { mode: RestartMode; force: boolean; by: string }): RestartResponse {
    if (!this.d.onRestart)
      throw new DaemonError('unavailable', 'this daemon was not started with a way to restart itself')
    const live = this.live()
    if (o.mode === 'now') {
      if (live.length && !o.force) {
        const s = live[0]!
        throw new DaemonError(
          'conflict',
          `recording "${s.title}" (${s.id}): restarting now would interrupt it. Wait for it with ` +
            '--when-idle, or pass --force to suspend it (the next daemon resumes it after a short gap)',
        )
      }
      this.pending = { mode: 'now', requestedAt: new Date().toISOString(), by: o.by }
      this.fire(live.length > 0, o.by)
      return { state: 'restarting', waitingOn: [], supervised: this.d.supervised }
    }
    this.pending = { mode: 'when-idle', requestedAt: new Date().toISOString(), by: o.by }
    if (this.idle()) {
      this.fire(false, o.by)
      return { state: 'restarting', waitingOn: [], supervised: this.d.supervised }
    }
    this.d.logger.info('restart requested; waiting for the recording to finish', {
      by: o.by,
      waitingOn: live.map((s) => s.id),
    })
    this.unsubscribe ??= this.d.bus.subscribe((e) => {
      if (e.seq !== null && e.data.type === 'session.upserted') this.check()
    })
    return { state: 'waiting', waitingOn: live, supervised: this.d.supervised }
  }

  cancel(): { cancelled: boolean } {
    if (!this.pending || this.fired) return { cancelled: false }
    this.d.logger.info('restart cancelled', { requested: this.pending })
    this.pending = null
    this.unsubscribe?.()
    this.unsubscribe = null
    return { cancelled: true }
  }

  /** A session changed: if a when-idle restart is waiting and nothing is live any more, go. */
  private check(): void {
    if (!this.pending || this.fired) return
    // after the store transaction that ended the recording has fully settled
    setImmediate(() => {
      if (this.pending && !this.fired && this.idle()) this.fire(false, this.pending.by)
    })
  }

  private fire(suspend: boolean, by: string): void {
    if (this.fired) return
    this.fired = true
    this.unsubscribe?.()
    this.unsubscribe = null
    this.d.logger.info('restarting', { by, suspend })
    // answer the request first
    setImmediate(() => this.d.onRestart?.({ suspend, by }))
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }
}
