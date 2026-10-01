import type { AgendaItem, AgendaView, ContextCard, StatusChange } from '@gnomeola/protocol'
import { SharePushBody } from '@gnomeola/protocol'
import { seededRandom } from '@gnomeola/testkit/daemon'
import { describe, expect, it } from 'vitest'
import { changeKey, memberOps, ownerOps } from '../src/agendas/share-projection.ts'

// The device side of the privacy boundary: over random agendas full of things that must not leave —
// evidence quotes and segment ids, status notes, private and agent cards, goals, suggestions, the
// session — what ownerOps / memberOps build contains none of them, is accepted by the server's strict
// push schema, and is idempotent (pushing what the server already has sends nothing).

const SECRET = 'ZZSECRETZZ'
const at = (n: number) => new Date(Date.parse('2026-10-01T10:00:00.000Z') + n * 1000).toISOString()

function randomView(seed: number): { view: AgendaView; history: StatusChange[] } {
  const rnd = seededRandom(seed)
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!
  const agendaId = `agd_${seed}`
  const items: AgendaItem[] = Array.from({ length: 3 + Math.floor(rnd() * 6) }, (_, n) => ({
    id: `itm_${seed}_${n}`,
    agendaId,
    text: `Item ${n}`,
    kind: pick(['topic', 'must-cover', 'info-to-get'] as const),
    owner: rnd() < 0.3 ? 'ana' : null,
    timeboxMin: rnd() < 0.3 ? 10 : null,
    order: n,
    status: pick(['open', 'in-progress', 'covered'] as const),
    evidence: [{ segmentId: `seg_${SECRET}_${n}`, quote: `${SECRET} said in the meeting`, confidence: 0.9 }],
    outcome: rnd() < 0.5 ? `Outcome ${n}` : null,
    changedBy: pick([
      'user',
      'tracker',
      'agent:claude',
      'peer:ben@example.com',
      'invitee:ivy@example.com',
    ] as const),
    createdBy: pick(['user', 'user', 'agent:claude', 'invitee:ivy@example.com'] as const),
    carriedFrom: rnd() < 0.2 ? { agendaId: 'agd_prev', itemId: `itm_prev_${n}` } : null,
    createdAt: at(n),
    updatedAt: at(n),
  }))
  const history: StatusChange[] = items.flatMap((i, n) =>
    Array.from({ length: Math.floor(rnd() * 3) }, (_, k) => ({
      itemId: i.id,
      from: 'open' as const,
      to: 'in-progress' as const,
      by: pick([
        'user',
        'tracker',
        'agent:claude',
        'peer:ben@example.com/tracker',
        'invitee:ivy@example.com',
      ] as const),
      at: at(100 + n * 10 + k),
      note: `${SECRET} note`,
      evidence: [{ segmentId: `seg_${SECRET}`, quote: `${SECRET} quote`, confidence: 0.8 }],
      override: false,
      auto: rnd() < 0.5,
      confidence: 0.8,
    })),
  )
  const card = (
    n: number,
    visibility: 'private' | 'shared',
    createdBy: ContextCard['createdBy'],
  ): ContextCard => ({
    id: `ctx_${seed}_${n}`,
    agendaId,
    title: visibility === 'private' ? `${SECRET} private` : `Shared ${n}`,
    body: visibility === 'private' || createdBy !== 'user' ? `${SECRET} body` : 'Public body',
    source:
      rnd() < 0.5
        ? { kind: 'path', ref: `/home/me/${SECRET}.md` }
        : { kind: 'url', ref: 'https://wiki.example/x' },
    visibility,
    pinned: rnd() < 0.5,
    createdBy,
    createdAt: at(0),
    updatedAt: at(0),
  })
  const view: AgendaView = {
    agenda: {
      id: agendaId,
      title: 'Team sync',
      meeting: {
        eventUid: 'team@x',
        start: at(0),
        end: at(3600),
        recurrenceId: at(0),
        meetingId: 'mtg_x',
        title: 'Team sync',
        calendar: `${SECRET} calendar`,
        recurring: true,
      },
      sessionId: `ses_${SECRET}`,
      owner: 'me',
      goals: [`${SECRET} goal`],
      private: false,
      carriedFrom: null,
      version: 9,
      createdAt: at(0),
      updatedAt: at(0),
    },
    items,
    context: [
      card(1, 'private', 'user'),
      card(2, 'shared', 'user'),
      card(3, 'private', 'agent:claude'),
      card(4, 'shared', 'tracker'),
    ],
    suggestions: [
      {
        id: 'sug_1',
        agendaId,
        kind: 'looks-covered',
        text: `${SECRET} suggestion`,
        itemId: items[0]!.id,
        source: 'tracker',
        createdAt: at(0),
        expiresAt: null,
        state: 'open',
        resolvedAt: null,
        resolvedBy: null,
      },
    ],
  }
  // the shared card's body is the only card text that may leave
  return { view, history }
}

describe('share projection: what a device sends', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`seed ${seed}: nothing private leaves; the server's strict schema accepts it; re-pushing sends nothing new`, () => {
      const { view, history } = randomView(seed)
      const p = {
        occurrence: view.agenda.id,
        view,
        history,
        seenRemote: new Set<string>(),
        recapShared: seed % 2 === 0,
      }
      const ops = ownerOps(p, { server: null, current: true, shareGoals: false, pushed: new Set() })
      const wire = JSON.stringify(ops)
      expect(wire).not.toContain(SECRET)
      expect(wire).not.toMatch(/"evidence"|"quote"|"note"|"segmentId"|"sessionId"|"calendar"/)
      expect(SharePushBody.safeParse({ ops }).success).toBe(true)
      // statuses: only this device's own authors, each once
      const statuses = ops.filter((o) => o.op === 'status')
      const own = history.filter((c) => c.by === 'user' || c.by === 'tracker' || c.by.startsWith('agent:'))
      expect(statuses.map((o) => o.key).sort()).toEqual(own.map((c) => changeKey(view.agenda.id, c)).sort())
      // outcomes only with the recap shared; the shared card made by the user, nothing else
      expect(ops.some((o) => o.op === 'outcome')).toBe(
        p.recapShared && view.items.some((i) => i.outcome !== null),
      )
      expect(ops.flatMap((o) => (o.op === 'card' ? [o.card.title] : []))).toEqual(['Shared 2'])
      // with goals opted in, the goals (and only they) are added
      const withGoals = JSON.stringify(
        ownerOps(p, { server: null, current: true, shareGoals: true, pushed: new Set() }),
      )
      expect(withGoals).toContain(`${SECRET} goal`)
      expect(withGoals.replaceAll(`${SECRET} goal`, '')).not.toContain(SECRET)
      // a member's projection: only items it created and its own changes
      const member = memberOps(p, {
        server: {
          share: {} as never,
          items: [],
          cards: [],
          comments: [],
          participants: [],
          you: {} as never,
        },
        me: 'spt_me',
        pushed: new Set(),
      })
      expect(JSON.stringify(member)).not.toContain(SECRET)
      expect(member.every((o) => o.op === 'item' || o.op === 'status')).toBe(true)
      for (const o of member)
        if (o.op === 'item')
          expect(['user', 'agent:claude']).toContain(view.items.find((i) => i.id === o.item.id)!.createdBy)
      // after a push everything is known: the next round only resends what changed (nothing)
      const pushed = new Set(statuses.map((o) => o.key))
      expect(
        ownerOps(p, { server: null, current: true, shareGoals: false, pushed }).filter(
          (o) => o.op === 'status',
        ),
      ).toEqual([])
    })
  }
})
