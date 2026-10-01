import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { recoverWav } from '@gnomeola/capture'
import type { Session, StoredSettings } from '@gnomeola/protocol'
import type { Store } from '@gnomeola/store'
import type { EventBus } from './bus.ts'
import type { DataDirLock } from './data-lock.ts'
import { DaemonError } from './errors.ts'
import type {
  KnownVoice,
  PipelineSink,
  RecordingHandle,
  SpeakerVoices,
  TranscriptionPipeline,
} from './interfaces.ts'
import { isActive, type LifecycleAction, nextStatus } from './lifecycle.ts'
import type { Logger } from './logger.ts'

// Session lifecycle: the state machine in ./lifecycle.ts applied to a live recording. Operations on one
// session are serialised (a second `start` racing the first waits and then gets its 409), and every
// status change is a durable event written through the store.

type Active = {
  handle: RecordingHandle | null
  /** Sink calls are dropped once the recording has been stopped. */
  closed: boolean
  /** Wall-clock ms when the current recording stretch began; null while paused. */
  runningSince: number | null
  accumulatedMs: number
  /** Diarizer cluster key → far-end speaker id, for this recording (M3). */
  speakers: Map<string, string>
}

/** What a SIGTERM'd daemon leaves in a session dir so the next one can resume the recording. */
export type SuspendMarker = {
  /** When capture stopped. */
  at: string
  /** The status the user saw: a paused recording resumes paused. */
  was: 'recording' | 'paused'
  /** Recording time on the session timeline when it stopped. */
  durationMs: number
  reason: string
  pid: number
  /**
   * false: the user's session was ending (logout, shutdown): capture was finalised the same way, but the
   * next daemon closes the recording out instead of turning the microphone back on by itself.
   */
  resume?: boolean
}

export const SUSPEND_FILE = 'suspended.json'
/** The session's `error` while it waits for the next daemon (status `paused`). */
export const SUSPENDED_NOTE = 'the daemon is restarting; this recording resumes when it is back'

/** A recording the previous daemon left mid-meeting that this one will continue (see recover()). */
export type Resumable = {
  id: string
  was: 'recording' | 'paused'
  /** Audio already on disk (the timeline position the new run continues from). */
  offsetMs: number
  /** How long nobody was capturing: a `restart` gap of this length (0 for a paused recording). */
  gapMs: number
  /** When capture stopped (suspend time, or the crashed daemon's last sign of life). */
  stoppedAt: string
  how: 'suspended' | 'crashed'
}

export type RecoveryPlan = {
  /** Closed out as `recovered` (a crash, beyond the resume window). */
  recovered: Session[]
  /** Closed out as `stopped`: suspended for a restart, but the next daemon came too late. */
  closed: Session[]
  /** To continue with continueAfterRestart() once the daemon is listening. */
  resumable: Resumable[]
}

export type RecoverOptions = {
  /** Continue a recording left by the previous daemon if it stopped at most this long ago. 0 = never. */
  resumeWindowMs?: number
  /** When the previous daemon was last alive (its stale lock's heartbeat), after a crash. */
  lastAliveAt?: Date | null
}

const fmtSpan = (ms: number) =>
  ms >= 120_000 ? `${Math.round(ms / 60_000)} min` : `${Math.max(0, Math.round(ms / 1000))} s`

export type SessionManagerDeps = {
  store: Store
  bus: EventBus
  pipeline: TranscriptionPipeline
  logger: Logger
  dataDir: string
  settings: () => StoredSettings
  now?: () => number
  /** Remembered voices to recognise in a new recording (M3; empty unless voiceprints are on). */
  knownVoices?: () => KnownVoice[]
  /** A recording's far-end voices at its end (M3: the speaker service decides what to keep). */
  onVoices?: (sessionId: string, v: SpeakerVoices) => void
}

export class SessionManager {
  private readonly d: SessionManagerDeps
  private readonly now: () => number
  private readonly active = new Map<string, Active>()
  private readonly queues = new Map<string, Promise<unknown>>()
  /** Recordings continued after a restart by this daemon, for /daemon. */
  readonly resumed: { id: string; gapMs: number }[] = []
  private pendingResumes = 0

  constructor(deps: SessionManagerDeps) {
    this.d = deps
    this.now = deps.now ?? Date.now
  }

