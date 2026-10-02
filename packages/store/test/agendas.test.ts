import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type AgendaItemStatus,
  type AgendaMeeting,
  type ChangedBy,
  type DurableEventData,
  formatAgendaMarkdown,
  newId,
  AgendaItemStatus as Statuses,
  SuggestionKind,
} from '@gnomeola/protocol'
import { assertNoViolations, checkAgendaLog, checkEventLog } from '@gnomeola/testkit/invariants'
import { describe, expect, it } from 'vitest'
import { AgendaStore, Store, StoreError } from '../src/index.ts'
import { clock, randomHistory, replayed, series, setup } from './agenda-history.ts'

// Agendas in the store: one per occurrence, carry-over, forward-only statuses with the user's override
// and "manual wins", history, privacy, and — like everything else here — replay == state, byte for byte,
// over random histories that exercise every agenda event (and session deletion scrubbing evidence).

const agendaEvents = (s: Store) =>
  s
    .eventsAfter(0)
    .map((e) => e.data.type)
    .filter((t) => t.startsWith('agenda.'))

describe('agendas: one per occurrence, carry-over', () => {
  it('creates an agenda with items, and refuses a second one for the same occurrence', () => {
    const { a } = setup()
    const v = a.create({
      title: 'Weekly',
      meeting: series('2026-10-01T10:00:00.000Z'),
      goals: ['ship v2'],
      items: [
        { text: '  Promo   timeline ', kind: 'must-cover', owner: 'ana', timeboxMin: 10 },
        { text: 'Hiring' },
      ],
    })
    expect(v.agenda).toMatchObject({
      title: 'Weekly',
      goals: ['ship v2'],
      owner: 'me',
      private: false,
      version: 3,
    })
    expect(
      v.items.map((i) => [i.text, i.kind, i.owner, i.timeboxMin, i.order, i.status, i.createdBy]),
    ).toEqual([
      ['Promo timeline', 'must-cover', 'ana', 10, 0, 'open', 'user'],
      ['Hiring', 'topic', null, null, 1, 'open', 'user'],
    ])
    expect(() => a.create({ title: 'again', meeting: series('2026-10-01T10:00:00.000Z') })).toThrow(
      /already has an agenda/,
    )
    // a one-off is identified by its UID alone (moving it does not make a second occurrence)
    a.create({
      title: 'one-off',
      meeting: series('2026-10-02T10:00:00.000Z', { eventUid: 'once@x', recurring: false }),
    })
    expect(() =>
      a.create({
        title: 'moved',
        meeting: series('2026-10-03T10:00:00.000Z', { eventUid: 'once@x', recurring: false }),
      }),
    ).toThrow(StoreError)
  })

  it('carries over the unresolved items of the previous occurrence, reset to open', () => {
    const { a } = setup()
    const w1 = a.create({
      title: 'W1',
      meeting: series('2026-10-01T10:00:00.000Z'),
      items: [
        { text: 'open one' },
        { text: 'done', status: 'covered' },
        { text: 'skipped', status: 'skipped' },
      ],
    })
    const [open, done] = w1.items
    a.setStatus(w1.agenda.id, open!.id, { status: 'in-progress' })
    a.addItems(w1.agenda.id, [{ text: 'parked', status: 'parked', owner: 'bo', timeboxMin: 5 }])
    expect(done!.status).toBe('covered')
    const prev = a.previousOccurrence('weekly@x', '2026-10-08T10:00:00.000Z')
    expect(prev?.id).toBe(w1.agenda.id)
    const w2 = a.create({ title: 'W2', meeting: series('2026-10-08T10:00:00.000Z'), carryFrom: prev!.id })
    expect(w2.agenda.carriedFrom).toBe(w1.agenda.id)
    expect(w2.items.map((i) => [i.text, i.status, i.owner, i.timeboxMin])).toEqual([
      ['open one', 'open', null, null],
      ['parked', 'open', 'bo', 5],
    ])
    expect(w2.items.every((i) => i.carriedFrom?.agendaId === w1.agenda.id)).toBe(true)
    // the previous occurrence is untouched
    expect(a.items(w1.agenda.id).map((i) => i.status)).toEqual([
      'in-progress',
      'covered',
      'skipped',
      'parked',
    ])
  })
})

