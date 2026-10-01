import type { DurableEvent, SharedChange, SharedItem } from '@gnomeola/protocol'
import { assertNoViolations, checkEventLog } from '@gnomeola/testkit/invariants'
import { describe, expect, it } from 'vitest'
import { decideIngest } from '../src/domain.ts'
import { SqliteStoreApi } from '../src/index.ts'
import * as shares from '../src/shares.ts'
import { randomShareHistory, sha } from './share-history.ts'

// Team sharing in the store: the merge rule as a table, then random multi-device histories checked
// independently of the planner — every submitted change recorded exactly once with an outcome that
// follows the rules, items equal to the fold of their applied changes, nothing lost, revocation purging
// everything, no secret in any event — and replay == state.

const RANK = { open: 0, 'in-progress': 1, covered: 2, skipped: 2, parked: 2 } as const
const item = (
  status: SharedItem['status'],
  lock: SharedItem['lock'] = null,
  statusAt: string | null = null,
) => ({
  status,
  lock,
  statusAt,
})
const T0 = '2026-10-01T10:00:00.000Z'
const T1 = '2026-10-01T10:05:00.000Z'

describe('decideSharedStatus: the merge rule', () => {
  it.each([
    // [item, change, outcome, resulting status, lock]
    [
      item('open'),
      { role: 'member', by: 'tracker', to: 'in-progress', at: T1 },
      'applied',
      'in-progress',
      null,
    ],
    [
      item('covered'),
      { role: 'owner', by: 'tracker', to: 'in-progress', at: T1 },
      'refused',
      'covered',
      null,
    ],
    [item('covered'), { role: 'member', by: 'agent:claude', to: 'open', at: T1 }, 'refused', 'covered', null],
    [item('covered'), { role: 'member', by: 'user', to: 'open', at: T1 }, 'applied', 'open', 'member'],
    [item('covered'), { role: 'owner', by: 'user', to: 'open', at: T1 }, 'applied', 'open', 'owner'],
    // the owner's override wins over everyone else, people included
    [
      item('open', 'owner', T0),
      { role: 'member', by: 'user', to: 'covered', at: T1 },
      'refused',
      'open',
      'owner',
    ],
    [
      item('open', 'owner', T0),
      { role: 'owner', by: 'tracker', to: 'covered', at: T1 },
      'refused',
      'open',
      'owner',
    ],
    [
      item('open', 'member', T0),
      { role: 'owner', by: 'tracker', to: 'covered', at: T1 },
      'refused',
      'open',
      'member',
    ],
    // a person's forward move clears a lock of their standing or lower
    [
      item('open', 'member', T0),
      { role: 'owner', by: 'user', to: 'covered', at: T1 },
      'applied',
      'covered',
      null,
    ],
    [
      item('open', 'member', T0),
      { role: 'member', by: 'user', to: 'covered', at: T1 },
      'applied',
      'covered',
      null,
    ],
    // latest wins between people: an override older than the applied status is superseded
    [
      item('covered', null, T1),
      { role: 'member', by: 'user', to: 'open', at: T0 },
      'superseded',
      'covered',
      null,
    ],
    [
      item('covered', 'owner', T1),
      { role: 'owner', by: 'user', to: 'skipped', at: T0 },
      'superseded',
      'covered',
      'owner',
    ],
    [
      item('covered', 'owner', T0),
      { role: 'owner', by: 'user', to: 'skipped', at: T1 },
      'applied',
      'skipped',
      'owner',
    ],
    [item('covered'), { role: 'member', by: 'tracker', to: 'covered', at: T1 }, 'agreed', 'covered', null],
    [item('open'), { role: 'invitee', by: 'invitee:i@x.co', to: 'covered', at: T1 }, 'refused', 'open', null],
  ] as const)('%o + %o → %s', (it0, c, outcome, status, lock) => {
    const d = shares.decideSharedStatus(it0, c)
    expect([d.outcome, d.status, d.lock]).toEqual([outcome, status, lock])
    if (d.outcome !== 'applied' && d.outcome !== 'agreed') expect(d.reason).toBeTruthy()
  })
})

