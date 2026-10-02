import type {
  AgendaItem,
  AgendaSummary,
  AgendaView,
  Meeting,
  Moment as SearchMoment,
  Session,
  Suggestion,
} from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import {
  agendaOf,
  buildDay,
  countdown,
  dayLabel,
  dedupeMeetings,
  durationLabel,
  isShortRecording,
  readiness,
} from '../src/renderer/features/home/day.ts'
import {
  looksLikeQuestion,
  markText,
  searchTerms,
  snippetParts,
  toMoments,
} from '../src/renderer/features/home/search.ts'
import {
  buildOutcome,
  notesSection,
  ownerLabel,
  summaryMarkdown,
} from '../src/renderer/features/meeting/outcome.ts'
import {
  captureWarning,
  meetingPhase,
  SILENT_FOR_MS,
  startedBy,
} from '../src/renderer/features/meeting/phase.ts'
import { currentItem, pickSuggestion } from '../src/renderer/features/meeting/suggestion-slot.ts'
import { session } from './helpers.ts'

// The Day redesign's pure logic: the meeting page's phase, who started a recording, the capture
// warning, the one suggestion slot, home's day and its search moments.

const T = '2026-03-12T10:00:00.000Z'
// local-time anchors (the suite runs in whatever TZ the machine has; day maths is local)
const at = (h: number, m = 0, dayOffset = 0) => new Date(2026, 2, 12 + dayOffset, h, m).getTime()
const iso = (t: number) => new Date(t).toISOString()

const item = (id: string, order: number, over: Partial<AgendaItem> = {}): AgendaItem => ({
  id,
  agendaId: 'agd_1',
  text: id,
  kind: 'topic',
  owner: null,
  timeboxMin: null,
  order,
  status: 'open',
  evidence: [],
  outcome: null,
  changedBy: 'user',
  createdBy: 'user',
  carriedFrom: null,
  createdAt: T,
  updatedAt: T,
  ...over,
})

const sug = (id: string, over: Partial<Suggestion> = {}): Suggestion => ({
  id,
  agendaId: 'agd_1',
  kind: 'question',
  text: `Ask about ${id}`,
  itemId: null,
  source: 'tracker',
  createdAt: T,
  expiresAt: null,
  state: 'open',
  resolvedAt: null,
  resolvedBy: null,
  ...over,
})

const view = (items: AgendaItem[], suggestions: Suggestion[] = []): AgendaView => ({
  agenda: {
    id: 'agd_1',
    title: '1:1 with Ana',
    meeting: null,
    sessionId: 's1',
    owner: 'me',
    goals: [],
    private: false,
    carriedFrom: null,
    version: 1,
    createdAt: T,
    updatedAt: T,
  },
  items,
  context: [],
  suggestions,
})

const meeting = (
  id: string,
  title: string,
  start: number,
  minutes: number,
  over: Partial<Meeting> = {},
): Meeting => ({
  id,
  uid: `${id}@x`,
  recurrenceId: null,
  calendar: { id: 'cal', name: 'Work' },
  title,
  start: iso(start),
  end: iso(start + minutes * 60_000),
  allDay: false,
  timezone: null,
  location: null,
  join: null,
  status: 'confirmed',
  response: null,
  organizer: null,
  attendees: 2,
  recurring: false,
  ...over,
})

const summary = (id: string, over: Partial<AgendaSummary> = {}): AgendaSummary => ({
  ...view([]).agenda,
  id,
  sessionId: null,
  counts: { items: 3, open: 3, inProgress: 0, covered: 0, skipped: 0, parked: 0 },
  ...over,
})

