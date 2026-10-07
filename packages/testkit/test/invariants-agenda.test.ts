import type { DurableEvent } from '@kacola/protocol'
import { describe, expect, it } from 'vitest'
import { checkAgendaLog, checkAgentLog } from '../src/invariants/index.ts'

// checkAgendaLog / checkAgentLog are the independent readers the agenda, tracker, agent-channel and
// team-sharing suites lean on. These tests pin every rule directly, each with a clean log that passes and
// the smallest log that breaks it — so a check that quietly stopped checking fails here first.

let seq = 0
const ev = (data: Record<string, unknown>): DurableEvent =>
  ({ seq: ++seq, at: '2026-10-01T10:00:00.000Z', sessionId: null, data }) as unknown as DurableEvent

const A = 'agd_1'
const upsertAgenda = (version: number) => ev({ type: 'agenda.upserted', agenda: { id: A, version } })
const upsertItem = (version: number, status: string, extra: Record<string, unknown> = {}) =>
  ev({ type: 'agenda.item.upserted', agendaId: A, version, item: { id: 'itm_1', status, ...extra } })
const change = (
  version: number,
  from: string,
  to: string,
  by: string,
  o: { override?: boolean; evidence?: { segmentId?: string; quote?: string }[]; itemStatus?: string } = {},
) =>
  ev({
    type: 'agenda.item.status',
    agendaId: A,
    version,
    change: {
      itemId: 'itm_1',
      from,
      to,
      by,
      override: o.override ?? false,
      evidence: o.evidence ?? [],
    },
    item: { id: 'itm_1', status: o.itemStatus ?? to },
  })
const rules = (events: DurableEvent[]) => checkAgendaLog(events).map((x) => x.rule)