describe('agendas: statuses', () => {
  function withItem() {
    const x = setup()
    const v = x.a.create({ title: '1:1', items: [{ text: 'Promo timeline' }, { text: 'Budget' }] })
    return { ...x, id: v.agenda.id, item: v.items[0]!, other: v.items[1]! }
  }

  it('moves forward for anyone, and records who did it', () => {
    const { a, id, item } = withItem()
    const r1 = a.setStatus(id, item.id, {
      status: 'in-progress',
      by: 'tracker',
      evidence: [{ segmentId: 'seg_1', quote: 'so, the promo', confidence: 0.7 }],
    })
    expect(r1.change).toMatchObject({ from: 'open', to: 'in-progress', by: 'tracker', override: false })
    const r2 = a.setStatus(id, item.id, {
      status: 'covered',
      by: 'agent:claude',
      evidence: [{ segmentId: 'seg_2', quote: 'agreed: March', confidence: 0.92 }],
      auto: true,
      confidence: 0.92,
      outcome: 'launch in March',
    })
    expect(r2.item).toMatchObject({
      status: 'covered',
      changedBy: 'agent:claude',
      outcome: 'launch in March',
    })
    expect(r2.item.evidence.map((e) => e.segmentId)).toEqual(['seg_1', 'seg_2'])
    expect(a.history(id).map((c) => [c.from, c.to, c.by, c.auto])).toEqual([
      ['open', 'in-progress', 'tracker', false],
      ['in-progress', 'covered', 'agent:claude', true],
    ])
  })

  it('refuses backward moves by anyone but the user; the user overrides, and then manual wins', () => {
    const { a, id, item } = withItem()
    a.setStatus(id, item.id, { status: 'covered', by: 'tracker', auto: true })
    expect(() => a.setStatus(id, item.id, { status: 'open', by: 'tracker' })).toThrow(/only the user/)
    expect(() => a.setStatus(id, item.id, { status: 'skipped', by: 'agent:x' })).toThrow(/only the user/)
    // the user undoes the auto check-off
    const undo = a.setStatus(id, item.id, { status: 'open', note: 'not really' })
    expect(undo.change).toMatchObject({ from: 'covered', to: 'open', by: 'user', override: true })
    expect(undo.item.evidence).toEqual([])
    // …and the tracker may not re-cover it
    expect(() => a.setStatus(id, item.id, { status: 'covered', by: 'tracker' })).toThrow(/manual wins/)
    expect(() => a.setStatus(id, item.id, { status: 'in-progress', by: 'agent:claude' })).toThrow(
      /manual wins/,
    )
    // the user can still move it on, after which the forward-only rules apply as usual
    a.setStatus(id, item.id, { status: 'in-progress' })
    expect(a.setStatus(id, item.id, { status: 'covered', by: 'tracker' }).item.status).toBe('covered')
  })

  it('same status: no change recorded, but evidence and outcome are kept', () => {
    const { a, s, id, item } = withItem()
    const before = s.lastSeq()
    expect(a.setStatus(id, item.id, { status: 'open' }).change).toBeNull()
    expect(s.lastSeq()).toBe(before)
    a.setStatus(id, item.id, { status: 'in-progress', by: 'tracker' })
    const r = a.setStatus(id, item.id, {
      status: 'in-progress',
      by: 'tracker',
      evidence: [{ segmentId: 'seg_9', quote: 'more on promo', confidence: 0.6 }],
    })
    expect(r.change).toBeNull()
    expect(r.item.evidence).toHaveLength(1)
    expect(a.history(id)).toHaveLength(1)
  })

  it('bumps the version on every change; reorder must list every item once', () => {
    const { a, id, item, other } = withItem()
    const v0 = a.get(id)!.version
    a.updateItem(id, item.id, { kind: 'decision' })
    a.updateItem(id, item.id, { text: 'Promo timeline v2', owner: 'ana' })
    // a patch changes only what it names (an absent kind is not reset to the default)
    expect(a.item(id, item.id)).toMatchObject({ text: 'Promo timeline v2', owner: 'ana', kind: 'decision' })
    expect(a.get(id)!.version).toBe(v0 + 2)
    expect(a.reorder(id, [other.id, item.id])).toBe(v0 + 3)
    expect(a.items(id).map((i) => i.id)).toEqual([other.id, item.id])
    expect(() => a.reorder(id, [item.id])).toThrow(/exactly once/)
    a.addItems(id, [{ text: 'first' }], { before: other.id })
    expect(a.items(id).map((i) => [i.text, i.order])).toEqual([
      ['first', 0],
      ['Budget', 1],
      ['Promo timeline v2', 2],
    ])
    a.deleteItem(id, other.id)
    expect(a.items(id).map((i) => [i.text, i.order])).toEqual([
      ['first', 0],
      ['Promo timeline v2', 1],
    ])
  })
})