describe('meeting phase', () => {
  it('prep before a recording, live while it records or is paused, outcome once it ended', () => {
    expect(meetingPhase(null)).toBe('prep')
    expect(meetingPhase(undefined)).toBe('prep')
    expect(meetingPhase({ status: 'idle' })).toBe('prep')
    expect(meetingPhase({ status: 'recording' })).toBe('live')
    expect(meetingPhase({ status: 'paused' })).toBe('live')
    expect(meetingPhase({ status: 'stopped' })).toBe('outcome')
    expect(meetingPhase({ status: 'recovered' })).toBe('outcome')
    expect(meetingPhase({ status: 'failed' })).toBe('outcome')
  })

  it('names who started a recording only when the evidence is clear', () => {
    const none = { startedHere: new Set<string>(), calendarRule: false }
    const s = session('s1', { startedAt: T })
    expect(startedBy(s, { ...none, startedHere: new Set(['s1']) })).toBe('you')
    expect(startedBy({ ...s, title: 'Call (Firefox)' }, none)).toBe('mic')
    const m = {
      id: 'mtg',
      uid: 'u',
      title: 'Sync',
      start: '2026-03-12T09:59:00.000Z',
      end: '2026-03-12T10:30:00.000Z',
      join: null,
      calendar: 'Work',
    }
    expect(startedBy({ ...s, meeting: m }, { ...none, calendarRule: true })).toBe('calendar')
    // the rule is off, or the recording began long after the meeting did: not the calendar
    expect(startedBy({ ...s, meeting: m }, none)).toBeNull()
    expect(
      startedBy({ ...s, meeting: m, startedAt: '2026-03-12T10:20:00.000Z' }, { ...none, calendarRule: true }),
    ).toBeNull()
    expect(startedBy(s, none)).toBeNull()
  })

  it('warns that capture looks broken only after a track sent digital silence or nothing for a while', () => {
    const t0 = 1_000_000
    // too early in the recording to judge
    expect(captureWarning({}, ['mic', 'system'], t0, t0 + 10_000)).toEqual([])
    // nothing at all from either track for SILENT_FOR_MS
    expect(captureWarning({}, ['mic', 'system'], t0, t0 + SILENT_FOR_MS)).toEqual(['mic', 'system'])
    // the mic is heard recently, the other side has been silent since the start
    const heard = {
      mic: { lastEventAt: t0 + 59_000, lastSoundAt: t0 + 58_000 },
      system: { lastEventAt: t0 + 59_000, lastSoundAt: null },
    }
    expect(captureWarning(heard, ['mic', 'system'], t0, t0 + 60_000)).toEqual(['system'])
    // not recording (paused or stopped): never
    expect(captureWarning({}, ['mic'], null, t0 + 600_000)).toEqual([])
    // only the tracks the session actually captures
    expect(captureWarning({}, ['mic'], t0, t0 + SILENT_FOR_MS)).toEqual(['mic'])
  })
})

describe('the suggestion slot', () => {
  const ev = { segmentId: 'seg1', quote: 'The 28th could work, if Marta can join.', confidence: 0.8 }

  it('shows nothing without a suggestion: no fallback card', () => {
    expect(pickSuggestion(view([item('a', 0), item('b', 1)]), Date.parse(T))).toBeNull()
  })

  it('prefers what just happened over what to say next, and carries the evidence', () => {
    const v = view(
      [item('Onboarding', 0, { evidence: [ev] }), item('Review date', 1)],
      [
        sug('next', { kind: 'next-point', itemId: 'Review date', createdAt: '2026-03-12T10:05:00.000Z' }),
        sug('covered', {
          kind: 'looks-covered',
          itemId: 'Onboarding',
          createdAt: '2026-03-12T10:01:00.000Z',
        }),
      ],
    )
    const slot = pickSuggestion(v, Date.parse(T))
    expect(slot?.kind).toBe('looks-covered')
    expect(slot?.suggestion.id).toBe('covered')
    expect(slot?.item?.id).toBe('Onboarding')
    expect(slot?.evidence?.quote).toBe(ev.quote)
  })

  it('among equals the newest wins; missed, expired, resolved and stale ones never show', () => {
    const v = view(
      [item('Done', 0, { status: 'covered' }), item('Open', 1)],
      [
        sug('old', { kind: 'question', createdAt: '2026-03-12T10:01:00.000Z' }),
        sug('new', { kind: 'next-point', createdAt: '2026-03-12T10:02:00.000Z' }),
        sug('missed', { kind: 'missed', createdAt: '2026-03-12T10:09:00.000Z' }),
        sug('expired', { kind: 'looks-covered', itemId: 'Open', expiresAt: '2026-03-12T09:00:00.000Z' }),
        sug('resolved', { kind: 'looks-covered', itemId: 'Open', state: 'dismissed' }),
        sug('stale', { kind: 'looks-covered', itemId: 'Done', createdAt: '2026-03-12T10:08:00.000Z' }),
      ],
    )
    const slot = pickSuggestion(v, Date.parse(T))
    expect(slot?.suggestion.id).toBe('new')
    expect(slot?.kind).toBe('say-next')
  })

  it('an agent’s proposal ranks with the check-offs; a fact check comes last', () => {
    const v = view(
      [item('a', 0)],
      [
        sug('fact', { kind: 'fact-check', createdAt: '2026-03-12T10:09:00.000Z' }),
        sug('prop', { kind: 'add-item', source: 'agent:claude', createdAt: '2026-03-12T10:01:00.000Z' }),
      ],
    )
    expect(pickSuggestion(v, Date.parse(T))?.kind).toBe('proposal')
    expect(
      pickSuggestion(view([item('a', 0)], [sug('f', { kind: 'fact-check' })]), Date.parse(T))?.kind,
    ).toBe('check')
  })

  it('the current item is the first in progress, in agenda order', () => {
    expect(currentItem(view([item('a', 0), item('b', 1)]))).toBeNull()
    expect(
      currentItem(view([item('c', 2, { status: 'in-progress' }), item('b', 1, { status: 'in-progress' })]))
        ?.id,
    ).toBe('b')
  })
})

