import type { Meeting, StartReason } from '@kacola/protocol'

// The macOS notifications main shows (Linux: the top-bar extension notifies), as pure decisions so they
// are unit-tested; index.ts shows them and wires the clicks.
//
//   meeting starting   a minute ahead, when no rule will record it: click records it (Join, link unopened)
//   recording started  a rule (calendar, microphone) started one: click opens it
//   calendar access    kacola may not read the calendars: click opens setup at its Calendar step

export type Notice = { title: string; body: string }

const MINUTE = 60_000

const titleOf = (t: string) => t.trim() || 'Untitled meeting'

export function meetingStartingNotice(i: {
  meeting: Pick<Meeting, 'title' | 'start'>
  /** Epoch ms. */
  now: number
  recording: boolean
  /** The auto-record calendar rule is on: it records the meeting, or says it left it alone. */
  calendarRule: boolean
}): Notice | null {
  if (i.recording || i.calendarRule) return null
  const minutes = Math.ceil((Date.parse(i.meeting.start) - i.now) / MINUTE)
  const title = `“${titleOf(i.meeting.title)}”`
  return {
    title: minutes > 0 ? `${title} starts in ${minutes} min` : `${title} is starting`,
    body: 'Click to record it with kacola.',
  }
}

export function recordingStartedNotice(i: {
  session: { title: string; private: boolean }
  reason: StartReason
}): Notice | null {
  if (i.reason !== 'calendar' && i.reason !== 'mic-activity') return null
  const title = i.session.private ? 'Private meeting' : titleOf(i.session.title)
  return { title: `Recording “${title}”`, body: 'kacola started recording automatically. Click to open.' }
}

export const CALENDAR_ACCESS_NOTICE: Notice = {
  title: 'kacola can’t see your calendar',
  body: 'Click to allow access.',
}

/**
 * When to suggest allowing calendar access: the first time it is seen missing after launch, and again
 * each time it goes missing after being there — not on every check while it stays missing.
 */
export class CalendarAccessWatch {
  private last: boolean | null = null

  /** The latest answer; true when this is the moment to notify. */
  observe(missing: boolean): boolean {
    const notify = missing && this.last !== true
    this.last = missing
    return notify
  }

  get missing(): boolean {
    return this.last === true
  }
}