describe('agendas: suggestions, context, markdown', () => {
  it('accepting "looks covered" marks the item covered by whoever accepted', () => {
    const { a } = setup()
    const v = a.create({ title: 'x', items: [{ text: 'Budget' }] })
    const id = v.agenda.id
    const sug = a.addSuggestion(id, {
      kind: 'looks-covered',
      text: 'Budget sounds settled',
      itemId: v.items[0]!.id,
      source: 'tracker',
      ttlSec: 120,
    })
    expect(sug).toMatchObject({ state: 'open', source: 'tracker' })
    const r = a.resolveSuggestion(id, sug.id, 'accept')
    expect(r.suggestion.state).toBe('accepted')
    expect(r.item).toMatchObject({ status: 'covered', changedBy: 'user' })
    expect(() => a.resolveSuggestion(id, sug.id, 'dismiss')).toThrow(/already accepted/)
    const q = a.addSuggestion(id, { kind: 'question', text: 'ask about Q3', source: 'agent:claude' })
    expect(a.resolveSuggestion(id, q.id, 'dismiss').suggestion.state).toBe('dismissed')
  })

  it('context cards are private unless shared on purpose', () => {
    const { a } = setup()
    const id = a.create({ title: 'x' }).agenda.id
    const c = a.addContext(id, {
      title: 'Q3 numbers',
      body: '- revenue up 12%',
      source: { kind: 'path', ref: '/tmp/q3.md' },
    })
    expect(c.visibility).toBe('private')
    expect(a.updateContext(id, c.id, { visibility: 'shared', pinned: true })).toMatchObject({
      visibility: 'shared',
      pinned: true,
      createdAt: c.createdAt,
    })
    a.deleteContext(id, c.id)
    expect(a.context(id)).toEqual([])
  })

  it('importing the exported markdown is a no-op; editing it applies exactly the edits', () => {
    const { a, s } = setup()
    const v = a.create({
      title: '1:1',
      goals: ['agree dates'],
      items: [
        { text: 'Promo timeline', kind: 'must-cover', owner: 'ana', timeboxMin: 10 },
        { text: 'Budget', kind: 'decision', status: 'covered', outcome: 'approved' },
        { text: 'Offsite' },
      ],
    })
    const id = v.agenda.id
    const md = formatAgendaMarkdown({ title: v.agenda.title, goals: v.agenda.goals, items: a.items(id) })
    const seq = s.lastSeq()
    a.importMarkdown(id, md, a.get(id)!.version)
    expect(s.lastSeq()).toBe(seq)
    const edited = md
      .replace(
        '- [ ] Promo timeline (10m, @ana) [must-cover]',
        '- [~] Promo timeline (15m, @ana) [must-cover]',
      )
      .replace('- [ ] Offsite\n', '')
      .concat('- [ ] New thing (@bo)\n')
    const after = a.importMarkdown(id, edited, a.get(id)!.version)
    expect(after.items.map((i) => [i.text, i.status, i.timeboxMin, i.owner])).toEqual([
      ['Promo timeline', 'in-progress', 15, 'ana'],
      ['Budget', 'covered', null, null],
      ['New thing', 'open', null, 'bo'],
    ])
    expect(a.history(id).at(-1)).toMatchObject({ to: 'in-progress', by: 'user' })
    expect(() => a.importMarkdown(id, edited, 1)).toThrow(/export it again/)
  })
})

describe('agendas: privacy and session deletion', () => {
  it('hides private agendas and agendas of private sessions unless includePrivate', () => {
    const { s, a } = setup()
    const pub = a.create({ title: 'public' })
    const priv = a.create({ title: 'private', private: true })
    const linked = a.create({ title: 'linked' })
    const ses = s.createSession({ title: 'secret', private: true })
    a.attachSession(linked.agenda.id, ses.id)
    expect(a.list().map((x) => x.title)).toEqual(['public'])
    expect(
      a
        .list({ includePrivate: true })
        .map((x) => x.title)
        .sort(),
    ).toEqual(['linked', 'private', 'public'])
    expect(a.isVisible(a.get(linked.agenda.id)!)).toBe(false)
    expect(a.isVisible(a.get(pub.agenda.id)!)).toBe(true)
    expect(a.isVisible(a.get(priv.agenda.id)!, true)).toBe(true)
    // making the session public makes its agenda visible
    s.updateSession(ses.id, (x) => ({ ...x, private: false }))
    expect(
      a
        .list()
        .map((x) => x.title)
        .sort(),
    ).toEqual(['linked', 'public'])
    expect(a.list()[0]!.counts).toMatchObject({ items: 0 })
  })

  it('deleting the session unlinks the agenda and drops every quote from its transcript', () => {
    const { s, a } = setup()
    const v = a.create({ title: 'x', items: [{ text: 'Budget' }] })
    const ses = s.createSession({ title: 'rec' })
    a.attachSession(v.agenda.id, ses.id)
    a.setStatus(v.agenda.id, v.items[0]!.id, {
      status: 'covered',
      by: 'tracker',
      evidence: [{ segmentId: 'seg_1', quote: 'we approved 40k', confidence: 0.9 }],
    })
    s.deleteSession(ses.id)
    const after = a.view(v.agenda.id)!
    expect(after.agenda.sessionId).toBeNull()
    expect(after.items[0]!.evidence).toEqual([])
    expect(a.history(v.agenda.id)[0]!.evidence).toEqual([])
    expect(s.dump()).not.toContain('we approved 40k')
    expect(replayed(s).dump()).toBe(s.dump())
  })
})