describe('home: the day', () => {
  it('writes durations out and labels days in words', () => {
    expect(durationLabel(12 * 60_000)).toBe('12 min')
    expect(durationLabel(90 * 60_000)).toBe('1 h 30 min')
    expect(durationLabel(120 * 60_000)).toBe('2 h')
    expect(durationLabel(20_000)).toBe('under 1 min')
    expect(durationLabel(Number.NaN)).toBe('under 1 min')
    const now = at(15, 30)
    expect(dayLabel(at(9), now)).toBe('Today')
    expect(dayLabel(at(9, 0, -1), now)).toBe('Yesterday')
    expect(dayLabel(at(9, 0, -3), now)).toBe('Monday')
    expect(dayLabel(at(9, 0, -8), now)).toBe('4 March')
    expect(dayLabel(new Date(2025, 11, 1).getTime(), now)).toBe('1 December 2025')
    expect(countdown(iso(at(16)), iso(at(16, 30)), now)).toBe('starting in 30 min')
    expect(countdown(iso(at(15)), iso(at(16)), now)).toBe('started 30 min ago')
    expect(countdown(iso(at(14)), iso(at(15)), now)).toBe('ended')
  })

  const titles = (d: ReturnType<typeof buildDay>) =>
    d.today.map((e) => (e.kind === 'meeting' ? e.meeting.title : `rec ${e.session.id}`))
  const linked = (id: string, m: Meeting, over: Partial<Session> = {}) =>
    session(id, {
      status: 'stopped',
      startedAt: iso(Date.parse(m.start) + 60_000),
      createdAt: iso(Date.parse(m.start) + 60_000),
      meeting: {
        id: m.id,
        uid: m.uid,
        title: m.title,
        start: m.start,
        end: m.end,
        join: null,
        calendar: 'Work',
      },
      ...over,
    })

  it('runs today latest first, with the now line between the next meeting and the last past one', () => {
    const now = at(15, 30)
    const standup = meeting('mtg_standup', 'Platform standup', at(9, 30), 15)
    const review = meeting('mtg_review', 'Design review', at(14), 45)
    const ana = meeting('mtg_ana', '1:1 with Ana', at(16), 30)
    const hiring = meeting('mtg_hire', 'Hiring sync', at(17), 30)
    const allDay = meeting('mtg_day', 'Offsite', at(0), 24 * 60, { allDay: true })
    const cancelled = meeting('mtg_x', 'Cancelled', at(16, 15), 15, { status: 'cancelled' })
    const tomorrow = meeting('mtg_tmw', 'Tomorrow', at(9, 0, 1), 30)
    const recStandup = linked('s_standup', standup)
    const adhoc = session('s_adhoc', { status: 'stopped', startedAt: iso(at(11)), createdAt: iso(at(11)) })
    const yesterday = session('s_y', {
      status: 'stopped',
      startedAt: iso(at(11, 0, -1)),
      createdAt: iso(at(11, 0, -1)),
    })
    const yesterdayLate = session('s_y2', {
      status: 'stopped',
      startedAt: iso(at(16, 0, -1)),
      createdAt: iso(at(16, 0, -1)),
    })
    const lastWeek = session('s_w', {
      status: 'recovered',
      startedAt: iso(at(10, 0, -3)),
      createdAt: iso(at(10, 0, -3)),
    })
    const anaAgenda = summary('agd_ana', {
      meeting: {
        ...summary('x').meeting!,
        eventUid: ana.uid,
        start: ana.start,
        end: ana.end,
        recurrenceId: null,
        meetingId: ana.id,
        title: ana.title,
        calendar: 'Work',
        recurring: false,
      },
    })
    const day = buildDay(
      [yesterdayLate, adhoc, recStandup, yesterday, lastWeek],
      [hiring, ana, review, standup, allDay, cancelled, tomorrow],
      [anaAgenda],
      now,
    )
    // the end of the day first, down through now, to this morning
    expect(titles(day)).toEqual([
      'Hiring sync',
      '1:1 with Ana',
      'Design review',
      'rec s_adhoc',
      'Platform standup',
    ])
    expect(day.today.every((e) => !e.current)).toBe(true)
    // the line sits just below the next meeting (the 1:1) and above the last past one (the review)
    expect(day.nowAt).toBe(2)
    const standupRow = day.today.at(-1)!
    expect(standupRow.kind === 'meeting' && standupRow.session?.id).toBe('s_standup')
    // the soonest meeting still to come is expanded, with its agenda
    expect(day.next).toBe('m:mtg_ana')
    expect(day.soonest).toBe('m:mtg_ana')
    const ana1 = day.today.find((e) => e.key === 'm:mtg_ana')!
    expect(ana1.kind === 'meeting' && ana1.agenda?.id).toBe('agd_ana')
    // all-day events are a strip, not on the timeline
    expect(day.allDay.map((m) => m.title)).toEqual(['Offsite'])
    // earlier days latest first, and each day latest first too
    expect(day.earlier.map((d) => [d.label, d.sessions.map((s) => s.id)])).toEqual([
      ['Yesterday', ['s_y2', 's_y']],
      ['Monday', ['s_w']],
    ])
  })

  it('puts the line at the top when the day is over, at the bottom when it has not begun', () => {
    const m1 = meeting('mtg_1', 'Morning', at(9), 30)
    const m2 = meeting('mtg_2', 'Noon', at(12), 30)
    expect(buildDay([], [m1, m2], [], at(18)).nowAt).toBe(0)
    expect(buildDay([], [m1, m2], [], at(18)).next).toBeNull()
    const early = buildDay([], [m1, m2], [], at(7))
    expect(early.nowAt).toBe(2)
    expect(early.next).toBe('m:mtg_1')
    expect(buildDay([], [], [], at(7)).nowAt).toBeNull()
  })

  it('a recording under way is current, in its place, and there is no now line', () => {
    const live = session('s_live', { status: 'paused', startedAt: iso(at(15)), createdAt: iso(at(15)) })
    const later = meeting('mtg_later', 'Later', at(17), 30)
    const earlier = meeting('mtg_early', 'Early', at(10), 30)
    const day = buildDay([live], [later, earlier], [], at(15, 30))
    expect(day.today.map((e) => [e.key, e.current])).toEqual([
      ['m:mtg_later', false],
      ['s:s_live', true],
      ['m:mtg_early', false],
    ])
    expect(day.nowAt).toBeNull()
    // the next meeting stays compact while something is under way
    expect(day.next).toBeNull()
    expect(day.soonest).toBe('m:mtg_later')
  })

  it('a meeting in progress is current even unrecorded (no line); recorded and running, it is one entry', () => {
    const now = at(14, 10)
    const sync = meeting('mtg_sync', 'Weekly sync', at(14), 30)
    const next = meeting('mtg_next', 'Next one', at(15), 30)
    const unrecorded = buildDay([], [sync, next], [], now)
    expect(unrecorded.today.find((e) => e.key === 'm:mtg_sync')?.current).toBe(true)
    expect(unrecorded.nowAt).toBeNull()
    expect(unrecorded.next).toBeNull()
    const rec = linked('s_sync', sync, { status: 'recording', durationMs: 0 })
    const recorded = buildDay([rec], [sync, next], [], now)
    expect(recorded.today.map((e) => e.key)).toEqual(['m:mtg_next', 'm:mtg_sync'])
    const cur = recorded.today[1]!
    expect(cur.current && cur.kind === 'meeting' && cur.session?.id).toBe('s_sync')
    // a recording that outlives its meeting is still what is under way
    expect(buildDay([rec], [sync], [], at(14, 45)).today[0]?.current).toBe(true)
  })

  it('overlapping meetings in progress are both current, in place, with no line', () => {
    const a = meeting('mtg_a', 'Planning', at(9), 60)
    const b = meeting('mtg_b', 'Standup', at(9, 30), 15)
    const day = buildDay([], [a, b], [], at(9, 35))
    expect(day.today.map((e) => [e.kind === 'meeting' ? e.meeting.title : '', e.current])).toEqual([
      ['Standup', true],
      ['Planning', true],
    ])
    expect(day.nowAt).toBeNull()
  })

  it('a recording with no meeting goes in by its start; one left running since last night is today’s', () => {
    const m = meeting('mtg_m', 'Review', at(10), 30)
    const adhoc = session('s_a', {
      status: 'stopped',
      startedAt: iso(at(10, 15)),
      createdAt: iso(at(10, 15)),
    })
    expect(titles(buildDay([adhoc], [m], [], at(12)))).toEqual(['rec s_a', 'Review'])
    const overnight = session('s_n', {
      status: 'recording',
      startedAt: iso(at(23, 0, -1)),
      createdAt: iso(at(23, 0, -1)),
    })
    const day = buildDay([overnight], [], [], at(8))
    expect(day.today.map((e) => [e.key, e.current])).toEqual([['s:s_n', true]])
    expect(day.earlier).toEqual([])
  })

  it('cleans up a real calendar: duplicates across calendars, declined, all-day spans, last night’s event', () => {
    const now = at(12)
    const meet = { url: 'https://meet.google.com/abc-defg-hij', provider: 'meet' as const }
    const dupA = meeting('mtg_d1', 'Quarterly planning', at(15), 60, {
      calendar: { id: 'team', name: 'Team' },
    })
    const dupB = meeting('mtg_d2', ' quarterly planning ', at(15), 60, { join: meet, response: 'accepted' })
    const dupC = meeting('mtg_d3', 'Quarterly planning', at(15), 60, { response: 'needs-action' })
    const declined = meeting('mtg_no', 'Vendor pitch', at(13), 30, { response: 'declined' })
    const week = meeting('mtg_wk', 'Conference week', at(0, 0, -2), 5 * 24 * 60, { allDay: true })
    const holiday = meeting('mtg_h', 'Bank holiday', at(0, 0, 1), 24 * 60, { allDay: true })
    const lastNight = meeting('mtg_ln', 'Release window', at(23, 30, -1), 90)
    const day = buildDay([], [dupA, dupB, dupC, declined, week, holiday, lastNight], [], now)
    expect(titles(day)).toEqual([' quarterly planning ', 'Release window'])
    // the copy kept is the one with the join link
    expect(day.today[0]!.kind === 'meeting' && day.today[0]!.meeting.id).toBe('mtg_d2')
    // last night's event sits at today's start, under the morning
    expect(day.today[1]!.at).toBe(at(0))
    expect(day.allDay.map((m) => m.title)).toEqual(['Conference week'])
    expect(dedupeMeetings([dupA, dupB, dupC, declined]).map((m) => m.id)).toEqual(['mtg_d2'])
  })

  it('a busy day of many meetings stays in strict descending order, ties by the later end', () => {
    const ms = Array.from({ length: 10 }, (_, i) => meeting(`mtg_${i}`, `M${i}`, at(8 + i), 30))
    ms.push(meeting('mtg_long', 'Long', at(10), 120))
    const day = buildDay([], ms, [], at(12, 45))
    const ats = day.today.map((e) => e.at)
    expect([...ats].sort((x, y) => y - x)).toEqual(ats)
    const tenOClock = day.today.filter((e) => e.at === at(10)).map((e) => e.key)
    expect(tenOClock).toEqual(['m:mtg_long', 'm:mtg_2'])
    expect(day.today.length).toBe(11)
  })

  it('says when a meeting is: starting in, now and how long ago, ended', () => {
    const now = at(15, 30)
    expect(countdown(iso(at(15, 32)), iso(at(16)), now)).toBe('starting in 2 min')
    expect(countdown(iso(at(16, 35)), iso(at(17)), now)).toBe('starting in 1 h 5 min')
    expect(countdown(iso(at(15, 30)), iso(at(16)), now + 20_000)).toBe('just started')
    expect(countdown(iso(at(15, 20)), iso(at(16)), now)).toBe('started 10 min ago')
    expect(countdown(iso(at(14)), iso(at(16)), now)).toBe('started 1 h 30 min ago')
    expect(countdown(iso(at(14)), iso(at(15)), now)).toBe('ended')
  })

  it('quiets recordings too short to hold anything', () => {
    expect(isShortRecording(session('a', { status: 'stopped', durationMs: 4000 }))).toBe(true)
    expect(isShortRecording(session('b', { status: 'stopped', durationMs: 120_000 }))).toBe(false)
    expect(isShortRecording(session('c', { status: 'recording', durationMs: 0 }))).toBe(false)
  })

  it('matches an occurrence to its agenda by uid and occurrence', () => {
    const m = meeting('mtg_1', 'Standup', at(9), 15, {
      recurring: true,
      recurrenceId: '2026-03-12T09:00:00.000Z',
    })
    const base = summary('a').meeting
    const mk = (id: string, recurrenceId: string | null, meetingId: string | null) =>
      summary(id, {
        meeting: {
          ...(base ?? ({} as never)),
          eventUid: m.uid,
          start: m.start,
          end: m.end,
          recurrenceId,
          meetingId,
          title: m.title,
          calendar: null,
          recurring: true,
        },
      })
    expect(agendaOf(m, [mk('other', '2026-03-11T09:00:00.000Z', 'mtg_0')])).toBeNull()
    expect(
      agendaOf(m, [mk('other', '2026-03-11T09:00:00.000Z', 'mtg_0'), mk('this', m.recurrenceId, null)])?.id,
    ).toBe('this')
  })

  it('says recording will work, or the one thing in the way', () => {
    expect(readiness({ missingModels: 0, connected: true })).toEqual({
      ok: true,
      text: 'Recording will work',
    })
    expect(readiness({ missingModels: 2, connected: true })).toMatchObject({ ok: false, fix: 'models' })
    expect(readiness({ missingModels: 0, connected: false })).toMatchObject({ ok: false, fix: 'daemon' })
  })
})

