import { createHash } from 'node:crypto'
import type { AgendaItemStatus, ShareOp, ShareParticipant } from '@gnomeola/protocol'
import { seededRandom } from '@gnomeola/testkit/daemon'
import type { StoreApi } from '../src/api.ts'
import * as shares from '../src/shares.ts'

// A random team-sharing history, driven through a StoreApi exactly as the hosted server drives it
// (shareWrite + the pure planners): an owner and two members pushing status changes from people,
// trackers and agents — out of order, duplicated, from stale views — invitees adding items and
// comments, the owner editing, sharing and un-sharing the recap, cards, participant revocation and
// (on some seeds) unsharing. Used by the store's merge tests and the cross-dialect test.

export const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const STATUSES: AgendaItemStatus[] = ['open', 'in-progress', 'covered', 'skipped', 'parked']

export type ShareHistory = {
  shareId: string
  linkHash: string
  /** Every status op pushed, with the actor it was pushed as (duplicates included). */
  pushed: { actor: string; key: string }[]
  members: Record<string, ShareParticipant>
  invitee: ShareParticipant | null
  revoked: boolean
}

export async function randomShareHistory(
  store: StoreApi,
  seed: number,
  steps: number,
  o: { revokeAtEnd?: boolean } = {},
): Promise<ShareHistory> {
  const rnd = seededRandom(seed)
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!
  let n = 0
  const id = (kind: string) => `${kind}_${String(++n).padStart(6, '0')}`
  const shareId = `shr_seed${seed}`
  const linkHash = sha(`link-${seed}`)
  const occ = (k: number) => `agd_occ${k}`
  await store.shareWrite(null, {}, (_s, now) =>
    shares.planCreateShare({
      shareId,
      tokenHash: linkHash,
      ownerName: 'Kacper',
      ownerLabel: 'kacper@example.com',
      options: { allowInvitees: true, members: ['ana@example.com', 'ben@example.com'] },
      occurrence: { agendaId: occ(1), title: 'Weekly', meeting: null, goals: [] },
      now,
    }),
  )
  const confirm = async (email: string): Promise<ShareParticipant> => {
    const code = `CODE${email.length}`
    await store.shareWrite({ shareId }, {}, (s, now) =>
      shares.planVerify(s, { email, name: email.split('@')[0]!, codeHash: sha(`${email}:${code}`), now }),
    )
    const r = await store.shareWrite({ shareId }, {}, (s, now) =>
      shares.planConfirm(s, {
        email,
        codeHash: sha(`${email}:${code}`),
        participantId: id('spt'),
        tokenHash: sha(`token-${email}`),
        now,
      }),
    )
    if (!r.ok) throw new Error(r.reason)
    return r.participant
  }
  const members = { ana: await confirm('ana@example.com'), ben: await confirm('ben@example.com') }
  const invitee = await confirm('ivy@example.com')
  const items: string[] = []
  const pushed: ShareHistory['pushed'] = []
  let occurrences = 1
  let t = Date.parse('2026-10-01T10:00:00.000Z')
  const sent: Extract<ShareOp, { op: 'status' }>[] = []

  const push = (who: 'owner' | 'ana' | 'ben', ops: ShareOp[]) =>
    store.shareWrite({ shareId }, {}, (s, now) =>
      shares.planPush(
        s,
        who === 'owner' ? { role: 'owner' } : { role: 'member', participant: members[who] },
        ops,
        now,
        id,
      ),
    )

  for (let step = 0; step < steps; step++) {
    t += Math.floor(rnd() * 20_000)
    const r = rnd()
    if (r < 0.12 || items.length < 3) {
      const itemId = id('itm')
      const who = rnd() < 0.8 ? 'owner' : pick(['ana', 'ben'] as const)
      await push(who, [
        {
          op: 'item',
          item: {
            id: itemId,
            occurrence: occ(occurrences),
            text: `Item ${itemId}`,
            kind: pick(['topic', 'question', 'decision'] as const),
            owner: null,
            timeboxMin: null,
            order: items.length,
            carriedFrom: null,
          },
        },
      ])
      items.push(itemId)
    } else if (r < 0.7) {
      // a status change from someone, maybe from a stale view, maybe an old device time
      const who = pick(['owner', 'owner', 'ana', 'ben'] as const)
      const by = pick(
        who === 'owner'
          ? (['user', 'tracker', 'agent:claude'] as const)
          : (['user', 'tracker', 'agent:claude'] as const),
      )
      const op: Extract<ShareOp, { op: 'status' }> = {
        op: 'status',
        key: `k${step}`,
        itemId: pick(items),
        from: pick(STATUSES),
        to: pick(STATUSES),
        by,
        at: new Date(t - (rnd() < 0.2 ? 60_000 : 0)).toISOString(),
        auto: by === 'tracker' && rnd() < 0.5,
        confidence: by === 'tracker' ? Math.round(rnd() * 100) / 100 : null,
      }
      await push(who, [op])
      pushed.push({ actor: who === 'owner' ? 'owner' : members[who].id, key: op.key })
      sent.push(op)
    } else if (r < 0.76 && sent.length) {
      // a re-push of something already sent (a lost response): must be a no-op
      const op = pick(sent)
      const who = pushed.find((p) => p.key === op.key)!.actor
      const as = who === 'owner' ? 'owner' : who === members.ana.id ? 'ana' : 'ben'
      await push(as, [op])
      pushed.push({ actor: who, key: op.key })
    } else if (r < 0.82) {
      await store
        .shareWrite({ shareId }, { participantTokenHash: sha('token-ivy@example.com') }, (s, now) =>
          rnd() < 0.5
            ? shares.planAddItem(s, { text: `Invitee idea ${step}`, kind: 'topic', itemId: id('itm'), now })
            : shares.planAddComment(s, {
                itemId: rnd() < 0.5 ? pick(items) : null,
                text: `comment ${step}`,
                commentId: id('scm'),
                now,
              }),
        )
        .then(
          (x) => {
            if ('status' in x) items.push(x.id)
          },
          (err) => {
            if (!(err instanceof shares.ShareRateLimited) && !String(err).includes('no item')) throw err
          },
        )
    } else if (r < 0.87) {
      const shared = rnd() < 0.6
      await push('owner', [
        { op: 'recap', occurrence: occ(occurrences), shared },
        { op: 'outcome', itemId: pick(items), outcome: `Outcome ${step}` },
      ])
    } else if (r < 0.91) {
      await push('owner', [
        {
          op: 'card',
          card: {
            id: `ctx_${step}`,
            occurrence: occ(occurrences),
            title: `Card ${step}`,
            body: 'context',
            pinned: false,
            sourceUrl: null,
          },
        },
      ])
    } else if (r < 0.94) {
      const victim = pick(items)
      await push('owner', [{ op: 'item.delete', itemId: victim }])
      items.splice(items.indexOf(victim), 1)
    } else if (r < 0.97) {
      // the next occurrence joins the link, with a carried-over item
      occurrences++
      const carried = pick(items)
      const itemId = id('itm')
      await push('owner', [
        {
          op: 'occurrence',
          occurrence: {
            agendaId: occ(occurrences),
            title: `Weekly #${occurrences}`,
            meeting: null,
            goals: [],
          },
          current: true,
        },
        {
          op: 'item',
          item: {
            id: itemId,
            occurrence: occ(occurrences),
            text: `Carried ${carried}`,
            kind: 'topic',
            owner: null,
            timeboxMin: null,
            order: 0,
            carriedFrom: { occurrence: occ(occurrences - 1), itemId: carried },
          },
        },
      ])
      items.push(itemId)
    } else {
      await store.shareWrite({ shareId }, {}, (s) => {
        const c = s!.comments.find((x) => !x.hidden)
        return c ? shares.planHideComment(s, c.id) : { events: [], bookkeeping: [], result: null }
      })
    }
  }
  let revoked = false
  if (o.revokeAtEnd) {
    await store.shareWrite({ shareId }, {}, (s, now) => shares.planRevokeShare(s, now))
    revoked = true
  }
  return { shareId, linkHash, pushed, members, invitee, revoked }
}
