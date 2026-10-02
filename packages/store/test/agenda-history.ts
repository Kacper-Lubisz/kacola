import {
  type AgendaItemStatus,
  type AgendaMeeting,
  type ChangedBy,
  AgendaItemStatus as Statuses,
  SuggestionKind,
} from '@gnomeola/protocol'
import { pick, randInt, seededRandom } from '@gnomeola/testkit/daemon'
import { AgendaStore, Store, StoreError } from '../src/index.ts'

// Shared by the agenda store tests and the cross-dialect test: a deterministic clock, a recurring
// meeting, and a random history over every agenda operation.

export function clock(start = Date.parse('2026-10-01T09:00:00.000Z')) {
  let t = start
  return () => {
    t += 1000
    return new Date(t)
  }
}

export function setup() {
  const now = clock()
  const s = Store.open(':memory:', { now })
  const a = new AgendaStore(s).withClock(now)
  return { s, a, now }
}

export const replayed = (s: Store) => {
  const dst = Store.open(':memory:')
  dst.replay(s.eventsAfter(0), 13)
  return dst
}

export const series = (start: string, over: Partial<AgendaMeeting> = {}): AgendaMeeting => ({
  eventUid: 'weekly@x',
  start,
  end: null,
  recurrenceId: start,
  meetingId: null,
  title: 'Weekly',
  calendar: 'Work',
  recurring: true,
  ...over,
})

const BYS: ChangedBy[] = ['user', 'user', 'tracker', 'agent:claude', 'invitee:ana@example.com']

/** A random history over every agenda operation, tolerating the refusals the rules make. */
export function randomHistory(seed: number, steps: number) {
  const rnd = seededRandom(seed)
  const { s, a } = setup()
  const sessions: string[] = []
  const agendas: string[] = []
  const applied = new Set<string>()
  const tryIt = (f: () => void) => {
    try {
      f()
    } catch (err) {
      if (!(err instanceof StoreError)) throw err
    }
  }
  for (let i = 0; i < steps; i++) {
    const op = randInt(rnd, 0, 17)
    const ag = agendas.length ? pick(rnd, agendas) : null
    const items = ag ? a.items(ag) : []
    const item = items.length ? pick(rnd, items) : null
    tryIt(() => {
      switch (op) {
        case 0:
        case 1: {
          const recurring = rnd() < 0.5
          const day = randInt(rnd, 1, 9)
          const start = `2026-10-0${day}T10:00:00.000Z`
          const prev = recurring ? a.previousOccurrence('weekly@x', start) : null
          const v = a.create({
            title: `agenda ${i}`,
            meeting:
              rnd() < 0.7
                ? series(start, recurring ? {} : { eventUid: `one-${i}@x`, recurring: false })
                : null,
            private: rnd() < 0.2,
            goals: rnd() < 0.5 ? ['g'] : [],
            items: Array.from({ length: randInt(rnd, 0, 3) }, (_, n) => ({
              text: `item ${i}.${n}`,
              status: pick(rnd, Statuses.options),
            })),
            carryFrom: prev?.id ?? null,
          })
          agendas.push(v.agenda.id)
          break
        }
        case 2:
          if (ag)
            a.addItems(ag, [{ text: `added ${i}`, kind: 'question', owner: 'ana', timeboxMin: 5 }], {
              before: item && rnd() < 0.5 ? item.id : undefined,
              by: pick(rnd, BYS),
            })
          break
        case 3:
        case 4:
        case 5:
          if (ag && item)
            a.setStatus(ag, item.id, {
              status: pick(rnd, Statuses.options) as AgendaItemStatus,
              by: pick(rnd, BYS),
              evidence:
                rnd() < 0.6 ? [{ segmentId: `seg_${i}`, quote: `quote ${i}`, confidence: rnd() }] : [],
              note: rnd() < 0.3 ? 'note' : undefined,
              outcome: rnd() < 0.3 ? `outcome ${i}` : undefined,
              auto: rnd() < 0.3,
            })
          break
        case 6:
          if (ag && item) a.updateItem(ag, item.id, { text: `edited ${i}`, owner: rnd() < 0.5 ? null : 'bo' })
          break
        case 7:
          if (ag && item && rnd() < 0.5) a.deleteItem(ag, item.id, i % 3 ? 'user' : 'tracker')
          else if (ag) {
            // restore some item (possibly a removed one) to some earlier version (no rnd(): the other
            // seeds' histories stay as they were)
            const evs = a.itemEvents(ag)
            if (evs.length) {
              const e = evs[i % evs.length]!
              a.restoreItem(ag, e.data.type === 'agenda.item.deleted' ? e.data.itemId : e.data.item.id, e.seq)
            }
          }
          break
        case 8:
          if (ag && items.length > 1) a.reorder(ag, [...items.map((x) => x.id)].reverse())
          break
        case 9:
          if (ag)
            a.addContext(ag, {
              title: `ctx ${i}`,
              body: `body ${i}`,
              visibility: rnd() < 0.5 ? 'shared' : 'private',
            })
          break
        case 10: {
          const cards = ag ? a.context(ag) : []
          if (ag && cards.length) {
            const c = pick(rnd, cards)
            if (rnd() < 0.5) a.updateContext(ag, c.id, { body: `edited ${i}`, pinned: true })
            else a.deleteContext(ag, c.id)
          }
          break
        }
        case 11:
          if (ag)
            a.addSuggestion(ag, {
              kind: pick(rnd, SuggestionKind.options),
              text: `suggest ${i}`,
              itemId: item?.id ?? null,
              source: pick(rnd, ['tracker', 'agent:claude'] as const),
              ttlSec: 60,
            })
          break
        case 12: {
          const open = ag ? a.suggestions(ag).filter((x) => x.state === 'open') : []
          if (ag && open.length)
            a.resolveSuggestion(ag, pick(rnd, open).id, rnd() < 0.5 ? 'accept' : 'dismiss')
          break
        }
        case 13:
          sessions.push(s.createSession({ title: `s${i}`, private: rnd() < 0.3 }).id)
          break
        case 14:
          if (ag && sessions.length) a.attachSession(ag, pick(rnd, sessions))
          break
        case 15:
          if (sessions.length && rnd() < 0.4) {
            const sid = sessions.splice(randInt(rnd, 0, sessions.length - 1), 1)[0]!
            s.deleteSession(sid)
          }
          break
        case 16:
          if (ag) a.update(ag, (x) => ({ title: `${x.title}!`, private: rnd() < 0.3, goals: ['a', 'b'] }))
          break
        case 17:
          if (ag && rnd() < 0.15) {
            a.delete(ag)
            agendas.splice(agendas.indexOf(ag), 1)
          }
          break
      }
    })
  }
  for (const t of agendaEvents(s)) applied.add(t)
  return { s, a, applied }
}

const agendaEvents = (s: Store) =>
  s
    .eventsAfter(0)
    .map((e) => e.data.type)
    .filter((t) => t.startsWith('agenda.'))
