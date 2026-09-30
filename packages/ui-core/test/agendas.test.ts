import type {
  Agenda,
  AgendaItem,
  AgendaView,
  ContextCard,
  StatusChange,
  Suggestion,
} from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import {
  type AgendaEventData,
  activeSuggestions,
  applyAgendaEvent,
  applyHistoryEvent,
  attributionOf,
  carriesOver,
  interviewSplit,
  isInterview,
  moveItem,
  nextTalkingPoint,
  notCoveredYet,
  parseRecapOutcome,
  reorderItems,
  statusCounts,
} from '../src/agendas.ts'

const T = '2026-09-30T10:00:00.000Z'

export const agenda = (over: Partial<Agenda> = {}): Agenda => ({
  id: 'agd_1',
  title: '1:1 with Ana',
  meeting: null,
  sessionId: null,
  owner: 'me',
  goals: [],
  private: false,
  carriedFrom: null,
  version: 3,
  createdAt: T,
  updatedAt: T,
  ...over,
})

export const item = (id: string, over: Partial<AgendaItem> = {}): AgendaItem => ({
  id,
  agendaId: 'agd_1',
  text: id,
  kind: 'topic',
  owner: null,
  timeboxMin: null,
  order: 0,
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

const suggestion = (id: string, over: Partial<Suggestion> = {}): Suggestion => ({
  id,
  agendaId: 'agd_1',
  kind: 'next-point',
  text: `say ${id}`,
  itemId: null,
  source: 'tracker',
  createdAt: T,
  expiresAt: null,
  state: 'open',
  resolvedAt: null,
  resolvedBy: null,
  ...over,
})

const card = (id: string, over: Partial<ContextCard> = {}): ContextCard => ({
  id,
  agendaId: 'agd_1',
  title: id,
  body: 'b',
  source: { kind: 'user', ref: null },
  visibility: 'private',
  pinned: false,
  createdBy: 'user',
  createdAt: T,
  updatedAt: T,
  ...over,
})

const view = (over: Partial<AgendaView> = {}): AgendaView => ({
  agenda: agenda(),
  items: [item('a', { order: 0 }), item('b', { order: 1 }), item('c', { order: 2 })],
  context: [],
  suggestions: [],
  ...over,
})

const scoped = (version: number) => ({ agendaId: 'agd_1', version, at: '2026-09-30T10:05:00.000Z' })

const change = (itemId: string, over: Partial<StatusChange> = {}): StatusChange => ({
  itemId,
  from: 'open',
  to: 'covered',
  by: 'tracker',
  at: '2026-09-30T10:05:00.000Z',
  note: null,
  evidence: [],
  override: false,
  auto: true,
  confidence: 0.9,
  ...over,
})

describe('applyAgendaEvent', () => {
  it('applies every agenda event kind and bumps the version', () => {
    let v: AgendaView | null = view()
    const events: AgendaEventData[] = [
      { type: 'agenda.item.upserted', ...scoped(4), item: item('d', { order: 3 }) },
      {
        type: 'agenda.item.status',
        ...scoped(5),
        item: item('a', { status: 'covered' }),
        change: change('a'),
      },
      { type: 'agenda.item.deleted', ...scoped(6), itemId: 'b' },
      { type: 'agenda.items.reordered', ...scoped(7), itemIds: ['d', 'c', 'a'] },
      { type: 'agenda.context.upserted', ...scoped(8), card: card('x') },
      { type: 'agenda.context.upserted', ...scoped(9), card: card('x', { visibility: 'shared' }) },
      { type: 'agenda.context.deleted', ...scoped(10), cardId: 'x' },
      { type: 'agenda.suggestion.upserted', agendaId: 'agd_1', suggestion: suggestion('s') },
      { type: 'agenda.upserted', agenda: agenda({ version: 11, title: 'Renamed' }) },
    ]
    for (const e of events) v = applyAgendaEvent(v!, e)
    expect(v!.agenda).toMatchObject({ version: 11, title: 'Renamed' })
    expect(v!.items.map((i) => [i.id, i.order, i.status])).toEqual([
      ['d', 0, 'open'],
      ['c', 1, 'open'],
      ['a', 2, 'covered'],
    ])
    expect(v!.context).toEqual([])
    expect(v!.suggestions.map((s) => s.id)).toEqual(['s'])
  })

  it('drops replays and duplicates (same object back)', () => {
    const v = view()
    const old = { type: 'agenda.item.upserted', ...scoped(3), item: item('z') } as const
    expect(applyAgendaEvent(v, old)).toBe(v)
    const once = applyAgendaEvent(v, { ...old, version: 4 })!
    expect(applyAgendaEvent(once, { ...old, version: 4 })).toBe(once)
    const s = { type: 'agenda.suggestion.upserted', agendaId: 'agd_1', suggestion: suggestion('s') } as const
    const withS = applyAgendaEvent(v, s)!
    expect(applyAgendaEvent(withS, s)).toBe(withS)
    expect(applyAgendaEvent(v, { type: 'agenda.upserted', agenda: agenda({ version: 2 }) })).toBe(v)
  })

  it('ignores other agendas; deletion returns null', () => {
    const v = view()
    expect(
      applyAgendaEvent(v, { type: 'agenda.item.deleted', ...scoped(9), agendaId: 'agd_2', itemId: 'a' }),
    ).toBe(v)
    expect(applyAgendaEvent(v, { type: 'agenda.deleted', agendaId: 'agd_1' })).toBeNull()
  })

  it('an echo replaces an optimistic edit (optimistic edits never bump the version)', () => {
    const v = view()
    const optimistic = { ...v, items: v.items.map((i) => (i.id === 'a' ? { ...i, text: 'typed' } : i)) }
    const echoed = applyAgendaEvent(optimistic, {
      type: 'agenda.item.upserted',
      ...scoped(4),
      item: item('a', { text: 'typed (server)' }),
    })!
    expect(echoed.items[0]!.text).toBe('typed (server)')
  })
})

describe('history', () => {
  it('appends status changes once', () => {
    const e = {
      type: 'agenda.item.status',
      ...scoped(4),
      item: item('a', { status: 'covered' }),
      change: change('a'),
    } as const
    const h = applyHistoryEvent([], e)
    expect(h).toHaveLength(1)
    expect(applyHistoryEvent(h, e)).toBe(h)
    expect(applyHistoryEvent(h, { type: 'agenda.item.deleted', ...scoped(5), itemId: 'a' })).toBe(h)
  })
})

describe('ordering', () => {
  it('moves and reorders', () => {
    const v = view()
    expect(moveItem(v.items, 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(v.items, 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(v.items, 0, 9)).toEqual(['a', 'b', 'c'])
    expect(reorderItems(v.items, ['c', 'a']).map((i) => [i.id, i.order])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ])
  })
})

describe('live panel logic', () => {
  const now = Date.parse('2026-09-30T10:20:00.000Z')

  it('next talking point: a next-point suggestion first, else the first open must-cover, else the first open', () => {
    const v = view({
      items: [
        item('a', { order: 0, status: 'in-progress' }),
        item('b', { order: 1 }),
        item('c', { order: 2, kind: 'must-cover' }),
      ],
    })
    expect(nextTalkingPoint(v, now)).toMatchObject({ kind: 'item', item: { id: 'c' } })
    const noMust = view({ items: [item('a', { status: 'covered' }), item('b', { order: 1 })] })
    expect(nextTalkingPoint(noMust, now)).toMatchObject({ kind: 'item', item: { id: 'b' } })
    const withSug = { ...v, suggestions: [suggestion('s', { itemId: 'b' })] }
    expect(nextTalkingPoint(withSug, now)).toMatchObject({ kind: 'suggestion', item: { id: 'b' } })
    // expired, resolved, or about a covered item: not shown
    const stale = {
      ...v,
      suggestions: [
        suggestion('x', { expiresAt: '2026-09-30T10:00:00.000Z' }),
        suggestion('y', { state: 'dismissed' }),
      ],
    }
    expect(nextTalkingPoint(stale, now)).toMatchObject({ kind: 'item', item: { id: 'c' } })
    expect(nextTalkingPoint(view({ items: [item('a', { status: 'covered' })] }), now)).toBeNull()
  })

  it('not covered yet appears at T-5 min, must-cover first', () => {
    const meeting = {
      eventUid: 'u',
      start: '2026-09-30T10:00:00.000Z',
      end: '2026-09-30T10:30:00.000Z',
      recurrenceId: null,
      meetingId: null,
      title: 't',
      calendar: null,
      recurring: false,
    }
    const v = view({
      agenda: agenda({ meeting }),
      items: [
        item('a', { order: 0 }),
        item('b', { order: 1, status: 'covered' }),
        item('c', { order: 2, kind: 'must-cover', status: 'in-progress' }),
      ],
    })
    expect(notCoveredYet(v, Date.parse('2026-09-30T10:24:59.000Z'))).toBeNull()
    expect(notCoveredYet(v, Date.parse('2026-09-30T10:25:00.000Z'))!.map((i) => i.id)).toEqual(['c', 'a'])
    expect(notCoveredYet(view(), now)).toBeNull()
  })

  it('interview split and attribution', () => {
    const v = view({
      items: [
        item('salary', { kind: 'info-to-get', status: 'covered', outcome: '90k' }),
        item('team', { kind: 'info-to-get', order: 1 }),
        item('chat', { order: 2 }),
      ],
    })
    expect(isInterview(v)).toBe(true)
    expect(isInterview(view())).toBe(false)
    const s = interviewSplit(v)
    expect(s.told.map((i) => i.id)).toEqual(['salary'])
    expect(s.notYet.map((i) => i.id)).toEqual(['team'])
    expect(attributionOf('agent:claude')).toEqual({ kind: 'agent', name: 'claude' })
    expect(attributionOf('tracker')).toEqual({ kind: 'tracker', name: null })
    expect(attributionOf('invitee:a@b.c')).toEqual({ kind: 'invitee', name: 'a@b.c' })
    expect(attributionOf('user')).toEqual({ kind: 'you', name: null })
  })

  it('counts, carry-over and active suggestions', () => {
    const v = view({
      agenda: agenda({
        meeting: {
          eventUid: 'u',
          start: T,
          end: null,
          recurrenceId: T,
          meetingId: null,
          title: 't',
          calendar: null,
          recurring: true,
        },
      }),
      items: [
        item('a', { status: 'covered' }),
        item('b', { order: 1, status: 'parked' }),
        item('c', { order: 2 }),
      ],
      suggestions: [suggestion('old'), suggestion('new', { createdAt: '2026-09-30T10:10:00.000Z' })],
    })
    expect(statusCounts(v.items)).toMatchObject({ covered: 1, parked: 1, open: 1 })
    expect(carriesOver(v).map((i) => i.id)).toEqual(['b', 'c'])
    expect(carriesOver(view())).toEqual([])
    expect(activeSuggestions(v, now).map((s) => s.id)).toEqual(['new', 'old'])
  })
})

describe('parseRecapOutcome', () => {
  it('reads the recap form and plain outcomes', () => {
    expect(parseRecapOutcome(null)).toEqual({ outcome: null, decisions: [], actions: [] })
    expect(parseRecapOutcome('approved at 40k')).toEqual({
      outcome: 'approved at 40k',
      decisions: [],
      actions: [],
    })
    expect(
      parseRecapOutcome(
        'Status: covered\nOutcome: Promo goes to the March cycle.\nDecisions:\n- March, not January\nActions:\n- Ana: send the packet by Friday\n- book the room',
      ),
    ).toEqual({
      outcome: 'Promo goes to the March cycle.',
      decisions: ['March, not January'],
      actions: [
        { owner: 'Ana', text: 'send the packet by Friday' },
        { owner: null, text: 'book the room' },
      ],
    })
  })
})
