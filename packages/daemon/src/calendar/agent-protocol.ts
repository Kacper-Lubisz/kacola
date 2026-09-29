import { z } from 'zod'

// C-2: the line protocol between gnomeolad and `cal-agent` (packages/daemon/gjs/cal-agent.js), a GJS
// helper that reads Evolution Data Server through ECal-2.0. One JSON object per line, both directions.
//
// daemon → agent (stdin)
//   {"type":"window","from":ISO,"to":ISO}   the range to expand recurrences over; replaces the previous
//                                           one and triggers a fresh snapshot. Sent once at start and
//                                           whenever the window rolls.
//   {"type":"refresh"}                     re-read everything now (e.g. after resume from suspend).
//
// agent → daemon (stdout)
//   hello      once, first: protocol version, so a stale helper is refused rather than misread.
//   snapshot   EVERY occurrence in the window across every enabled calendar, replacing the last one.
//              Sent after the first window message and again (debounced) after any change: an event
//              added/modified/removed through a client view, or a calendar source added/removed/enabled.
//   error      something failed; fatal ones are followed by exit and the daemon restarts the agent.
//   log        diagnostics for the daemon's log.
//
// The agent does no interpretation beyond what only EDS can do (recurrence expansion, time zones, which
// attendee is "me"): join-link extraction, filtering and "next meeting" live in TypeScript, unit-tested.

export const CAL_AGENT_PROTOCOL = 1

const Iso = z.iso.datetime({ offset: true })

export const RawOccurrence = z.object({
  /** ESource UID of the calendar. */
  sourceUid: z.string(),
  calendarName: z.string(),
  uid: z.string(),
  /** RECURRENCE-ID as a UTC ISO instant for an instance of a series (or a detached exception), else null. */
  recurrenceId: Iso.nullable(),
  summary: z.string(),
  description: z.string(),
  location: z.string(),
  /** The iCalendar URL property. */
  url: z.string(),
  /**
   * Timed events: absolute instants (UTC, `Z`). All-day events: `allDay: true`, and `startDate` /
   * `endDate` (exclusive) as local calendar dates `YYYY-MM-DD` — `start`/`end` are then ignored.
   */
  start: Iso,
  end: Iso,
  allDay: z.boolean(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  /** TZID of DTSTART when it has one (e.g. `Europe/Warsaw`), else null (UTC or floating). */
  timezone: z.string().nullable(),
  /** iCalendar STATUS, upper-case, or '' when absent. */
  status: z.string(),
  /** The user's PARTSTAT, upper-case (ACCEPTED, DECLINED, TENTATIVE, NEEDS-ACTION, DELEGATED), or null
   *  when no attendee is the user (their own event, or no attendees). */
  myPartstat: z.string().nullable(),
  organizer: z.string().nullable(),
  attendees: z.int().nonnegative(),
  /** Whether the event has an RRULE/RDATE (or is an instance of one). */
  recurring: z.boolean(),
  /** X- properties that carry conference links, name → value (X-GOOGLE-CONFERENCE,
   *  X-MICROSOFT-SKYPETEAMSMEETINGURL, X-MICROSOFT-ONLINEMEETINGCONFLINK, …). */
  xprops: z.record(z.string(), z.string()),
})
export type RawOccurrence = z.infer<typeof RawOccurrence>

export const AgentMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), protocol: z.int(), gjs: z.string().optional() }),
  z.object({
    type: z.literal('snapshot'),
    from: Iso,
    to: Iso,
    calendars: z.array(z.object({ id: z.string(), name: z.string() })),
    occurrences: z.array(RawOccurrence),
  }),
  z.object({ type: z.literal('error'), message: z.string(), fatal: z.boolean() }),
  z.object({ type: z.literal('log'), level: z.enum(['debug', 'info', 'warn']), message: z.string() }),
])
export type AgentMessage = z.infer<typeof AgentMessage>

export type DaemonToAgent = { type: 'window'; from: string; to: string } | { type: 'refresh' }