describe('checkAgendaLog', () => {
  it('accepts a clean history: forward changes by anyone, a user override, then the user again', () => {
    expect(
      rules([
        upsertAgenda(1),
        upsertItem(2, 'open'),
        change(3, 'open', 'in-progress', 'tracker'),
        change(4, 'in-progress', 'covered', 'agent:claude', { evidence: [{ segmentId: 'seg_1' }] }),
        change(5, 'covered', 'open', 'user', { override: true }),
        change(6, 'open', 'covered', 'user'),
        change(7, 'covered', 'covered', 'user', { override: true }), // not forward → an override
        ev({ type: 'agenda.suggestion.upserted', suggestion: {} }), // unversioned: ignored
        ev({ type: 'agenda.item.deleted', agendaId: A, version: 8, itemId: 'itm_1' }),
      ]),
    ).toEqual([])
  })

  it('agenda-exists: a scoped event for an agenda the log never created (or deleted)', () => {
    expect(rules([upsertItem(1, 'open')])).toEqual(['agenda-exists'])
    expect(
      rules([upsertAgenda(1), ev({ type: 'agenda.deleted', agendaId: A }), upsertItem(2, 'open')]),
    ).toEqual(['agenda-exists'])
  })

  it('version-steps: every scoped event raises the version by exactly one', () => {
    expect(rules([upsertAgenda(1), upsertItem(3, 'open')])).toEqual(['version-steps'])
    expect(rules([upsertAgenda(1), upsertItem(1, 'open')])).toEqual(['version-steps'])
    expect(rules([upsertAgenda(1), upsertItem(2, 'open'), upsertItem(3, 'open')])).toEqual([])
  })

  it('status-only-by-change: an item upsert may not move the status', () => {
    expect(rules([upsertAgenda(1), upsertItem(2, 'open'), upsertItem(3, 'covered')])).toEqual([
      'status-only-by-change',
    ])
  })

  it('change-continuity: a change starts from the status the item was left in', () => {
    expect(
      rules([upsertAgenda(1), upsertItem(2, 'open'), change(3, 'in-progress', 'covered', 'user')]),
    ).toEqual(['change-continuity'])
  })

  it('override-flag: exactly the non-forward moves are overrides', () => {
    expect(
      rules([
        upsertAgenda(1),
        upsertItem(2, 'open'),
        change(3, 'open', 'covered', 'user', { override: true }),
      ]),
    ).toEqual(['override-flag'])
    expect(rules([upsertAgenda(1), upsertItem(2, 'covered'), change(3, 'covered', 'open', 'user')])).toEqual([
      'override-flag',
    ])
  })

  it('forward-only: the tracker and agents never move an item back or sideways', () => {
    expect(
      rules([
        upsertAgenda(1),
        upsertItem(2, 'covered'),
        change(3, 'covered', 'open', 'tracker', { override: true }),
      ]),
    ).toEqual(['forward-only'])
    expect(
      rules([
        upsertAgenda(1),
        upsertItem(2, 'skipped'),
        change(3, 'skipped', 'covered', 'agent:claude', { override: true, evidence: [{ segmentId: 's' }] }),
      ]),
    ).toEqual(['forward-only'])
  })

  it('manual-wins: after the user overrides an item, automation leaves it alone until the user moves it again', () => {
    const base = [
      upsertAgenda(1),
      upsertItem(2, 'covered'),
      change(3, 'covered', 'open', 'user', { override: true }),
    ]
    expect(rules([...base, change(4, 'open', 'in-progress', 'tracker')])).toEqual(['manual-wins'])
    // the user moving it forward again releases the lock
    expect(
      rules([
        ...base,
        change(4, 'open', 'in-progress', 'user'),
        change(5, 'in-progress', 'covered', 'tracker'),
      ]),
    ).toEqual([])
    // deleting and recreating the item forgets the lock too
    expect(
      rules([
        ...base,
        ev({ type: 'agenda.item.deleted', agendaId: A, version: 4, itemId: 'itm_1' }),
        upsertItem(5, 'open'),
        change(6, 'open', 'in-progress', 'tracker'),
      ]),
    ).toEqual([])
  })

  it('peers: mirror the server either way, carry no evidence, and a peer in person locks like the user', () => {
    const base = [upsertAgenda(1), upsertItem(2, 'covered')]
    expect(rules([...base, change(3, 'covered', 'open', 'peer:ben', { override: true })])).toEqual([])
    expect(rules([...base, change(3, 'covered', 'open', 'peer:ben/tracker', { override: true })])).toEqual([]) // a peer's tracker, already judged by the server, may move back here
    expect(
      rules([
        upsertAgenda(1),
        upsertItem(2, 'open'),
        change(3, 'open', 'covered', 'peer:ben/agent:claude', { evidence: [{ segmentId: 'seg_1' }] }),
      ]),
    ).toEqual(['peer-no-evidence'])
    // a peer in person locks the item; a peer's tracker does not
    expect(
      rules([
        ...base,
        change(3, 'covered', 'open', 'peer:ben', { override: true }),
        change(4, 'open', 'in-progress', 'tracker'),
      ]),
    ).toEqual(['manual-wins'])
    expect(
      rules([
        ...base,
        change(3, 'covered', 'open', 'peer:ben/tracker', { override: true }),
        change(4, 'open', 'in-progress', 'tracker'),
      ]),
    ).toEqual([])
  })

  it('item-matches-change: the item carried by a status change shows the new status', () => {
    expect(
      rules([
        upsertAgenda(1),
        upsertItem(2, 'open'),
        change(3, 'open', 'covered', 'user', { itemStatus: 'open' }),
      ]),
    ).toEqual(['item-matches-change'])
  })

  it('details name the item and both sides', () => {
    const [x] = checkAgendaLog([
      upsertAgenda(1),
      upsertItem(2, 'open'),
      change(3, 'in-progress', 'covered', 'user'),
    ])
    expect(x).toEqual({ rule: 'change-continuity', detail: 'itm_1: was open, change says in-progress' })
  })
})

const agentRules = (events: DurableEvent[]) => checkAgentLog(events).map((x) => x.rule)

