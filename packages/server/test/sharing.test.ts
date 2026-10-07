import {
  createClient,
  type KacolaApiError,
  LEGACY_PARTICIPANT_HEADER,
  PARTICIPANT_HEADER,
} from '@kacola/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryMailer } from '../src/mailer.ts'
import { ADMIN, type Hosted, SECRET, startHosted } from './helpers.ts'

// Team sharing over HTTP on the hosted server: who may do what, what an abuser learns (nothing), and
// what unsharing leaves (a 410). The merge rules themselves are the store's (store/test/shares.test.ts).

let servers: Hosted[] = []
afterEach(async () => {
  await Promise.all(servers.map((s) => s.close()))
  servers = []
})

const occurrence = { agendaId: 'agd_1', title: '1:1 with Ana', meeting: null, goals: [] }
const status = (p: Promise<unknown>) =>
  p.then(
    () => 200,
    (e: KacolaApiError) => e.status,
  )

async function setup(o: { allowInvitees?: boolean; members?: string[]; mailer?: boolean } = {}) {
  const mailer = new MemoryMailer()
  const h = await startHosted({
    auth: { secret: SECRET, adminToken: ADMIN },
    trustLoopback: false,
    ...(o.mailer === false ? {} : { mailer }),
  })
  servers.push(h)
  const owner = createClient({ baseUrl: h.url, token: ADMIN })
  const anon = createClient({ baseUrl: h.url })
  const { share, token } = await owner.call('createShare', {
    body: {
      ownerName: 'Kacper',
      ownerLabel: 'kacper@example.com',
      options: { allowInvitees: o.allowInvitees ?? true, members: o.members ?? ['ana@example.com'] },
      occurrence,
    },
  })
  const codeFor = (email: string) => /code is ([A-Z]{4}-[A-Z]{4})/.exec(mailer.last(email)?.text ?? '')?.[1]
  const join = async (email: string) => {
    await anon.call('shareVerify', { params: { token }, body: { email } })
    const r = await anon.call('shareConfirm', { params: { token }, body: { email, code: codeFor(email)! } })
    return { ...r, client: createClient({ baseUrl: h.url, headers: { [PARTICIPANT_HEADER]: r.token } }) }
  }
  return { h, mailer, owner, anon, share, token, codeFor, join }
}