/** The share.* events of a log, in order. */
const shareEvents = (log: DurableEvent[]) => log.filter((e) => e.data.type.startsWith('share.'))

/** Independent checks over the recorded history (not a re-run of the planner). */
function checkShareLog(log: DurableEvent[]): string[] {
  const v: string[] = []
  const status = new Map<string, string>()
  const lock = new Map<string, string | null>()
  const at = new Map<string, string | null>()
  const keys = new Set<string>()
  for (const e of shareEvents(log)) {
    const d = e.data
    if (d.type === 'share.item.upserted') {
      const prev = status.get(d.item.id)
      if (prev !== undefined && prev !== d.item.status)
        v.push(`${d.item.id}: an upsert moved the status ${prev} -> ${d.item.status}`)
      status.set(d.item.id, d.item.status)
      lock.set(d.item.id, d.item.lock)
      at.set(d.item.id, d.item.statusAt)
    } else if (d.type === 'share.item.deleted') status.delete(d.itemId)
    else if (d.type === 'share.change') {
      const c: SharedChange = d.change
      const k = `${c.actor.participantId}|${c.key}`
      if (keys.has(k)) v.push(`${k}: recorded twice`)
      keys.add(k)
      const was = status.get(c.itemId)
      if (was !== c.before) v.push(`${c.itemId}: change says before=${c.before}, item was ${was}`)
      const p = shares.standing(c.actor.role, c.actor.by)
      const lp = { owner: 3, member: 2 }[lock.get(c.itemId) ?? ''] ?? 0
      if (c.outcome === 'applied') {
        if (!d.item || d.item.status !== c.to || c.after !== c.to)
          v.push(`${c.itemId}: applied but the item is not ${c.to}`)
        if (p < lp) v.push(`${c.itemId}: ${c.actor.by} (${p}) applied over a lock (${lp})`)
        const forward = RANK[c.to] > RANK[c.before]
        if (!forward && p === 1) v.push(`${c.itemId}: automated ${c.actor.by} moved it backwards`)
        if (!forward && at.get(c.itemId) && c.at < at.get(c.itemId)!)
          v.push(`${c.itemId}: an older override won`)
        status.set(c.itemId, c.to)
        lock.set(c.itemId, d.item?.lock ?? null)
        at.set(c.itemId, d.item?.statusAt ?? null)
      } else {
        if (d.item) v.push(`${c.itemId}: ${c.outcome} change carried an item`)
        if (c.after !== c.before) v.push(`${c.itemId}: ${c.outcome} change moved it`)
        if (c.outcome === 'agreed' && c.to !== c.before)
          v.push(`${c.itemId}: agreed but to=${c.to}, was ${c.before}`)
        if (c.outcome === 'refused' && !c.reason) v.push(`${c.itemId}: refused without a reason`)
      }
    } else if (d.type === 'share.revoked') {
      status.clear()
      keys.clear()
    }
  }
  return v
}