describe('checkAgentLog', () => {
  it('accepts what a well-behaved agent leaves behind', () => {
    expect(
      agentRules([
        ev({
          type: 'agenda.context.upserted',
          card: { id: 'c1', createdBy: 'agent:claude', visibility: 'private' },
        }),
        ev({ type: 'agenda.context.upserted', card: { id: 'c2', createdBy: 'user', visibility: 'shared' } }),
        change(1, 'open', 'covered', 'agent:claude', { evidence: [{ segmentId: 'seg_1' }] }),
        change(2, 'open', 'covered', 'user'), // the user needs no evidence
        change(3, 'open', 'in-progress', 'agent:claude'), // only check-offs need a citation
        ev({
          type: 'agenda.item.upserted',
          item: {
            id: 'i',
            status: 'open',
            createdBy: 'agent:claude',
            changedBy: 'agent:claude',
            createdAt: 't',
            updatedAt: 't',
          },
        }),
        ev({
          type: 'agenda.item.upserted', // later moved on by its own status changes: not "added as covered"
          item: {
            id: 'i',
            status: 'covered',
            createdBy: 'agent:claude',
            changedBy: 'agent:claude',
            createdAt: 't',
            updatedAt: 'u',
          },
        }),
        ev({
          type: 'agenda.suggestion.upserted',
          suggestion: {
            id: 's1',
            state: 'accepted',
            resolvedBy: 'user',
            proposal: { kind: 'status', evidence: [{ segmentId: 'seg_1' }] },
          },
        }),
        ev({ type: 'agenda.suggestion.upserted', suggestion: { id: 's2', state: 'open', resolvedBy: null } }),
      ]),
    ).toEqual([])
  })

  it('agent-card-private: an agent may only write private context cards', () => {
    expect(
      agentRules([
        ev({
          type: 'agenda.context.upserted',
          card: { id: 'c1', createdBy: 'agent:claude', visibility: 'shared' },
        }),
      ]),
    ).toEqual(['agent-card-private'])
  })

  it('agent-checkoff-evidence: an agent check-off cites at least one segment', () => {
    expect(agentRules([change(1, 'open', 'covered', 'agent:claude')])).toEqual(['agent-checkoff-evidence'])
    expect(
      agentRules([change(1, 'open', 'covered', 'agent:claude', { evidence: [{ quote: 'no id' }] })]),
    ).toEqual(['agent-checkoff-evidence'])
  })

  it('agent-items-open: an item an agent adds starts open', () => {
    expect(
      agentRules([
        ev({
          type: 'agenda.item.upserted',
          item: {
            id: 'i',
            status: 'covered',
            createdBy: 'agent:claude',
            changedBy: 'agent:claude',
            createdAt: 't',
            updatedAt: 't',
          },
        }),
      ]),
    ).toEqual(['agent-items-open'])
    // the user editing an agent's item is not the agent adding it
    expect(
      agentRules([
        ev({
          type: 'agenda.item.upserted',
          item: {
            id: 'i',
            status: 'covered',
            createdBy: 'agent:claude',
            changedBy: 'user',
            createdAt: 't',
            updatedAt: 't',
          },
        }),
      ]),
    ).toEqual([])
  })

  it('proposal-no-words: a status proposal keeps segment ids but never transcript text', () => {
    expect(
      agentRules([
        ev({
          type: 'agenda.suggestion.upserted',
          suggestion: {
            id: 's',
            state: 'open',
            proposal: { kind: 'status', evidence: [{ segmentId: 'seg_1', quote: 'we ship friday' }] },
          },
        }),
      ]),
    ).toEqual(['proposal-no-words'])
    // a quote without a segment id is not transcript text from the log
    expect(
      agentRules([
        ev({
          type: 'agenda.suggestion.upserted',
          suggestion: {
            id: 's',
            state: 'open',
            proposal: { kind: 'status', evidence: [{ quote: 'typed by the agent' }] },
          },
        }),
      ]),
    ).toEqual([])
  })

  it('user-resolves: only the user accepts or dismisses a suggestion', () => {
    expect(
      agentRules([
        ev({
          type: 'agenda.suggestion.upserted',
          suggestion: { id: 's', state: 'dismissed', resolvedBy: 'agent:claude' },
        }),
      ]),
    ).toEqual(['user-resolves'])
  })
})