  sessionDir(id: string): string {
    return join(this.sessionsDir, id)
  }

  get sessionsDir(): string {
    return join(this.d.dataDir, 'sessions')
  }

  get activeCount(): number {
    return this.active.size
  }

  /** Recordings this daemon is capturing (or about to resume): nothing here means a restart is harmless. */
  get busy(): boolean {
    return this.active.size > 0 || this.pendingResumes > 0
  }

  /** The ids of the recordings this daemon is capturing right now. */
  activeIds(): string[] {
    return [...this.active.keys()]
  }

  /** Recording time of a live session: accumulated before the current stretch, and when it began. */
  timing(id: string): { accumulatedMs: number; runningSince: number | null } | null {
    const a = this.active.get(id)
    return a ? { accumulatedMs: a.accumulatedMs, runningSince: a.runningSince } : null
  }

  /** Run `fn` after every earlier operation on the same session has settled. */
  private serial<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(id) ?? Promise.resolve()
    const run = prev.then(fn, fn)
    const tail = run.catch(() => {})
    this.queues.set(id, tail)
    void tail.then(() => {
      if (this.queues.get(id) === tail) this.queues.delete(id)
    })
    return run
  }

  private require(id: string, action: LifecycleAction): Session {
    const s = this.d.store.getSession(id)
    if (!s) throw new DaemonError('not_found', `no session ${id}`)
    if (!nextStatus(s.status, action))
      throw new DaemonError('conflict', `cannot ${action} a session that is ${s.status}`)
    return s
  }

  private elapsed(a: Active): number {
    return a.accumulatedMs + (a.runningSince === null ? 0 : this.now() - a.runningSince)
  }

  /** The far-end voices of a running recording (for naming a speaker mid-meeting). */
  liveVoices(id: string): SpeakerVoices | null {
    return this.active.get(id)?.handle?.voices?.() ?? null
  }

  private sink(id: string, a: Active): PipelineSink {
    const { store, bus, logger } = this.d
    const guard =
      <A extends unknown[], R = void>(what: string, fn: (...args: A) => R) =>
      (...args: A): R | undefined => {
        if (a.closed) return undefined
        try {
          return fn(...args)
        } catch (err) {
          logger.error(`pipeline ${what} rejected`, { sessionId: id, err })
          return undefined
        }
      }
    return {
      level: guard('level', (e) => {
        bus.ephemeral(id, { type: 'audio.level', ...e, rms: clamp01(e.rms), peak: clamp01(e.peak) })
      }),
      partial: guard('partial', (e) => {
        bus.ephemeral(id, { type: 'transcript.partial', ...e })
      }),
      segment: guard('segment', (s) => {
        store.upsertSegment({ ...s, sessionId: id })
      }),
      gap: guard('gap', (g) => {
        store.updateSession(id, (s) => ({
          ...s,
          tracks: s.tracks.map((t) =>
            t.kind === g.track
              ? { ...t, gaps: [...t.gaps, { atMs: g.atMs, durationMs: g.durationMs, reason: g.reason }] }
              : t,
          ),
        }))
        logger.warn('audio gap', { sessionId: id, ...g })
      }),
      error: guard('error', (e) => {
        logger.error('pipeline error', { sessionId: id, message: e.message, fatal: e.fatal })
        if (e.fatal) void this.fail(id, e.message)
      }),
      speaker: (e) => guard('speaker', () => this.speakerFor(id, a, e.key, e.voiceprintId))() ?? null,
      attribute: guard('attribute', (e) => {
        store.attributeSegments(id, e.speakerId, e.segmentIds, 'auto')
      }),
      voices: (v) => {
        // called while stopping, so not guarded by `closed`
        try {
          this.d.onVoices?.(id, v)
        } catch (err) {
          logger.error('pipeline voices rejected', { sessionId: id, err })
        }
      },
    }
  }

  /**
   * The far-end speaker behind a diarizer cluster: created on first sight — named after the voiceprint
   * it was recognised as, when that name is free — and linked later if recognition comes late.
   */
  private speakerFor(id: string, a: Active, key: string, voiceprintId: string | null): string {
    const { store } = this.d
    const vp = voiceprintId ? store.getVoiceprint(voiceprintId) : null
    const free = (label: string) =>
      !store.speakers(id).some((s) => s.label.toLowerCase() === label.toLowerCase())
    const known = a.speakers.get(key)
    if (known) {
      const cur = store.resolveSpeaker(known)
      if (cur && vp && !cur.voiceprintId && !cur.named)
        store.linkVoiceprint(id, cur.id, vp.id, free(vp.name) ? vp.name : undefined)
      return cur?.id ?? known
    }
    const spk = store.createSpeaker(id, {
      ...(vp && free(vp.name) ? { label: vp.name } : {}),
      voiceprintId: vp?.id ?? null,
    })
    a.speakers.set(key, spk.id)
    this.d.logger.info('far-end speaker', { sessionId: id, speakerId: spk.id, recognised: Boolean(vp) })
    return spk.id
  }

  async start(id: string): Promise<Session> {
    return this.serial(id, async () => {
      this.require(id, 'start')
      const dir = this.sessionDir(id)
      mkdirSync(dir, { recursive: true })
      const settings = this.d.settings()
      const a: Active = {
        handle: null,
        closed: false,
        runningSince: null,
        accumulatedMs: 0,
        speakers: new Map(),
      }
      this.active.set(id, a)
      let handle: RecordingHandle
      try {
        handle = await this.d.pipeline.start(
          {
            sessionId: id,
            sessionDir: dir,
            tracks: [
              { kind: 'mic', device: settings.capture.micDevice },
              { kind: 'system', device: settings.capture.systemDevice },
            ],
            settings,
            voices: this.d.knownVoices?.() ?? [],
          },
          this.sink(id, a),
        )
      } catch (err) {
        a.closed = true
        this.active.delete(id)
        const message = err instanceof Error ? err.message : String(err)
        this.d.logger.error('pipeline failed to start', { sessionId: id, err: message })
        this.d.store.updateSession(id, (s) => ({ ...s, error: message }))
        throw err instanceof DaemonError
          ? err
          : new DaemonError('unavailable', `could not start recording: ${message}`)
      }
      a.handle = handle
      a.runningSince = this.now()
      const s = this.d.store.updateSession(id, (s) => ({
        ...s,
        status: 'recording',
        startedAt: new Date(a.runningSince!).toISOString(),
        tracks: handle.tracks,
        error: null,
      }))
      this.d.logger.info('session started', { sessionId: id })
      return s
    })
  }

  async pause(id: string): Promise<Session> {
    return this.serial(id, async () => {
      this.require(id, 'pause')
      const a = this.active.get(id)
      if (!a?.handle) throw new DaemonError('conflict', `session ${id} has no running recording`)
      await a.handle.pause()
      a.accumulatedMs = this.elapsed(a)
      a.runningSince = null
      return this.d.store.updateSession(id, (s) => ({ ...s, status: 'paused', durationMs: a.accumulatedMs }))
    })
  }

  async resume(id: string): Promise<Session> {
    return this.serial(id, async () => {
      this.require(id, 'resume')
      const a = this.active.get(id)
      if (!a?.handle) throw new DaemonError('conflict', `session ${id} has no running recording`)
      await a.handle.resume()
      a.runningSince = this.now()
      return this.d.store.updateSession(id, (s) => ({ ...s, status: 'recording' }))
    })
  }

  async stop(id: string): Promise<Session> {
    return this.serial(id, async () => {
      this.require(id, 'stop')
      return this.finish(id, 'stopped', null)
    })
  }

  /** Stop the pipeline (flushing), then close the session out with `status`. */
  private async finish(id: string, status: 'stopped' | 'failed', error: string | null): Promise<Session> {
    const a = this.active.get(id)
    let err = error
    if (a?.handle) {
      try {
        await a.handle.stop()
      } catch (e) {
        err = `stop failed: ${e instanceof Error ? e.message : String(e)}`
        this.d.logger.error('pipeline stop failed', { sessionId: id, err: e })
      }
    }
    const durationMs = a ? this.elapsed(a) : undefined
    if (a) {
      a.closed = true
      a.runningSince = null
    }
    this.active.delete(id)
    const s = this.d.store.updateSession(id, (s) => ({
      ...s,
      status: err && status === 'stopped' ? 'failed' : status,
      endedAt: new Date(this.now()).toISOString(),
      durationMs: durationMs ?? s.durationMs,
      error: err,
    }))
    this.d.logger.info('session ended', { sessionId: id, status: s.status })
    return s
  }

  private fail(id: string, message: string): Promise<Session | null> {
    return this.serial(id, async () => {
      if (!this.active.has(id)) return null
      return this.finish(id, 'failed', message)
    }).catch((err) => {
      this.d.logger.error('could not mark session failed', { sessionId: id, err })
      return null
    })
  }

  async delete(id: string): Promise<void> {
    return this.serial(id, async () => {
      this.d.store.deleteSession(id, (s) => {
        if (isActive(s.status) || this.active.has(id))
          throw new DaemonError('conflict', `session ${id} is ${s.status}; stop it before deleting`)
      })
      rmSync(this.sessionDir(id), { recursive: true, force: true })
      this.d.logger.info('session deleted', { sessionId: id })
    })
  }

  /**
   * Startup: any session still `recording`/`paused` belongs to a daemon that is gone. Either
   *
   *   - it was suspended for a restart (SIGTERM mid-recording: suspendAll() left a marker), or the daemon
   *     crashed while it was recording, and capture stopped less than `resumeWindowMs` ago: RESUMABLE —
   *     its WAV headers are repaired and it is left as it is, for continueAfterRestart() once we listen;
   *   - suspended, but the next daemon (us) came too late: closed out as `stopped`, ended when capture
   *     stopped, with an `error` that says what happened (a restart, not a crash);
   *   - otherwise (a crash too long ago, or while paused): closed out as `recovered`, ended at the last
   *     moment we know it was alive, with its duration covering every segment we kept.
   *
   * Audio and segments are left exactly as they were.
   *
   * Only ever with the data dir's lock held: "still recording" means "its daemon is gone" only if no
   * other daemon can own this dir. Run by a second daemon, this closed out a meeting that was still
   * being recorded (2026-10-01).
   */
  recover(lock: DataDirLock, o: RecoverOptions = {}): RecoveryPlan {
    if (!lock.held || resolve(lock.dataDir) !== resolve(this.d.dataDir))
      throw new Error(`recover() needs the lock on ${this.d.dataDir}`)
    // a pipeline that cannot continue a recording never gets the chance: close those out right away
    const windowMs = this.d.pipeline.canContinue ? (o.resumeWindowMs ?? 0) : 0
    const now = this.now()
    const plan: RecoveryPlan = { recovered: [], closed: [], resumable: [] }
    for (const s of this.d.store.sessionsWithStatus(['recording', 'paused'])) {
      const marker = this.readSuspend(s.id)
      // The capturing process stopped without (or before) finalising its WAV headers: repair them so the
      // audio up to the last write is playable, and let its real length count towards the duration.
      const { audioMs, lastWriteAt } = this.repairAudio(s)
      const audioEnd = Math.max(s.durationMs, this.d.store.maxSegmentEndMs(s.id), Math.round(audioMs))
      if (marker) {
        const stoppedAt = Date.parse(marker.at)
        const offsetMs = Math.max(audioEnd, marker.durationMs)
        if (marker.resume !== false && now - stoppedAt <= windowMs) {
          plan.resumable.push({
            id: s.id,
            was: marker.was,
            offsetMs,
            gapMs: marker.was === 'recording' ? Math.max(0, now - stoppedAt) : 0,
            stoppedAt: marker.at,
            how: 'suspended',
          })
          continue
        }
        this.clearSuspend(s.id)
        plan.closed.push(
          this.d.store.updateSession(s.id, (cur) => ({
            ...cur,
            status: 'stopped',
            endedAt: marker.at,
            durationMs: offsetMs,
            error:
              marker.resume === false
                ? 'the recording stopped when the session ended (logout or shutdown)'
                : windowMs > 0
                  ? `the recording stopped when the daemon restarted, and the daemon was not back within ${fmtSpan(windowMs)} to resume it`
                  : 'the recording stopped when the daemon restarted',
          })),
        )
        this.d.logger.warn('suspended session closed out', { sessionId: s.id, suspendedAt: marker.at })
        continue
      }
      // a crash: the last sign of life is the newest of the last audio write, the last durable event and
      // the dead daemon's lock heartbeat
      const lastEvent = this.d.store.lastEventAt(s.id)
      const alive = Math.max(
        lastWriteAt ?? 0,
        lastEvent ? Date.parse(lastEvent) : 0,
        o.lastAliveAt?.getTime() ?? 0,
      )
      if (s.status === 'recording' && alive > 0 && now - alive <= windowMs) {
        plan.resumable.push({
          id: s.id,
          was: 'recording',
          offsetMs: audioEnd,
          gapMs: Math.max(0, now - alive),
          stoppedAt: new Date(alive).toISOString(),
          how: 'crashed',
        })
        continue
      }
      const endedAt = lastEvent ?? s.startedAt ?? s.createdAt
      plan.recovered.push(
        this.d.store.updateSession(s.id, (cur) => ({
          ...cur,
          status: 'recovered',
          endedAt,
          durationMs: audioEnd,
          error: `recording interrupted: the daemon exited while this session was ${cur.status}`,
        })),
      )
      this.d.logger.warn('recovered interrupted session', { sessionId: s.id, was: s.status, endedAt })
    }
    this.pendingResumes += plan.resumable.length
    return plan
  }

  /** Repair a session's WAV headers; the longest track's length and the newest write time. */
  private repairAudio(s: Session): { audioMs: number; lastWriteAt: number | null } {
    let audioMs = 0
    let lastWriteAt: number | null = null
    for (const t of s.tracks) {
      if (!t.audioPath || !existsSync(t.audioPath)) continue
      try {
        const st = statSync(t.audioPath)
        lastWriteAt = Math.max(lastWriteAt ?? 0, st.mtimeMs)
        // the fake pipeline leaves empty placeholder files: nothing to repair
        if (st.size === 0) continue
        const r = recoverWav(t.audioPath)
        if (r.status !== 'unrecoverable') audioMs = Math.max(audioMs, r.durationMs)
        this.d.logger.info('recovered audio', { sessionId: s.id, track: t.kind, status: r.status })
      } catch (err) {
        this.d.logger.error('audio recovery failed', { sessionId: s.id, track: t.kind, err })
      }
    }
    return { audioMs, lastWriteAt }
  }

  private suspendPath(id: string): string {
    return join(this.sessionDir(id), SUSPEND_FILE)
  }

  private readSuspend(id: string): SuspendMarker | null {
    try {
      const m = JSON.parse(readFileSync(this.suspendPath(id), 'utf8')) as SuspendMarker
      if (typeof m.at !== 'string' || Number.isNaN(Date.parse(m.at))) return null
      return { ...m, was: m.was === 'paused' ? 'paused' : 'recording', durationMs: Number(m.durationMs) || 0 }
    } catch {
      return null
    }
  }

  private clearSuspend(id: string): void {
    rmSync(this.suspendPath(id), { force: true })
  }

  /**
   * Continue a recording the previous daemon left (recover()'s `resumable`): capture resumes into the
   * same session and WAVs after a `restart` gap of the real length, and the session is `recording`
   * again (or `paused`, if that is how the user left it). If the pipeline cannot continue, the session
   * is closed out at the moment capture stopped, saying why.
   */
  async continueAfterRestart(r: Resumable): Promise<Session | null> {
    try {
      return await this.serial(r.id, async () => {
        const s = this.d.store.getSession(r.id)
        if (!s || !isActive(s.status) || this.active.has(r.id)) return null
        const settings = this.d.settings()
        const a: Active = {
          handle: null,
          closed: false,
          runningSince: null,
          accumulatedMs: r.offsetMs + r.gapMs,
          speakers: new Map(),
        }
        this.active.set(r.id, a)
        let handle: RecordingHandle
        try {
          handle = await this.d.pipeline.start(
            {
              sessionId: r.id,
              sessionDir: this.sessionDir(r.id),
              tracks: [
                { kind: 'mic', device: settings.capture.micDevice },
                { kind: 'system', device: settings.capture.systemDevice },
              ],
              settings,
              voices: this.d.knownVoices?.() ?? [],
              continueAt: { offsetMs: r.offsetMs, gapMs: r.gapMs },
            },
            this.sink(r.id, a),
          )
        } catch (err) {
          a.closed = true
          this.active.delete(r.id)
          this.clearSuspend(r.id)
          const message = err instanceof Error ? err.message : String(err)
          this.d.logger.error('could not resume after restart', { sessionId: r.id, err: message })
          return this.d.store.updateSession(r.id, (cur) => ({
            ...cur,
            status: 'stopped',
            endedAt: r.stoppedAt,
            durationMs: Math.max(cur.durationMs, r.offsetMs),
            error: `the recording stopped when the daemon restarted and could not be resumed: ${message}`,
          }))
        }
        a.handle = handle
        if (r.was === 'paused') await handle.pause()
        else a.runningSince = this.now()
        this.clearSuspend(r.id)
        this.resumed.push({ id: r.id, gapMs: r.gapMs })
        const out = this.d.store.updateSession(r.id, (cur) => ({
          ...cur,
          status: r.was,
          durationMs: a.accumulatedMs,
          error: null,
        }))
        this.d.logger.warn('resumed recording after restart', {
          sessionId: r.id,
          how: r.how,
          gapMs: r.gapMs,
          offsetMs: r.offsetMs,
          status: out.status,
        })
        return out
      })
    } catch (err) {
      this.d.logger.error('resume failed', { sessionId: r.id, err })
      return null
    } finally {
      this.pendingResumes = Math.max(0, this.pendingResumes - 1)
    }
  }

  /**
   * SIGTERM while recording (systemctl restart, logout, shutdown): capture stops and what was captured is
   * flushed, and every live session is left `paused` with a suspend marker instead of being stopped, so
   * the next daemon resumes it (recover() → continueAfterRestart()). The marker and status are written FIRST, so a
   * flush that overruns `flushMs` (or a SIGKILL after it) still leaves a resumable session; the flush
   * itself is bounded so shutdown and logout stay fast.
   */
  async suspendAll(reason: string, flushMs = 6_000, o: { resume?: boolean } = {}): Promise<string[]> {
    const ids = [...this.active.keys()]
    await Promise.all(
      ids.map((id) =>
        this.serial(id, async () => {
          const a = this.active.get(id)
          const cur = this.d.store.getSession(id)
          if (!a || !cur || !isActive(cur.status)) return
          const durationMs = this.elapsed(a)
          const marker: SuspendMarker = {
            at: new Date(this.now()).toISOString(),
            was: cur.status === 'paused' ? 'paused' : 'recording',
            durationMs,
            reason,
            pid: process.pid,
            ...(o.resume === false ? { resume: false } : {}),
          }
          const path = this.suspendPath(id)
          mkdirSync(this.sessionDir(id), { recursive: true })
          writeFileSync(`${path}.tmp`, JSON.stringify(marker))
          renameSync(`${path}.tmp`, path)
          this.d.store.updateSession(id, (s) => ({
            ...s,
            status: 'paused',
            durationMs,
            error: SUSPENDED_NOTE,
          }))
          this.d.logger.info('suspending recording for a restart', { sessionId: id, reason, was: marker.was })
          if (a.handle) {
            let timer: NodeJS.Timeout | undefined
            const flushed = await Promise.race([
              a.handle.stop().then(
                () => true,
                (err) => {
                  this.d.logger.error('pipeline stop failed while suspending', { sessionId: id, err })
                  return true
                },
              ),
              new Promise<false>((r) => {
                timer = setTimeout(() => r(false), flushMs)
              }),
            ])
            clearTimeout(timer)
            if (!flushed)
              this.d.logger.warn('suspend flush overran; the next daemon repairs the audio', {
                sessionId: id,
              })
          }
          a.closed = true
          a.runningSince = null
          this.active.delete(id)
        }).catch((err) => this.d.logger.error('suspend failed', { sessionId: id, err })),
      ),
    )
    return ids
  }

  /** Graceful shutdown: stop every running recording cleanly. */
  async stopAll(): Promise<void> {
    await Promise.all(
      [...this.active.keys()].map((id) =>
        this.serial(id, async () => {
          if (this.active.has(id)) await this.finish(id, 'stopped', null)
        }).catch((err) => this.d.logger.error('stop on shutdown failed', { sessionId: id, err })),
      ),
    )
  }
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)