describe('agendas: item history that restores', () => {
  it('records adds, edits, status changes, removals and imports, and outlives the item', () => {
    const { s, a } = setup()
    const v = a.create({ title: 'x', items: [{ text: 'Budget' }, { text: 'Hiring' }] })
    const id = v.items[0]!.id
    a.updateItem(v.agenda.id, id, { text: 'Budget (Q4)' }, 'agent:claude')
    a.setStatus(v.agenda.id, id, { status: 'covered', by: 'tracker' })
    const md = `- [ ] Budget (Q4) (10m)\n- [ ] From markdown\n`
    a.importMarkdown(v.agenda.id, md, a.get(v.agenda.id)!.version)
    // the import reopened Budget, timeboxed it, added one item and removed Hiring
    const kinds = (itemId: string) =>
      a.itemEvents(v.agenda.id, itemId).map((e) => [e.data.type, e.data.cause ?? null])
    expect(kinds(id)).toEqual([
      ['agenda.item.upserted', null],
      ['agenda.item.upserted', null],
      ['agenda.item.status', null],
      ['agenda.item.upserted', 'import'],
      ['agenda.item.status', 'import'],
    ])
    const hiring = a.itemEvents(v.agenda.id, v.items[1]!.id)
    const removed = hiring.at(-1)!.data
    expect(removed).toMatchObject({ type: 'agenda.item.deleted', by: 'user', cause: 'import' })
    expect(removed.type === 'agenda.item.deleted' && removed.item?.text).toBe('Hiring')
    expect(replayed(s).dump()).toBe(s.dump())
  })

  it('restores an edited item to an earlier version, and a removed one with its id and place', () => {
    const { s, a } = setup()
    const v = a.create({
      title: 'x',
      items: [{ text: 'A' }, { text: 'Budget', owner: 'ana' }, { text: 'C' }],
    })
    const id = v.items[1]!.id
    const first = a.itemEvents(v.agenda.id, id)[0]!
    a.updateItem(
      v.agenda.id,
      id,
      { text: 'Budget (Q4)', owner: null },
      'peer:ben@x.com/agent:claude' as never,
    )
    a.setStatus(v.agenda.id, id, { status: 'covered', by: 'tracker' })
    const back = a.restoreItem(v.agenda.id, id, first.seq)
    expect(back).toMatchObject({ id, text: 'Budget', owner: 'ana', status: 'open', changedBy: 'user' })
    // the restore is itself in the history, marked, and can be undone the same way
    const evs = a.itemEvents(v.agenda.id, id)
    expect(evs.slice(-2).map((e) => e.data.cause)).toEqual(['restore', 'restore'])
    const beforeRestore = evs.at(-3)!
    expect(a.restoreItem(v.agenda.id, id, beforeRestore.seq)).toMatchObject({
      text: 'Budget (Q4)',
      status: 'covered',
    })

    // removed, then put back: same id, same position
    a.deleteItem(v.agenda.id, id)
    expect(a.items(v.agenda.id).map((i) => i.text)).toEqual(['A', 'C'])
    const gone = a.itemEvents(v.agenda.id, id).at(-1)!
    const again = a.restoreItem(v.agenda.id, id, gone.seq)
    expect(again).toMatchObject({ id, text: 'Budget (Q4)', status: 'covered' })
    expect(a.items(v.agenda.id).map((i) => i.text)).toEqual(['A', 'Budget (Q4)', 'C'])
    expect(() => a.restoreItem(v.agenda.id, id, 999_999)).toThrow(/no version/)
    assertNoViolations(checkAgendaLog(s.eventsAfter(0)))
    assertNoViolations(checkEventLog(s.eventsAfter(0)))
    expect(replayed(s).dump()).toBe(s.dump())
  })
})

