import type { KacolaApiError } from '@kacola/protocol'
import { type DaemonHandle, startDaemon } from '@kacola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// UX trust fixes on agendas, through the real daemon process: "send the agenda" never hands out a link an
// attendee can't open; item history records edits, adds, removes and imports and can restore; actors
// come back in words.

describe('agenda trust fixes', () => {
  let d: DaemonHandle
  beforeAll(async () => {
    // no KACOLA_SHARE_URL / TOKEN: hosted sharing is not configured
    d = await startDaemon({
      env: { KACOLA_SHARE_URL: '', KACOLA_SHARE_TOKEN: '', KACOLA_SYNC_URL: '' },
    })
  })
  afterAll(async () => {
    await d?.stop()
  })

  it('send the agenda without hosted sharing: a clear no-share-host state, and no kacola-only invite', async () => {
    const c = d.client
    const v = await c.call('createAgenda', { body: { title: '1:1 with Ana', items: [{ text: 'Roadmap' }] } })
    const r = await c.call('sendAgenda', { params: { id: v.agenda.id }, body: {} })
    expect(r).toMatchObject({
      state: 'no-share-host',
      reason: 'no-share-host',
      inviteText: null,
      webLink: null,
      written: false,
      share: null,
    })
    expect(r.message).toMatch(/can't make a link attendees can open/)
    expect(r.appLink).toBe(`kacola://agenda/${v.agenda.id}`)
  })

  it('a private agenda is never put on a link', async () => {
    const c = d.client
    const v = await c.call('createAgenda', { body: { title: 'Salary talk', private: true } })
    const r = await c.call('sendAgenda', { params: { id: v.agenda.id }, body: {} })
    expect(r).toMatchObject({ state: 'not-shareable', reason: 'private-meeting', inviteText: null })
    const missing = await c
      .call('sendAgenda', { params: { id: 'agd_nope' }, body: {} })
      .catch((e: unknown) => e)
    expect((missing as KacolaApiError).status).toBe(404)
  })

  it('item history: edits, adds, removes and imports are recorded; restore puts an item back', async () => {
    const c = d.client
    const v = await c.call('createAgenda', {
      body: { title: 'Weekly', items: [{ text: 'Budget' }, { text: 'Hiring' }] },
    })
    const id = v.agenda.id
    const budget = v.items[0]!.id
    await c.call('updateAgendaItem', { params: { id, itemId: budget }, body: { text: 'Budget (Q4)' } })
    await c.call('setAgendaItemStatus', { params: { id, itemId: budget }, body: { status: 'covered' } })
    const md = await c.call('exportAgendaMarkdown', { params: { id } })
    await c.call('importAgendaMarkdown', {
      params: { id },
      body: { markdown: `${md.markdown}- [ ] Offsite\n`, baseVersion: md.version },
    })
    await c.call('deleteAgendaItem', { params: { id, itemId: v.items[1]!.id } })

    const all = (await c.call('getAgendaItemHistory', { params: { id } })).versions
    expect(all.map((x) => [x.kind, x.item?.text ?? null])).toEqual([
      ['added', 'Budget'],
      ['added', 'Hiring'],
      ['edited', 'Budget (Q4)'],
      ['status', 'Budget (Q4)'],
      ['imported', 'Offsite'],
      ['removed', 'Hiring'],
    ])
    const edit = all[2]!
    expect(edit).toMatchObject({ fields: ['text'], actor: { kind: 'you', label: 'you' }, restorable: true })

    // restore Budget to before the edit (text and status both go back), then bring Hiring back
    const back = await c.call('restoreAgendaItem', {
      params: { id, itemId: budget },
      body: { seq: all[0]!.seq },
    })
    expect(back.item).toMatchObject({ id: budget, text: 'Budget', status: 'open' })
    const hiring = all[5]!
    const again = await c.call('restoreAgendaItem', {
      params: { id, itemId: hiring.itemId },
      body: { seq: hiring.seq },
    })
    expect(again.item).toMatchObject({ id: hiring.itemId, text: 'Hiring', order: 1 })
    const view = await c.call('getAgenda', { params: { id } })
    expect(view.items.map((i) => i.text)).toEqual(['Budget', 'Hiring', 'Offsite'])
    expect(view.actors?.user).toEqual({ kind: 'you', label: 'you', person: null })
    const mine = (await c.call('getAgendaItemHistory', { params: { id }, query: { itemId: budget } }))
      .versions
    expect(mine.slice(-2).map((x) => x.kind)).toEqual(['restored', 'restored'])
    const bad = await c
      .call('restoreAgendaItem', { params: { id, itemId: budget }, body: { seq: 999_999 } })
      .catch((e: unknown) => e)
    expect((bad as KacolaApiError).status).toBe(404)
  })
})