describe('home: search moments', () => {
  it('splits the daemon’s [marks] and marks a plain title', () => {
    // marks only a space apart read as one
    expect(snippetParts('…the [retry] [budget] is [three]')).toEqual([
      { text: '…the ', mark: false },
      { text: 'retry budget', mark: true },
      { text: ' is ', mark: false },
      { text: 'three', mark: true },
    ])
    expect(snippetParts('no marks')).toEqual([{ text: 'no marks', mark: false }])
    expect(markText('Platform standup', 'STAND')).toEqual([
      { text: 'Platform ', mark: false },
      { text: 'stand', mark: true },
      { text: 'up', mark: false },
    ])
  })

  it('maps the daemon’s moments: meeting · day · time · speaker · line, with the window’s titles', () => {
    const now = at(15, 30)
    const standup = session('s1', {
      title: 'Platform standup (renamed)',
      startedAt: iso(at(9, 30)),
      createdAt: iso(at(9, 30)),
    })
    const moment = (o: Partial<SearchMoment>): SearchMoment => ({
      kind: 'transcript',
      sessionId: 's1',
      sessionTitle: 'Platform standup',
      date: iso(at(9, 30)),
      private: false,
      speaker: null,
      segmentId: null,
      startMs: null,
      endMs: null,
      snippet: '',
      score: 1,
      ...o,
    })
    const m = toMoments(
      [
        moment({
          kind: 'title',
          sessionId: 's2',
          sessionTitle: 'Sprint retro',
          date: iso(at(10, 0, -8)),
          private: true,
          snippet: 'Sprint [retro]',
          score: 9,
        }),
        moment({ kind: 'notes', snippet: '[retry] budget?', score: 5 }),
        moment({
          speaker: 'them',
          segmentId: 'seg3',
          startMs: 66_000,
          endMs: 70_000,
          snippet: 'The [retry] budget is three attempts',
        }),
      ],
      [standup],
      now,
    )
    expect(m.map((x) => [x.kind, x.title, x.day, x.at, x.speaker])).toEqual([
      ['title', 'Sprint retro', '4 March', null, null],
      ['notes', 'Platform standup (renamed)', 'Today', null, 'Your notes'],
      ['transcript', 'Platform standup (renamed)', 'Today', '1:06', 'Them'],
    ])
    expect(m[0]!.private).toBe(true)
    expect(m[2]!.segmentId).toBe('seg3')
    expect(m[2]!.startMs).toBe(66_000)
    expect(m[2]!.parts.find((p) => p.mark)?.text).toBe('retry')
    expect(new Set(m.map((x) => x.key)).size).toBe(3)
  })

  it('reads a question as a question', () => {
    expect(looksLikeQuestion('what did we decide about retries')).toBe(true)
    expect(looksLikeQuestion('retry budget?')).toBe(true)
    expect(looksLikeQuestion('retry budget')).toBe(false)
    // a question searches for its content words; anything else as typed
    expect(searchTerms('What did we decide about the retry budget?')).toBe('retry budget')
    expect(searchTerms('  retry budget ')).toBe('retry budget')
    expect(searchTerms('who?')).toBe('who?')
  })
})

