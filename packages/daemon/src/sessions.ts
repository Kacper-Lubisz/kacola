import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { recoverWav } from '@gnomeola/capture'
import type { Session, StoredSettings } from '@gnomeola/protocol'
import type { Store } from '@gnomeola/store'
import type { EventBus } from './bus.ts'
import { DaemonError } from './errors.ts'
import type { PipelineSink, RecordingHandle, TranscriptionPipeline } from './interfaces.ts'
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
}

export type SessionManagerDeps = {
  store: Store
  bus: EventBus
  pipeline: TranscriptionPipeline
  logger: Logger
  dataDir: string
  settings: () => StoredSettings
  now?: () => number
}

export class SessionManager {
  private readonly d: SessionManagerDeps
  private readonly now: () => number
  private readonly active = new Map<string, Active>()
  private readonly queues = new Map<string, Promise<unknown>>()

  constructor(deps: SessionManagerDeps) {
    this.d = deps
    this.now = deps.now ?? Date.now
  }

  sessionDir(id: string): string {
    return join(this.d.dataDir, 'sessions', id)
  }

  get activeCount(): number {
    return this.active.size
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

  private sink(id: string, a: Active): PipelineSink {
    const { store, bus, logger } = this.d
    const guard =
      <A extends unknown[]>(what: string, fn: (...args: A) => void) =>
      (...args: A) => {
        if (a.closed) return
        try {
          fn(...args)
        } catch (err) {
          logger.error(`pipeline ${what} rejected`, { sessionId: id, err })
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
    }
  }

  async start(id: string): Promise<Session> {
    return this.serial(id, async () => {
      this.require(id, 'start')
      const dir = this.sessionDir(id)
      mkdirSync(dir, { recursive: true })
      const settings = this.d.settings()
      const a: Active = { handle: null, closed: false, runningSince: null, accumulatedMs: 0 }
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
   * Startup: any session still `recording`/`paused` belongs to a daemon that died. Close it out as
   * `recovered`, ended at the last moment we know it was alive, with its duration covering every
   * segment we kept. Its audio and segments are left exactly as they were.
   */
  recover(): Session[] {
    const out: Session[] = []
    for (const s of this.d.store.sessionsWithStatus(['recording', 'paused'])) {
      const endedAt = this.d.store.lastEventAt(s.id) ?? s.startedAt ?? s.createdAt
      // The capturing process died without finalising its WAV headers: repair them so the audio up to the
      // last flush is playable, and let its real length count towards the session's duration.
      let audioMs = 0
      for (const t of s.tracks) {
        if (!t.audioPath || !existsSync(t.audioPath)) continue
        try {
          const r = recoverWav(t.audioPath)
          if (r.status !== 'unrecoverable') audioMs = Math.max(audioMs, r.durationMs)
          this.d.logger.info('recovered audio', { sessionId: s.id, track: t.kind, status: r.status })
        } catch (err) {
          this.d.logger.error('audio recovery failed', { sessionId: s.id, track: t.kind, err })
        }
      }
      const durationMs = Math.max(s.durationMs, this.d.store.maxSegmentEndMs(s.id), Math.round(audioMs))
      out.push(
        this.d.store.updateSession(s.id, (cur) => ({
          ...cur,
          status: 'recovered',
          endedAt,
          durationMs,
          error: `recording interrupted: the daemon exited while this session was ${cur.status}`,
        })),
      )
      this.d.logger.warn('recovered interrupted session', { sessionId: s.id, was: s.status, endedAt })
    }
    return out
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
