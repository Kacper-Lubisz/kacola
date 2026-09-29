import { z } from 'zod'

// M4: meetings from the user's calendars (C-1, C-3) and the auto-record rules (C-8).
//
// A Meeting is one *occurrence*: a recurring series expands into one Meeting per instance, each with its
// own id. The daemon reads calendars through a CalendarProvider (Evolution Data Server by default, so
// whatever GNOME Online Accounts / GNOME Calendar shows), keeps them in memory — the calendar is the
// source of truth, not us — and only the link from a recorded session to the meeting it was recorded
// for is durable (Session.meeting).
//
// This file must not import from ./schemas.ts (schemas.ts imports the auto-record settings from here).

const Iso = z.iso.datetime({ offset: true })

/** Which conferencing service a join link belongs to. */
export const MeetingProvider = z.enum(['meet', 'zoom', 'teams', 'webex', 'jitsi', 'whereby', 'other'])
export type MeetingProvider = z.infer<typeof MeetingProvider>

export const JoinLink = z.object({
  /** Normalised https URL, safe to hand to the desktop's URL handler. */
  url: z.string(),
  provider: MeetingProvider,
})
export type JoinLink = z.infer<typeof JoinLink>

/** The user's own answer to the invitation; null when they are not an attendee (their own event). */
export const MeetingResponse = z.enum(['accepted', 'declined', 'tentative', 'needs-action', 'delegated'])
export type MeetingResponse = z.infer<typeof MeetingResponse>

export const Meeting = z.object({
  /** Stable per occurrence: the same instance of the same series keeps its id across restarts. */
  id: z.string(),
  /** iCalendar UID of the event (shared by every occurrence of a series). */
  uid: z.string(),
  /** RECURRENCE-ID of this occurrence as a UTC ISO time, or null for a one-off event. */
  recurrenceId: Iso.nullable(),
  calendar: z.object({ id: z.string(), name: z.string() }),
  title: z.string(),
  /** Absolute instants. For all-day events: local midnight at the start of the first / after the last day. */
  start: Iso,
  end: Iso,
  allDay: z.boolean(),
  /** The event's own time zone (TZID), when it has one. */
  timezone: z.string().nullable(),
  location: z.string().nullable(),
  join: JoinLink.nullable(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']),
  response: MeetingResponse.nullable(),
  organizer: z.string().nullable(),
  attendees: z.int().nonnegative(),
  recurring: z.boolean(),
})
export type Meeting = z.infer<typeof Meeting>

/**
 * `off`: calendar reading is disabled. `starting`: the provider has not delivered its first snapshot.
 * `ok`: meetings are current. `unavailable`: the provider failed (detail says why; EDS missing, …).
 */
export const CalendarState = z.enum(['off', 'starting', 'ok', 'unavailable'])
export type CalendarState = z.infer<typeof CalendarState>

export const CalendarStatus = z.object({
  state: CalendarState,
  /** Which provider is behind the meetings: `eds`, `file`, … */
  provider: z.string(),
  detail: z.string().nullable(),
  calendars: z.array(z.object({ id: z.string(), name: z.string() })),
  /** When the provider last delivered meetings. */
  updatedAt: Iso.nullable(),
})
export type CalendarStatus = z.infer<typeof CalendarStatus>

/** What a session keeps about the meeting it was recorded for — durable, survives the calendar changing. */
export const SessionMeeting = z.object({
  id: z.string(),
  uid: z.string(),
  title: z.string(),
  start: Iso,
  end: Iso,
  join: JoinLink.nullable(),
  calendar: z.string(),
})
export type SessionMeeting = z.infer<typeof SessionMeeting>

// --------------------------------------------------------------------------- auto-record (C-8)

/** Both rules are off by default: nothing records unless the user asked for it. */
export const AutoRecordSettings = z.object({
  /** Start recording when a calendar meeting starts (timed, not declined or cancelled). */
  calendar: z.boolean(),
  /** Start recording when another application starts capturing from a microphone; stop when it ends. */
  micActivity: z.boolean(),
})
export type AutoRecordSettings = z.infer<typeof AutoRecordSettings>
export const DEFAULT_AUTO_RECORD: AutoRecordSettings = { calendar: false, micActivity: false }

// -------------------------------------------------------------------------------- routes' shapes

const qbool = z.union([z.boolean(), z.stringbool()])

export const ListMeetingsQuery = z.object({
  /** ISO time or date; default: now. */
  from: z.string().optional(),
  /** ISO time or date; default: the end of the local day of `from`. */
  to: z.string().optional(),
  /** Declined and cancelled occurrences are hidden unless asked for. */
  includeDeclined: qbool.optional(),
})

export const MeetingList = z.object({
  from: Iso,
  to: Iso,
  meetings: z.array(Meeting),
  calendar: CalendarStatus,
})
export type MeetingList = z.infer<typeof MeetingList>

export const NextMeeting = z.object({
  /** A timed meeting in progress right now (the one that started most recently), if any. */
  current: Meeting.nullable(),
  /** The next timed meeting that has not started yet. */
  next: Meeting.nullable(),
  calendar: CalendarStatus,
})
export type NextMeeting = z.infer<typeof NextMeeting>

export const JoinMeetingBody = z.object({ private: z.boolean().optional() })
