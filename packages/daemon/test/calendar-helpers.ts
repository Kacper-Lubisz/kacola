import type { RawOccurrence } from '../src/calendar/agent-protocol.ts'

// Building blocks for calendar tests: a RawOccurrence as cal-agent would report it, with defaults.

export function occ(o: Partial<RawOccurrence> & { start: string; end: string }): RawOccurrence {
  return {
    sourceUid: 'cal-work',
    calendarName: 'Work',
    uid: `${o.summary ?? 'event'}-${o.start}@example.com`,
    recurrenceId: null,
    summary: 'Event',
    description: '',
    location: '',
    url: '',
    allDay: false,
    startDate: null,
    endDate: null,
    timezone: null,
    status: '',
    myPartstat: null,
    organizer: null,
    attendees: 0,
    recurring: false,
    xprops: {},
    ...o,
  }
}

/** An ISO instant `min` minutes from `base`. */
export const at = (base: number, min: number) => new Date(base + min * 60_000).toISOString()