describe('team sharing: random multi-device histories', () => {
  for (const seed of [1, 2, 3, 4]) {
    it(`seed ${seed}: every change recorded once, by the rules; nothing lost; replay == state`, async () => {
      const s = SqliteStoreApi.open(':memory:')
      const h = await randomShareHistory(s, seed, 300)
      const log = await s.eventsAfter(0)
      assertNoViolations(checkEventLog(log))
      expect(checkShareLog(log)).toEqual([])
      const snap = await s.snapshot()
      // nothing silently lost: every distinct pushed change has exactly one record
      const distinct = new Set(h.pushed.map((p) => `${p.actor}|${p.key}`))
      expect(snap.shareChanges.length).toBe(distinct.size)
      expect(new Set(snap.shareChanges.map((c) => `${c.actor.participantId}|${c.key}`))).toEqual(distinct)
      const outcomes = new Set(snap.shareChanges.map((c) => c.outcome))
      for (const o of ['applied', 'refused', 'agreed']) expect(outcomes, o).toContain(o)
      // items are the fold of their applied changes
      for (const i of snap.shareItems) {
        const last = snap.shareChanges.filter((c) => c.itemId === i.id && c.outcome === 'applied').at(-1)
        expect(i.status, i.id).toBe(last?.to ?? 'open')
        if (last) expect(i.changedBy, i.id).toEqual(last.actor)
      }
      // a carried-over item keeps who added it
      for (const i of snap.shareItems.filter((x) => x.carriedFrom)) {
        const orig = snap.shareItems.find((x) => x.id === i.carriedFrom!.itemId)
        if (orig) expect(i.createdBy, i.id).toEqual(orig.createdBy)
      }
      // outcomes only while the recap is shared
      for (const occ of snap.shares[0]!.occurrences.filter((o) => !o.recapShared))
        expect(snap.shareItems.filter((i) => i.occurrence === occ.agendaId && i.outcome !== null)).toEqual([])
      // no secret ever reaches the log: the link token, codes and participant tokens are hashed bookkeeping
      const text = JSON.stringify(log)
      for (const secret of [h.linkHash, sha('token-ana@example.com'), 'CODE15', 'CODE16'])
        expect(text).not.toContain(secret)
      // replay == state
      const r = SqliteStoreApi.open(':memory:')
      await r.replay(log, 37)
      expect(await r.snapshot()).toEqual(snap)
      expect(r.store.dump()).toBe(s.store.dump())
    })
  }

  it('unsharing purges every item, change, card, comment and participant; the tombstone answers gone', async () => {
    const s = SqliteStoreApi.open(':memory:')
    const h = await randomShareHistory(s, 9, 120, { revokeAtEnd: true })
    const snap = await s.snapshot()
    expect(snap.shares.map((x) => [x.id, x.occurrences.length, x.revokedAt !== null])).toEqual([
      [h.shareId, 0, true],
    ])
    for (const k of [
      'shareItems',
      'shareChanges',
      'shareCards',
      'shareComments',
      'shareParticipants',
    ] as const)
      expect(snap[k], k).toEqual([])
    // the bookkeeping secrets of participants and codes are gone too
    expect(s.store.db.prepare('SELECT count(*) AS n FROM share_participant_tokens').get()).toEqual({ n: 0 })
    expect(s.store.db.prepare('SELECT count(*) AS n FROM share_codes').get()).toEqual({ n: 0 })
    await expect(
      s.shareRead({ tokenHash: h.linkHash }, {}, (st) => shares.publicPage(st, { contributions: true })),
    ).rejects.toBeInstanceOf(shares.ShareGone)
    expect(checkShareLog(await s.eventsAfter(0))).toEqual([])
  })

  it('a device can never push share events through hybrid sync', () => {
    const d = decideIngest(
      { type: 'share.revoked', shareId: 'shr_x', at: T0 },
      { sessionExists: false, prevSegment: null },
    )
    expect(d).toMatchObject({ kind: 'reject' })
  })
})

