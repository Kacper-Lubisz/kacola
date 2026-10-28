import { describe, expect, it } from 'vitest'
import {
  CalendarAccessWatch,
  meetingStartingNotice,
  recordingStartedNotice,
} from '../src/main/notifications.ts'
import { calendarAccessMissing } from '../src/shared/bridge.ts'

const START = Date.parse('2026-10-28T10:00:00.000Z')
const meeting = {
  title: 'Standup',
  start: new Date(START).toISOString(),
  end: new Date(START + 30 * 60_000).toISOString(),
  join: { url: 'https://meet.google.com/abc-defg-hij', provider: 'meet' as const },
}
// local wall clock, as the notification shows it
const hhmm = (ms: number) => new Date(ms).toTimeString().slice(0, 5)

describe('the meeting-starting notification', () => {
  const base = { meeting, now: START - 60_000, recordingIt: false, calendarRule: false }

  it('a meeting with a link: Join & Record, its times and where it is', () => {
    expect(meetingStartingNotice(base)).toEqual({
      title: '“Standup” starts in 1 min',
      body: `${hhmm(START)}–${hhmm(START + 30 * 60_000)} · Google Meet`,
      action: 'Join & Record',
    })
    expect(meetingStartingNotice({ ...base, now: START - 150_000 })?.title).toBe('“Standup” starts in 3 min')
  })
  it('without a link: Record', () => {
    const n = meetingStartingNotice({ ...base, meeting: { ...meeting, join: null } })
    expect(n).toMatchObject({ action: 'Record', body: `${hhmm(START)}–${hhmm(START + 30 * 60_000)}` })
  })
  it('says “is starting” once its start has come; an empty title is an untitled meeting', () => {
    expect(meetingStartingNotice({ ...base, now: START })?.title).toBe('“Standup” is starting')
    expect(
      meetingStartingNotice({ ...base, meeting: { ...meeting, title: ' ' }, now: START + 5000 })?.title,
    ).toBe('“Untitled meeting” is starting')
  })
  it('with the calendar rule on, still offers the link (Join & Record starts it on the spot)', () => {
    expect(meetingStartingNotice({ ...base, calendarRule: true })?.action).toBe('Join & Record')
    expect(
      meetingStartingNotice({ ...base, calendarRule: true, meeting: { ...meeting, join: null } }),
    ).toBeNull()
  })
  it('quiet while kacola records this very meeting; another recording (one that ran over) does not count', () => {
    expect(meetingStartingNotice({ ...base, recordingIt: true })).toBeNull()
  })
})

describe('the recording-started notification', () => {
  const session = { title: 'Standup', private: false }

  it('only for a recording a rule started', () => {
    const n = { title: 'Recording “Standup”', body: 'kacola started recording automatically. Click to open.' }
    expect(recordingStartedNotice({ session, reason: 'calendar' })).toEqual(n)
    expect(recordingStartedNotice({ session, reason: 'mic-activity' })).toEqual(n)
    expect(recordingStartedNotice({ session, reason: 'manual' })).toBeNull()
    expect(recordingStartedNotice({ session, reason: 'join' })).toBeNull()
  })
  it('a private meeting stays private', () => {
    expect(
      recordingStartedNotice({ session: { title: 'Secret', private: true }, reason: 'calendar' })?.title,
    ).toBe('Recording “Private meeting”')
  })
})

describe('calendar access', () => {
  it('is missing when never asked or refused; restricted (a profile) and Linux are not the user’s to fix', () => {
    expect(calendarAccessMissing('not-determined')).toBe(true)
    expect(calendarAccessMissing('denied')).toBe(true)
    for (const s of ['granted', 'restricted', 'unavailable', 'not-needed', undefined] as const)
      expect(calendarAccessMissing(s)).toBe(false)
  })
  it('suggests it once per launch, and again each time it goes missing', () => {
    const w = new CalendarAccessWatch()
    expect([true, true, true].map((m) => w.observe(m))).toEqual([true, false, false])
    expect(w.missing).toBe(true)
    expect([false, false, true, true].map((m) => w.observe(m))).toEqual([false, false, true, false])
  })
  it('never while it is there', () => {
    const w = new CalendarAccessWatch()
    expect(w.observe(false)).toBe(false)
    expect(w.missing).toBe(false)
  })
})
