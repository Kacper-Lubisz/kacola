import { z } from 'zod'
import { Iso, SessionStatus } from './schemas.ts'

// The daemon's own lifecycle, as clients see it: who owns the data dir, what is recording right now (the
// daemon's live view, not the database's), and restarts that wait for the recording to finish.
//
//   kacola daemon status                      → GET  /daemon
//   kacola daemon restart [--when-idle]       → POST /daemon/restart {mode:'when-idle'}
//   kacola daemon restart --now [--force]     → POST /daemon/restart {mode:'now', force}
//   kacola daemon restart --cancel            → DELETE /daemon/restart
//
// A restart is the daemon exiting with DAEMON_EXIT.RESTART for its supervisor (systemd's unit carries
// RestartForceExitStatus=76; the desktop window's supervisor restarts it at once) to start it again.
// `when-idle` exits once nothing is recording or paused; `now` exits straight away, suspending a live
// recording so the next daemon resumes it (and is refused while recording unless `force`).

/** Process exit codes with a meaning for supervisors. */
export const DAEMON_EXIT = {
  /** Another daemon owns the data dir (see the daemon's data-lock.ts). Not a crash: do not hammer. */
  LOCKED: 75,
  /** A requested restart: start me again now. */
  RESTART: 76,
} as const

/** How long a suspended recording may wait for the next daemon before it is closed out (default). */
export const DEFAULT_RESUME_WINDOW_MS = 120_000

export const LiveRecording = z.object({
  id: z.string(),
  /** A private session's title is never sent here: it reads "a private recording". */
  title: z.string(),
  status: SessionStatus,
  private: z.boolean(),
  startedAt: Iso.nullable(),
})
export type LiveRecording = z.infer<typeof LiveRecording>

export const RestartMode = z.enum(['when-idle', 'now'])
export type RestartMode = z.infer<typeof RestartMode>

export const PendingRestart = z.object({
  mode: RestartMode,
  requestedAt: Iso,
  /** Who asked (cli, systemd reload, desktop, install). Free text, for the log and the UI. */
  by: z.string(),
})
export type PendingRestart = z.infer<typeof PendingRestart>

export const DaemonInfo = z.object({
  pid: z.int(),
  version: z.string(),
  dataDir: z.string(),
  startedAt: Iso,
  /** Under a supervisor that starts it again after a restart exit (systemd, the desktop window). */
  supervised: z.boolean(),
  /** What this daemon is capturing right now (its in-memory recordings, recording or paused). */
  recording: z.array(LiveRecording),
  restart: PendingRestart.nullable(),
  /** Recordings this daemon resumed after the previous one stopped mid-meeting (since it started). */
  resumed: z.array(z.object({ id: z.string(), gapMs: z.int().nonnegative() })),
})
export type DaemonInfo = z.infer<typeof DaemonInfo>

export const RestartBody = z.object({
  mode: RestartMode.default('when-idle'),
  /** `now` while recording: suspend the recording (it resumes in the next daemon) instead of refusing. */
  force: z.boolean().default(false),
  by: z.string().max(80).default('api'),
})

export const RestartResponse = z.object({
  /** `restarting`: exiting now. `waiting`: will exit once the recordings listed have finished. */
  state: z.enum(['restarting', 'waiting']),
  waitingOn: z.array(LiveRecording),
  supervised: z.boolean(),
})
export type RestartResponse = z.infer<typeof RestartResponse>

export const daemonControlRoutes = {
  daemonInfo: { method: 'GET', path: '/daemon', response: DaemonInfo },
  requestRestart: { method: 'POST', path: '/daemon/restart', body: RestartBody, response: RestartResponse },
  cancelRestart: {
    method: 'DELETE',
    path: '/daemon/restart',
    response: z.object({ cancelled: z.boolean() }),
  },
} as const
