import type { Session, SessionStatus, TrackKind } from '@kacola/protocol'

// The meeting page's pure logic (unit-tested in test/day.test.ts): which phase a meeting is in, who
// started its recording, and whether capture looks broken. No React, no DOM.

/**
 * A meeting is one page that moves through three phases:
 *
 *   prep      no recording yet (a calendar meeting's agenda, or a session created but not started)
 *   live      recording or paused
 *   outcome   the recording ended (stopped, recovered after a crash, or failed)
 */
export type Phase = 'prep' | 'live' | 'outcome'

const LIVE: ReadonlySet<SessionStatus> = new Set(['recording', 'paused'])
const ENDED: ReadonlySet<SessionStatus> = new Set(['stopped', 'recovered', 'failed'])

export function meetingPhase(session: Pick<Session, 'status'> | null | undefined): Phase {
  if (!session) return 'prep'
  if (LIVE.has(session.status)) return 'live'
  if (ENDED.has(session.status)) return 'outcome'
  return 'prep'
}

/** Who started a recording, as far as the window can tell. `null`: unknown, so say nothing. */
export type StartedBy = 'you' | 'calendar' | 'mic' | null

/**
 * The daemon does not record who pressed Record, so this is inferred, and only claimed when the
 * evidence is clear:
 *   - this window started it (Record, Join and record): you;
 *   - the microphone rule names its sessions "Call (<app>)" (daemon auto-record.ts): the mic rule;
 *   - the calendar rule is on, the session is linked to a meeting, and it started within two minutes
 *     of the meeting's start: the calendar.
 */
export function startedBy(
  session: Pick<Session, 'id' | 'title' | 'startedAt' | 'meeting'>,
  opts: { startedHere: ReadonlySet<string>; calendarRule: boolean },
): StartedBy {
  if (opts.startedHere.has(session.id)) return 'you'
  if (/^Call \(.+\)$/.test(session.title)) return 'mic'
  if (opts.calendarRule && session.meeting && session.startedAt) {
    const gap = Math.abs(Date.parse(session.startedAt) - Date.parse(session.meeting.start))
    if (Number.isFinite(gap) && gap <= 2 * 60_000) return 'calendar'
  }
  return null
}

/** What the window has heard from one capture track: the last level event, and the last real sound. */
export type TrackHeard = { lastEventAt: number | null; lastSoundAt: number | null }

/** Below this RMS a track is digital silence: a muted or disconnected device, not a quiet room. */
export const SILENCE_RMS = 0.0005
/** How long a track may be silent (or send nothing) while recording before the window says so. */
export const SILENT_FOR_MS = 45_000

/**
 * "Can't hear you" / "can't hear them": only when capture looks broken — a track that has sent no level
 * at all, or only digital silence, for SILENT_FOR_MS of recording. A quiet room still has noise above
 * SILENCE_RMS, so a person simply listening never trips it. Nothing while paused.
 */
export function captureWarning(
  heard: Partial<Record<TrackKind, TrackHeard>>,
  tracks: readonly TrackKind[],
  recordingSince: number | null,
  now: number,
): TrackKind[] {
  if (recordingSince === null || now - recordingSince < SILENT_FOR_MS) return []
  const broken: TrackKind[] = []
  for (const t of tracks) {
    const h = heard[t]
    const last = h?.lastSoundAt ?? null
    const since = last === null ? recordingSince : Math.max(last, recordingSince)
    if (now - since >= SILENT_FOR_MS) broken.push(t)
  }
  return broken
}