describe('magic links and contributions: abuse limits', () => {
  const setup = async () => {
    const s = SqliteStoreApi.open(':memory:')
    await s.shareWrite(null, {}, (_x, now) =>
      shares.planCreateShare({
        shareId: 'shr_a',
        tokenHash: sha('link'),
        ownerName: 'Kacper',
        ownerLabel: 'owner',
        options: { allowInvitees: true, members: ['ana@example.com'] },
        occurrence: { agendaId: 'agd_1', title: 'Sync', meeting: null, goals: [] },
        now,
      }),
    )
    return s
  }
  const verify = (s: SqliteStoreApi, email: string, code: string) =>
    s.shareWrite({ shareId: 'shr_a' }, {}, (st, now) =>
      shares.planVerify(st, { email, name: null, codeHash: sha(code), now }),
    )
  const confirm = (s: SqliteStoreApi, email: string, code: string, token = `tok-${email}`) =>
    s.shareWrite({ shareId: 'shr_a' }, {}, (st, now) =>
      shares.planConfirm(st, {
        email,
        codeHash: sha(code),
        participantId: `spt_${email}`,
        tokenHash: sha(token),
        now,
      }),
    )

  it('codes per address are limited; a wrong code counts; five wrong guesses burn the code', async () => {
    const s = await setup()
    for (let i = 0; i < shares.SHARE_LIMITS.codesPerEmailWindow; i++)
      await verify(s, 'x@example.com', `c${i}`)
    await expect(verify(s, 'x@example.com', 'c-more')).rejects.toBeInstanceOf(shares.ShareRateLimited)
    await verify(s, 'y@example.com', 'good')
    for (let i = 0; i < shares.SHARE_LIMITS.attemptsPerCode; i++)
      expect(await confirm(s, 'y@example.com', `bad${i}`)).toMatchObject({ ok: false })
    // the right code no longer works: it was guessed at too often
    expect(await confirm(s, 'y@example.com', 'good')).toMatchObject({ ok: false })
  })

  it('a code works once, for its own address; roles follow the owner’s member list', async () => {
    const s = await setup()
    await verify(s, 'ana@example.com', 'ana-code')
    expect(await confirm(s, 'ivy@example.com', 'ana-code')).toMatchObject({ ok: false })
    const ok = await confirm(s, 'ana@example.com', 'ana-code')
    expect(ok).toMatchObject({ ok: true, participant: { role: 'member' } })
    expect(await confirm(s, 'ana@example.com', 'ana-code', 'again')).toMatchObject({ ok: false })
  })

  it('contributions need a verified address and are rate-limited; invitees cannot push statuses', async () => {
    const s = await setup()
    await expect(
      s.shareWrite({ shareId: 'shr_a' }, {}, (st, now) =>
        shares.planAddItem(st, { text: 'x', kind: 'topic', itemId: 'itm_x', now }),
      ),
    ).rejects.toBeInstanceOf(shares.ShareForbidden)
    await verify(s, 'ivy@example.com', 'ivy')
    expect(await confirm(s, 'ivy@example.com', 'ivy')).toMatchObject({
      ok: true,
      participant: { role: 'invitee' },
    })
    const as = { participantTokenHash: sha('tok-ivy@example.com') }
    for (let i = 0; i < shares.SHARE_LIMITS.contributionsPerHour; i++)
      await s.shareWrite({ shareId: 'shr_a' }, as, (st, now) =>
        shares.planAddComment(st, { itemId: null, text: `c${i}`, commentId: `scm_${i}`, now }),
      )
    await expect(
      s.shareWrite({ shareId: 'shr_a' }, as, (st, now) =>
        shares.planAddItem(st, { text: 'one more', kind: 'topic', itemId: 'itm_y', now }),
      ),
    ).rejects.toBeInstanceOf(shares.ShareRateLimited)
    const ivy = (await s.snapshot()).shareParticipants.find((p) => p.email === 'ivy@example.com')!
    await expect(
      s.shareWrite({ shareId: 'shr_a' }, {}, (st, now) =>
        shares.planPush(st, { role: 'member', participant: ivy }, [], now, () => 'shc_1'),
      ),
    ).rejects.toBeInstanceOf(shares.ShareForbidden)
  })

  it('verifying an address that may not join sends nothing (and says the same)', async () => {
    const s = await setup()
    await s.shareWrite({ shareId: 'shr_a' }, {}, (st, now) =>
      shares.planUpdateShare(st, { options: { allowInvitees: false, members: ['ana@example.com'] } }, now),
    )
    expect(await verify(s, 'stranger@example.com', 'z')).toMatchObject({ send: false })
    expect(await verify(s, 'ana@example.com', 'a')).toMatchObject({ send: true })
  })
})