describe('the outcome', () => {
  const NOTES =
    '## Promo timeline\n\n- Ana wants a date\n\n## Decisions\n\n- Review on 28 October\n- [ ] Check the slides\n\n## Action items\n\n' +
    '- [ ] Send conference options — owner: Ana — due: next 1:1\n- [x] Book the room — owner: me\n- [ ] Invite Marta to the review — owner: me — due: Friday\n'

  it('reads a notes section by its heading', () => {
    expect(notesSection(NOTES, /^decisions?\b/i)).toEqual(['Review on 28 October'])
    expect(notesSection('no headings\n- a\n', /decisions/i)).toEqual([])
  })

  it('gathers decisions and actions from the recap and the notes, once each; yours first, done last', () => {
    const ev = { segmentId: 'seg9', quote: 'The 28th could work.', confidence: 0.8 }
    const v = view([
      item('Next review date', 0, {
        status: 'covered',
        evidence: [ev],
        outcome:
          'Review on 28 October.\nDecisions:\n- Review on 28 October\nActions:\n- me: Invite Marta to the review',
      }),
      item('Conference budget', 1, { status: 'open' }),
      item('Parking lot', 2, { status: 'skipped' }),
    ])
    const o = buildOutcome(v, NOTES)
    // the recap's decision carries its evidence; the notes' copy of it is not repeated
    expect(o.decisions).toEqual([{ text: 'Review on 28 October', evidence: ev }])
    expect(o.actions.map((a) => [a.text, a.owner, a.due, a.done, a.mine])).toEqual([
      ['Invite Marta to the review', 'me', null, false, true],
      // a task anywhere in the notes is an action item (the daemon's parser), not a decision
      ['Check the slides', null, null, false, false],
      ['Send conference options', 'Ana', 'next 1:1', false, false],
      ['Book the room', 'me', null, true, true],
    ])
    // not a recurring meeting: what is open is "not settled", skipped is settled
    expect(o.recurring).toBe(false)
    expect(o.carried).toEqual([{ text: 'Conference budget' }])
    expect(ownerLabel('me')).toBe('You')
    expect(ownerLabel('Ana')).toBe('Ana')
    expect(ownerLabel(null)).toBeNull()
  })

  it('a recording without an agenda has only what its notes say', () => {
    const o = buildOutcome(null, NOTES)
    expect(o.decisions.map((d) => d.text)).toEqual(['Review on 28 October'])
    expect(o.carried).toEqual([])
    expect(buildOutcome(null, '')).toEqual({ decisions: [], actions: [], carried: [], recurring: false })
  })

  it('the shared summary is the outcome and the notes, never private context', () => {
    const v = view([item('Conference budget', 0, { status: 'open' })])
    v.context = [
      {
        id: 'c1',
        agendaId: 'agd_1',
        title: 'My notes on Ana',
        body: 'nervous about the timeline',
        source: { kind: 'user', ref: null },
        visibility: 'private',
        pinned: false,
        createdBy: 'user',
        createdAt: T,
        updatedAt: T,
      },
    ]
    const md = summaryMarkdown({
      title: '1:1 with Ana',
      when: '14:00–14:30',
      outcome: buildOutcome(v, NOTES),
      notes: NOTES,
    })
    expect(md).toContain('# 1:1 with Ana')
    expect(md).toContain('## Decisions\n\n- Review on 28 October')
    expect(md).toContain('- [ ] Send conference options — owner: Ana — due: next 1:1')
    expect(md).toContain('- [x] Book the room — owner: You')
    expect(md).toContain('## Not settled\n\n- Conference budget')
    expect(md).toContain('## Notes')
    expect(md).not.toContain('nervous')
  })
})
