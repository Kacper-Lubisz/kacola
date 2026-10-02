import type { Session } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import {
  displayTitle,
  escapeMarkup,
  formatClockTime,
  formatDuration,
  formatRelativeTime,
  isDefaultTitle,
  sessionSubtitle,
  statusLabel,
  statusSummary,
} from '../src/format.ts'

// Local-time constructors on purpose: the calendar words are local-time concepts.
const at = (y: number, mo: number, d: number, h = 12, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s)
const iso = (d: Date) => d.toISOString()

describe('formatRelativeTime', () => {
  const now = at(2026, 9, 28, 15, 0) // a Monday

  it('reads recent times as minutes and hours', () => {
    expect(formatRelativeTime(iso(at(2026, 9, 28, 14, 59, 30)), now)).toBe('just now')
    expect(formatRelativeTime(iso(at(2026, 9, 28, 14, 55)), now)).toBe('5 min ago')
    expect(formatRelativeTime(iso(at(2026, 9, 28, 14, 0, 1)), now)).toBe('59 min ago')
    expect(formatRelativeTime(iso(at(2026, 9, 28, 12, 0)), now)).toBe('3 h ago')
    expect(formatRelativeTime(iso(at(2026, 9, 28, 0, 0)), now)).toBe('15 h ago')
  })

  it('uses calendar words once the day changes', () => {
    expect(formatRelativeTime(iso(at(2026, 9, 27, 23, 59)), now)).toBe('Yesterday')
    expect(formatRelativeTime(iso(at(2026, 9, 27, 0, 0)), now)).toBe('Yesterday')
    expect(formatRelativeTime(iso(at(2026, 9, 26, 12)), now)).toBe('Saturday')
    expect(formatRelativeTime(iso(at(2026, 9, 22, 12)), now)).toBe('Tuesday')
    expect(formatRelativeTime(iso(at(2026, 9, 21, 12)), now)).toBe('21 Sep')
    expect(formatRelativeTime(iso(at(2025, 12, 31, 12)), now)).toBe('31 Dec 2025')
  })

  it('never renders the future or garbage as something alarming', () => {
    expect(formatRelativeTime(iso(at(2026, 9, 28, 15, 5)), now)).toBe('just now')
    expect(formatRelativeTime('not a date', now)).toBe('')
  })
})

describe('formatClockTime', () => {
  const now = at(2026, 9, 28, 15, 0)
  it('shows the time today, the date otherwise', () => {
    expect(formatClockTime(iso(at(2026, 9, 28, 9, 5)), now)).toBe('09:05')
    expect(formatClockTime(iso(at(2026, 3, 12, 14, 5)), now)).toBe('12 Mar, 14:05')
    expect(formatClockTime(iso(at(2024, 3, 12, 14, 5)), now)).toBe('12 Mar 2024, 14:05')
    expect(formatClockTime('nope', now)).toBe('')
  })
})

describe('formatDuration', () => {
  it('reads as a stopwatch', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(999)).toBe('0:00')
    expect(formatDuration(7_000)).toBe('0:07')
    expect(formatDuration(754_000)).toBe('12:34')
    expect(formatDuration(3_723_000)).toBe('1:02:03')
    expect(formatDuration(36_000_000)).toBe('10:00:00')
  })
  it('clamps nonsense to zero', () => {
    expect(formatDuration(-5)).toBe('0:00')
    expect(formatDuration(Number.NaN)).toBe('0:00')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00')
  })
})

const session = (over: Partial<Session> = {}): Session => ({
  id: 'ses_1',
  title: 'Standup',
  createdAt: '2026-09-28T10:00:00.000Z',
  startedAt: '2026-09-28T10:00:00.000Z',
  endedAt: null,
  status: 'recording',
  private: false,
  durationMs: 192_000,
  tracks: [],
  error: null,
  ...over,
})

describe('status text', () => {
  it('labels every status', () => {
    for (const s of ['idle', 'recording', 'paused', 'stopped', 'recovered', 'failed'] as const) {
      expect(statusLabel(s)).toMatch(/^[A-Z][a-z ]+$/)
    }
    expect(statusLabel('stopped')).toBe('Finished')
  })
  it('summarises with the duration except before starting', () => {
    const at = (iso: string) => new Date(iso)
    // while recording the clock runs from startedAt (the daemon updates durationMs only on stop/pause)
    expect(statusSummary(session(), at('2026-09-28T10:03:12.000Z'))).toBe('Recording · 3:12')
    expect(statusSummary(session(), at('2026-09-28T10:07:00.000Z'))).toBe('Recording · 7:00')
    // never behind what the daemon reported, and paused sessions do not tick
    expect(statusSummary(session(), at('2026-09-28T10:00:01.000Z'))).toBe('Recording · 3:12')
    expect(statusSummary(session({ status: 'paused' }), at('2026-09-28T11:00:00.000Z'))).toBe('Paused · 3:12')
    expect(statusSummary(session({ status: 'stopped', durationMs: 2_700_000 }))).toBe('Finished · 45:00')
    expect(statusSummary(session({ status: 'idle', durationMs: 0 }))).toBe('Not started')
  })
  it('builds the row subtitle from the start time, falling back to creation', () => {
    const now = new Date('2026-09-28T10:05:00.000Z')
    expect(sessionSubtitle(session(), now)).toBe('5 min ago · Recording · 5:00')
    expect(sessionSubtitle(session({ startedAt: null, status: 'idle' }), now)).toBe('5 min ago · Not started')
  })
})

describe('text safety', () => {
  it('never shows a blank title', () => {
    expect(displayTitle({ title: '' })).toBe('Untitled meeting')
    expect(displayTitle({ title: '   ' })).toBe('Untitled meeting')
    expect(displayTitle({ title: 'Q&A <draft>' })).toBe('Q&A <draft>')
  })
  it('reads the store’s stand-in title (UTC wall clock) as untitled, but only for its own minute', () => {
    const createdAt = '2026-10-01T16:02:34.856Z'
    expect(displayTitle({ title: 'Meeting 2026-10-01 16:02', createdAt })).toBe('Untitled meeting')
    expect(displayTitle({ title: 'Meeting 2026-10-01 16:02' })).toBe('Untitled meeting')
    expect(isDefaultTitle({ title: 'Meeting 2026-10-01 16:02', createdAt })).toBe(true)
    // someone named it that, on another day: theirs to keep
    expect(displayTitle({ title: 'Meeting 2026-10-01 16:02', createdAt: '2026-10-05T09:00:00.000Z' })).toBe(
      'Meeting 2026-10-01 16:02',
    )
    expect(displayTitle({ title: 'Meeting 2026-10-01 16:02 with Ana', createdAt })).toBe(
      'Meeting 2026-10-01 16:02 with Ana',
    )
    expect(displayTitle({ title: 'Meeting', createdAt })).toBe('Meeting')
  })
  it('escapes Pango markup metacharacters', () => {
    expect(escapeMarkup(`Tom & Jerry's <b>"show"</b>`)).toBe(
      'Tom &amp; Jerry&#39;s &lt;b&gt;&quot;show&quot;&lt;/b&gt;',
    )
  })
})
