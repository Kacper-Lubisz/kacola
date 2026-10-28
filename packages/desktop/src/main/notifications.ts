import type { Meeting, StartReason } from '@kacola/protocol'
import { PROVIDER_NAMES } from './tray.ts'

// The macOS notifications main shows (Linux: the top-bar extension notifies), as pure decisions so they
// are unit-tested; index.ts shows them and wires the clicks.
//
//   meeting starting   a minute ahead: Join & Record (opens the link, records it), or Record without a link
//   recording started  a rule (calendar, microphone) started one: click opens it
//   calendar access    kacola may not read the calendars: click opens setup at its Calendar step

export type Notice = { title: string; body: string }

const MINUTE = 60_000

const titleOf = (t: string) => t.trim() || 'Untitled meeting'

const pad2 = (n: number) => String(n).padStart(2, '0')
const clock = (iso: string) => {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * A meeting is about to start: `“Standup” starts in 1 min`, `10:30–11:00 · Zoom`, and a button — Join &
 * Record when it has a link (the click does the same), else Record. Quiet while kacola records it already,
 * and when the calendar rule will record it and there is no link to offer.
 */
export function meetingStartingNotice(i: {
  meeting: Pick<Meeting, 'title' | 'start' | 'end' | 'join'>
  /** Epoch ms. */
  now: number
  /** kacola is recording this very meeting. */
  recordingIt: boolean
  /** The auto-record calendar rule is on: it records the meeting, or says it left it alone. */
  calendarRule: boolean
}): (Notice & { action: 'Join & Record' | 'Record' }) | null {
  const join = i.meeting.join
  if (i.recordingIt || (i.calendarRule && !join)) return null
  const minutes = Math.ceil((Date.parse(i.meeting.start) - i.now) / MINUTE)
  const title = `“${titleOf(i.meeting.title)}”`
  const where = join ? PROVIDER_NAMES[join.provider] : null
  return {
    title: minutes > 0 ? `${title} starts in ${minutes} min` : `${title} is starting`,
    body: [`${clock(i.meeting.start)}–${clock(i.meeting.end)}`, where].filter((x) => x).join(' · '),
    action: join ? 'Join & Record' : 'Record',
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