describe('shared agendas on the hosted server', () => {
  it('owner routes need the pairing token; member routes a participant token of THIS share', async () => {
    const t = await setup()
    expect(
      await status(
        t.anon.call('createShare', {
          body: {
            ownerName: 'x',
            ownerLabel: 'x',
            options: { allowInvitees: true, members: [] },
            occurrence,
          },
        }),
      ),
    ).toBe(401)
    expect(await status(t.anon.call('revokeShare', { params: { shareId: t.share.id } }))).toBe(401)
    expect(
      await status(t.anon.call('pushShare', { params: { shareId: t.share.id }, body: { ops: [] } })),
    ).toBe(401)
    expect(await status(t.anon.call('getShareState', { params: { shareId: t.share.id } }))).toBe(401)
    const ana = await t.join('ana@example.com')
    expect(ana.participant.role).toBe('member')
    expect((await ana.client.call('getShareState', { params: { shareId: t.share.id } })).you.role).toBe(
      'member',
    )
    // a member sees no participant list (emails stay with the owner)
    expect(
      (await ana.client.call('getShareState', { params: { shareId: t.share.id } })).participants,
    ).toEqual([])
    // the same token on another share is nobody
    const other = await t.owner.call('createShare', {
      body: {
        ownerName: 'K',
        ownerLabel: 'k',
        options: { allowInvitees: true, members: ['ana@example.com'] },
        occurrence,
      },
    })
    expect(await status(ana.client.call('getShareState', { params: { shareId: other.share.id } }))).toBe(401)
    // an invitee cannot sync statuses
    const ivy = await t.join('ivy@example.com')
    expect(ivy.participant.role).toBe('invitee')
    expect(
      await status(ivy.client.call('pushShare', { params: { shareId: t.share.id }, body: { ops: [] } })),
    ).toBe(403)
  })

  it("a member's daemon from before the rename (the gnomeola header) is still recognised", async () => {
    const t = await setup()
    const ana = await t.join('ana@example.com')
    const old = createClient({ baseUrl: t.h.url, headers: { [LEGACY_PARTICIPANT_HEADER]: ana.token } })
    expect((await old.call('getShareState', { params: { shareId: t.share.id } })).you.role).toBe('member')
  })

  it('the push is a strict projection: evidence, quotes or notes are refused, not stripped', async () => {
    const t = await setup()
    const base = {
      op: 'status',
      key: 'k',
      itemId: 'itm_1',
      from: 'open',
      to: 'covered',
      by: 'tracker',
      at: '2026-10-01T10:00:00.000Z',
      auto: true,
      confidence: 0.9,
    }
    for (const extra of [
      { evidence: [{ segmentId: 'seg_1', quote: 'we agreed', confidence: 1 }] },
      { note: 'heard it' },
      { quote: 'x' },
    ]) {
      const res = await fetch(`${t.h.url}/shared/${t.share.id}/push`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ADMIN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ops: [{ ...base, ...extra }] }),
      })
      expect(res.status, JSON.stringify(extra)).toBe(400)
    }
    // a device may push only its own attributions
    const res = await fetch(`${t.h.url}/shared/${t.share.id}/push`, {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ops: [{ ...base, by: 'invitee:ivy@example.com' }] }),
    })
    expect(res.status).toBe(400)
  })

  it('asking for a code reveals nothing; codes are rate-limited (429); a wrong code is refused', async () => {
    const t = await setup({ allowInvitees: false, members: ['ana@example.com'] })
    const r1 = await t.anon.call('shareVerify', {
      params: { token: t.token },
      body: { email: 'stranger@example.com' },
    })
    const r2 = await t.anon.call('shareVerify', {
      params: { token: t.token },
      body: { email: 'ana@example.com' },
    })
    expect(r1.sent).toBe(true)
    expect(r2.sent).toBe(true)
    expect(t.mailer.sent.map((m) => m.to)).toEqual(['ana@example.com'])
    // the email names neither the requester's chosen name nor anything but the code and the link
    expect(t.mailer.sent[0]!.text).toContain(`${t.h.url}/a/${t.token}#verify=ana%40example.com/`)
    await t.anon.call('shareVerify', { params: { token: t.token }, body: { email: 'ana@example.com' } })
    await t.anon.call('shareVerify', { params: { token: t.token }, body: { email: 'ana@example.com' } })
    const res = await fetch(`${t.h.url}/shared/link/${t.token}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ana@example.com' }),
    })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('60')
    expect(
      await status(
        t.anon.call('shareConfirm', {
          params: { token: t.token },
          body: { email: 'ana@example.com', code: 'BBBB-BBBB' },
        }),
      ),
    ).toBe(403)
    // an unknown link is a 404
    expect(await status(t.anon.call('getSharedPage', { params: { token: 'x'.repeat(32) } }))).toBe(404)
  })

  it('no mailer: the page is read-only and verifying is a 501', async () => {
    const t = await setup({ mailer: false })
    expect((await t.anon.call('getSharedPage', { params: { token: t.token } })).contributions).toBe(false)
    expect(
      await status(
        t.anon.call('shareVerify', { params: { token: t.token }, body: { email: 'a@example.com' } }),
      ),
    ).toBe(501)
  })

  it('unsharing: the link answers 410 everywhere, participants are locked out, the content is gone', async () => {
    const t = await setup()
    const ana = await t.join('ana@example.com')
    const ivy = await t.join('ivy@example.com')
    await ivy.client.call('shareAddItem', { params: { token: t.token }, body: { text: 'Offsite dates' } })
    await t.owner.call('revokeShare', { params: { shareId: t.share.id } })
    expect(await status(t.anon.call('getSharedPage', { params: { token: t.token } }))).toBe(410)
    expect(
      await status(
        t.anon.call('shareVerify', { params: { token: t.token }, body: { email: 'x@example.com' } }),
      ),
    ).toBe(410)
    expect(
      await status(ivy.client.call('shareAddItem', { params: { token: t.token }, body: { text: 'x' } })),
    ).toBe(410)
    expect(
      await status(ana.client.call('pushShare', { params: { shareId: t.share.id }, body: { ops: [] } })),
    ).toBe(410)
    const snap = await t.h.store.snapshot()
    expect([snap.shareItems, snap.shareParticipants, snap.shareComments]).toEqual([[], [], []])
    expect(JSON.stringify(await t.h.store.eventsAfter(0))).not.toContain(t.token)
  })

  it('the owner removes a participant: their token stops working at once', async () => {
    const t = await setup()
    const ivy = await t.join('ivy@example.com')
    await t.owner.call('revokeShareParticipant', {
      params: { shareId: t.share.id, participantId: ivy.participant.id },
    })
    expect(
      await status(ivy.client.call('shareAddComment', { params: { token: t.token }, body: { text: 'hi' } })),
    ).toBe(403)
    // and they cannot come back with a new code
    await t.anon.call('shareVerify', { params: { token: t.token }, body: { email: 'ivy@example.com' } })
    expect(t.mailer.sent.filter((m) => m.to === 'ivy@example.com')).toHaveLength(1)
  })
})