describe('agendas: replay == state', () => {
  const EVERY = [
    'agenda.upserted',
    'agenda.deleted',
    'agenda.item.upserted',
    'agenda.item.status',
    'agenda.item.deleted',
    'agenda.items.reordered',
    'agenda.context.upserted',
    'agenda.context.deleted',
    'agenda.suggestion.upserted',
  ] satisfies DurableEventData['type'][]

  it.each([1, 2, 3, 4, 5, 6])(
    'seed %i: a replayed log reproduces every agenda table byte for byte',
    (seed) => {
      const { s, applied } = randomHistory(seed, 400)
      expect([...applied].sort()).toEqual([...EVERY].sort())
      assertNoViolations(checkEventLog(s.eventsAfter(0)))
      assertNoViolations(checkAgendaLog(s.eventsAfter(0)), `seed ${seed}`)
      const copy = replayed(s)
      expect(copy.dump()).toBe(s.dump())
      expect(copy.dump()).toMatch(/agenda_item_history/)
      // and it keeps working after replay: the next change continues the sequence
      const a2 = new AgendaStore(copy)
      const v = a2.create({ title: 'after replay' })
      expect(v.agenda.version).toBe(1)
      expect(copy.lastSeq()).toBe(s.lastSeq() + 1)
    },
  )

  it('the tables survive closing and reopening the database (dump before == dump after)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gnomeola-agendas-'))
    try {
      const path = join(dir, 'db.sqlite')
      const now = clock()
      const s = Store.open(path, { now })
      const a = new AgendaStore(s).withClock(now)
      const v = a.create({ title: 'persisted', items: [{ text: 'one', status: 'covered' }] })
      a.addContext(v.agenda.id, { title: 'c', body: 'b' })
      const before = s.dump()
      const viewBefore = a.view(v.agenda.id)
      s.close()
      const again = Store.open(path)
      expect(again.dump()).toBe(before)
      expect(new AgendaStore(again).view(v.agenda.id)).toEqual(viewBefore)
      again.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('every status change is in the history, with the item as it was left', () => {
    const { a } = randomHistory(42, 500)
    for (const ag of a.list({ includePrivate: true, limit: 200 })) {
      const hist = a.history(ag.id)
      for (const item of a.items(ag.id)) {
        const mine = hist.filter((c) => c.itemId === item.id)
        if (mine.length) expect(mine.at(-1)!.to).toBe(item.status)
        for (let n = 1; n < mine.length; n++) expect(mine[n]!.from).toBe(mine[n - 1]!.to)
        for (const c of mine) if (c.by !== 'user') expect(c.override).toBe(false)
      }
    }
  })
})

describe('the agenda log invariant catches what the store refuses', () => {
  it('flags a backward automated move, an override after which the tracker acts, and a version skip', () => {
    const { a, s } = setup()
    const v = a.create({ title: 'x', items: [{ text: 'Budget' }] })
    a.setStatus(v.agenda.id, v.items[0]!.id, { status: 'covered', by: 'tracker' })
    a.setStatus(v.agenda.id, v.items[0]!.id, { status: 'open' })
    const log = s.eventsAfter(0)
    expect(checkAgendaLog(log)).toEqual([])
    const forged = structuredClone(log)
    // the user's override, rewritten as the tracker's
    const last = forged.at(-1)!.data as Extract<DurableEventData, { type: 'agenda.item.status' }>
    last.change.by = 'tracker'
    // …and a later tracker change on top of a genuine override
    const again = structuredClone(log.at(-1)!)
    const d = again.data as Extract<DurableEventData, { type: 'agenda.item.status' }>
    d.version += 1
    d.change = { ...d.change, from: 'open', to: 'in-progress', by: 'tracker', override: false }
    d.item = { ...d.item, status: 'in-progress' }
    const skipped = structuredClone(again)
    ;(skipped.data as { version: number }).version += 5
    expect(checkAgendaLog(forged).map((x) => x.rule)).toContain('forward-only')
    expect(checkAgendaLog([...log, again]).map((x) => x.rule)).toEqual(['manual-wins'])
    expect(checkAgendaLog([...log, skipped]).map((x) => x.rule)).toContain('version-steps')
  })
})

describe('ids', () => {
  it('agenda ids are time-prefixed like the rest', () => {
    const { a } = setup()
    expect(a.create({ title: 'x' }).agenda.id).toMatch(/^agd_[0-9a-z]{9}[0-9a-f]{12}$/)
    expect(newId('ses')).toMatch(/^ses_/)
  })
})
