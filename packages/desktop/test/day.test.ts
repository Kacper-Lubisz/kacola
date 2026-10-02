import type {
  AgendaItem,
  AgendaSummary,
  AgendaView,
  Meeting,
  SearchHit,
  Suggestion,
} from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import {
  agendaOf,
  buildDay,
  countdown,
  dayLabel,
  durationLabel,
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
    expect(countdown(iso(at(16)), iso(at(16, 30)), now)).toBe('in 30 min')
    expect(countdown(iso(at(15)), iso(at(16)), now)).toBe('now')
    expect(countdown(iso(at(14)), iso(at(15)), now)).toBe('ended')
  })

  it('merges today’s meetings and recordings in strict time order and expands the next unrecorded meeting', () => {
    const now = at(15, 30)
    const standup = meeting('mtg_standup', 'Platform standup', at(9, 30), 15)
    const review = meeting('mtg_review', 'Design review', at(14), 45)
    const ana = meeting('mtg_ana', '1:1 with Ana', at(16), 30)
    const hiring = meeting('mtg_hire', 'Hiring sync', at(17), 30)
    const allDay = meeting('mtg_day', 'Offsite', at(0), 24 * 60, { allDay: true })
    const cancelled = meeting('mtg_x', 'Cancelled', at(16, 15), 15, { status: 'cancelled' })
    const tomorrow = meeting('mtg_tmw', 'Tomorrow', at(9, 0, 1), 30)
    const recStandup = session('s_standup', {
      status: 'stopped',
      startedAt: iso(at(9, 31)),
      createdAt: iso(at(9, 31)),
      meeting: {
        id: 'mtg_standup',
        uid: standup.uid,
        title: standup.title,
        start: standup.start,
        end: standup.end,
        join: null,
        calendar: 'Work',
      },
    })
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
    expect(day.live).toBeNull()
    expect(day.today.map((e) => (e.kind === 'meeting' ? e.meeting.title : `rec ${e.session.id}`))).toEqual([
      'Platform standup',
      'rec s_adhoc',
      'Design review',
      '1:1 with Ana',
      'Hiring sync',
    ])
    const first = day.today[0]!
    expect(first.kind === 'meeting' && first.session?.id).toBe('s_standup')
    // Design review ended unrecorded: the next one is the 1:1, with its agenda
    expect(day.next).toBe('m:mtg_ana')
    const ana1 = day.today.find((e) => e.key === 'm:mtg_ana')!
    expect(ana1.kind === 'meeting' && ana1.agenda?.id).toBe('agd_ana')
    expect(day.earlier.map((d) => [d.label, d.sessions.map((s) => s.id)])).toEqual([
      ['Yesterday', ['s_y', 's_y2']],
      ['Monday', ['s_w']],
    ])
  })

  it('pins a recording under way', () => {
    const live = session('s_live', { status: 'paused', startedAt: iso(at(15)), createdAt: iso(at(15)) })
    const day = buildDay([live], [], [], at(15, 30))
    expect(day.live?.id).toBe('s_live')
    expect(day.today.map((e) => e.key)).toEqual(['s:s_live'])
    expect(day.next).toBeNull()
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

  it('lists title matches first, then transcript lines as meeting · day · time · speaker · line', () => {
    const now = at(15, 30)
    const standup = session('s1', {
      title: 'Platform standup',
      startedAt: iso(at(9, 30)),
      createdAt: iso(at(9, 30)),
    })
    const retro = session('s2', {
      title: 'Sprint retro',
      startedAt: iso(at(10, 0, -8)),
      createdAt: iso(at(10, 0, -8)),
      private: true,
    })
    const hits: SearchHit[] = [
      {
        sessionId: 's1',
        sessionTitle: 'Platform standup',
        segmentId: 'seg3',
        speaker: 'them',
        startMs: 66_000,
        endMs: 70_000,
        snippet: 'Yes. The [retry] budget is three attempts',
        score: 3,
      },
      {
        sessionId: 's2',
        sessionTitle: 'Sprint retro',
        segmentId: 'seg9',
        speaker: 'me',
        startMs: 30_000,
        endMs: 34_000,
        snippet: 'The [retry] storm',
        score: 2,
      },
    ]
    const m = toMoments('retr', [standup, retro], hits, now)
    expect(m.map((x) => [x.title, x.day, x.at, x.speaker])).toEqual([
      ['Sprint retro', '4 March', null, null],
      ['Platform standup', 'Today', '1:06', 'Them'],
      ['Sprint retro', '4 March', '0:30', 'Me'],
    ])
    expect(m[0]!.private).toBe(true)
    expect(m[1]!.segmentId).toBe('seg3')
    expect(m[1]!.parts.find((p) => p.mark)?.text).toBe('retry')
    // a blank query matches no titles
    expect(toMoments('  ', [standup], [], now)).toEqual([])
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
