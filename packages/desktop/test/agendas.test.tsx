// @vitest-environment jsdom
import type {
  AgendaItem,
  AgendaView,
  DurableEvent,
  ItemVersion,
  LeaseInfo,
  SharedActor,
  SharedChange,
  SharedComment,
  SseMessage,
  StatusChange,
  Suggestion,
  TrackerStatus,
} from '@kacola/protocol'
import { actorOf } from '@kacola/protocol'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetDeepLinksForTests } from '../src/renderer/features/agendas/deep-links.tsx'
import { canDeleteItem, removalVersion } from '../src/renderer/features/agendas/delete-item.ts'
import { useFollow } from '../src/renderer/features/agendas/follow.tsx'
import { fakeBridge, renderApp, shareStatus } from './app-harness.tsx'
import type { Handler } from './helpers.ts'
import { durable, ephemeral, session, until } from './helpers.ts'

// The agenda screens through the real router, React Query and EventBridge, over a fake daemon that keeps
// one agenda in memory and echoes every write as the durable event the real daemon would append.

afterEach(() => cleanup())
beforeEach(() => {
  resetDeepLinksForTests()
  useFollow.setState({ open: false, link: '' })
})

const T = '2026-09-30T10:00:00.000Z'

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
  source: 'agent:claude',
  createdAt: T,
  expiresAt: null,
  state: 'open',
  resolvedAt: null,
  resolvedBy: null,
  ...over,
})

function agendaView(over: Partial<AgendaView['agenda']> = {}, items?: AgendaItem[]): AgendaView {
  return {
    agenda: {
      id: 'agd_1',
      title: '1:1 with Ana',
      meeting: null,
      sessionId: null,
      owner: 'me',
      goals: ['agree the promo timeline'],
      private: false,
      carriedFrom: null,
      version: 5,
      createdAt: T,
      updatedAt: T,
      ...over,
    },
    items: items ?? [
      item('Promo timeline', 0, { kind: 'must-cover', timeboxMin: 10, owner: 'ana' }),
      item('Hiring plan', 1),
      item('Offsite dates', 2),
    ],
    context: [],
    suggestions: [],
  }
}

/** A one-agenda daemon: writes change `view` and are echoed as durable events (seq from 100). */
function agendaDaemon(initial: AgendaView, history: StatusChange[] = []) {
  const state = { view: initial, history, seq: 100, emit: (_e: DurableEvent) => {} }
  const bump = () => {
    state.view = { ...state.view, agenda: { ...state.view.agenda, version: state.view.agenda.version + 1 } }
    return state.view.agenda.version
  }
  const echo = (data: DurableEvent['data']) =>
    state.emit(durable(++state.seq, data, state.view.agenda.sessionId))
  const scoped = (version: number) => ({ agendaId: 'agd_1', version, at: new Date().toISOString() })
  const handlers: Record<string, Handler> = {
    getAgenda: () => state.view,
    getAgendaHistory: () => ({ changes: state.history }),
    listAgendas: ({ query }) => {
      const q = query as { sessionId?: string }
      const a = state.view.agenda
      if (q.sessionId && q.sessionId !== a.sessionId) return { agendas: [] }
      return {
        agendas: [{ ...a, counts: { items: 3, open: 3, inProgress: 0, covered: 0, skipped: 0, parked: 0 } }],
      }
    },
    addAgendaItems: ({ body }) => {
      const b = body as { items: { text: string; kind?: AgendaItem['kind'] }[] }
      const made = b.items.map((n, i) =>
        item(`itm_new${i}`, state.view.items.length + i, { text: n.text, kind: n.kind ?? 'topic' }),
      )
      state.view = { ...state.view, items: [...state.view.items, ...made] }
      const version = bump()
      // the echo arrives a moment after the response, as over the wire
      setTimeout(() => {
        for (const m of made) echo({ type: 'agenda.item.upserted', ...scoped(version), item: m })
      }, 5)
      return { items: made, version }
    },
    setAgendaItemStatus: ({ params, body }) => {
      const b = body as { status: AgendaItem['status'] }
      const cur = state.view.items.find((i) => i.id === params!.itemId)!
      const next = { ...cur, status: b.status }
      state.view = { ...state.view, items: state.view.items.map((i) => (i.id === cur.id ? next : i)) }
      const change: StatusChange = {
        itemId: cur.id,
        from: cur.status,
        to: b.status,
        by: 'user',
        at: new Date().toISOString(),
        note: null,
        evidence: [],
        override: false,
        auto: false,
        confidence: null,
      }
      const version = bump()
      echo({ type: 'agenda.item.status', ...scoped(version), item: next, change })
      return { item: next, change }
    },
    reorderAgendaItems: ({ body }) => {
      const ids = (body as { itemIds: string[] }).itemIds
      const version = bump()
      echo({ type: 'agenda.items.reordered', ...scoped(version), itemIds: ids })
      return { version }
    },
    updateAgenda: ({ body }) => {
      state.view = { ...state.view, agenda: { ...state.view.agenda, ...(body as object) } }
      bump()
      echo({ type: 'agenda.upserted', agenda: state.view.agenda })
      return state.view.agenda
    },
    // item history (restorable versions): the item as added, then each status change
    getAgendaItemHistory: ({ query }) => {
      const itemId = (query as { itemId: string }).itemId
      const cur = state.view.items.find((i) => i.id === itemId)!
      const changes = state.history.filter((h) => h.itemId === itemId)
      const actor = (by: string) => actorOf(by)
      return {
        versions: [
          {
            seq: 1,
            itemId,
            kind: 'added',
            by: 'user',
            actor: actor('user'),
            at: T,
            item: { ...cur, status: changes[0]?.from ?? cur.status },
            fields: [],
            status: null,
            restorable: true,
            cause: null,
          },
          ...changes.map((c, n) => ({
            seq: n + 2,
            itemId,
            kind: 'status',
            by: c.by,
            actor: actor(c.by),
            at: c.at,
            item: { ...cur, status: c.to },
            fields: ['status'],
            status: c,
            restorable: true,
            cause: null,
          })),
        ],
      }
    },
    restoreAgendaItem: ({ params, body }) => {
      const seq = (body as { seq: number }).seq
      const cur = state.view.items.find((i) => i.id === params!.itemId)!
      const changes = state.history.filter((h) => h.itemId === cur.id)
      const status = seq === 1 ? (changes[0]?.from ?? cur.status) : changes[seq - 2]!.to
      const next = { ...cur, status, changedBy: 'user' }
      state.view = { ...state.view, items: state.view.items.map((i) => (i.id === cur.id ? next : i)) }
      const version = bump()
      echo({ type: 'agenda.item.upserted', ...scoped(version), item: next, cause: 'restore' })
      return { item: next, version }
    },
    acceptSuggestion: ({ params }) => resolve(params!.suggestionId!, 'accepted'),
    dismissSuggestion: ({ params }) => resolve(params!.suggestionId!, 'dismissed'),
  }
  const resolve = (id: string, st: 'accepted' | 'dismissed') => {
    const s = { ...state.view.suggestions.find((x) => x.id === id)!, state: st, resolvedBy: 'user' as const }
    state.view = { ...state.view, suggestions: state.view.suggestions.map((x) => (x.id === id ? s : x)) }
    echo({ type: 'agenda.suggestion.upserted', agendaId: 'agd_1', suggestion: s })
    return { suggestion: s, item: null }
  }
  return { state, handlers }
}

function mount(o: {
  view: AgendaView
  history?: StatusChange[]
  path: string
  handlers?: Record<string, Handler>
  sessions?: ReturnType<typeof session>[]
  bridge?: ReturnType<typeof fakeBridge>
}) {
  const d = agendaDaemon(o.view, o.history)
  const app = renderApp({
    path: o.path,
    sessions: o.sessions,
    bridge: o.bridge,
    handlers: {
      ...d.handlers,
      listSpeakers: () => ({ speakers: [] }),
      getSession: ({ params }) => (o.sessions ?? []).find((s) => s.id === params!.id),
      listAgentLeases: () => ({ leases: [] }),
      getAgendaTracker: () => ({ tracker: null }),
      getAgentAccess: () => ({ sessionId: 's1', private: false, allowAgents: false, attachable: true }),
      ...o.handlers,
    },
  })
  d.state.emit = (e) => act(() => app.daemon.emit(e))
  return { app, d }
}

describe('agenda editor', () => {
  it('shows goals and items; adds an item at once and reconciles it with the echo', async () => {
    const { app, d } = mount({ view: agendaView(), path: '/agendas/agd_1' })
    await screen.findByRole('heading', { name: '1:1 with Ana' })
    const list = screen.getByRole('grid', { name: 'Agenda items' })
    expect(
      within(list)
        .getAllByRole('row')
        .map((r) => r.textContent),
    ).toEqual([
      expect.stringContaining('Promo timeline'),
      expect.stringContaining('Hiring plan'),
      expect.stringContaining('Offsite dates'),
    ])
    expect(within(list).getAllByRole('row')[0]!.textContent).toMatch(/Must cover.*ana.*10 min/)
    expect(screen.getByRole('list', { name: 'Goals' }).textContent).toContain('agree the promo timeline')

    fireEvent.change(screen.getByLabelText('New item'), { target: { value: 'Budget sign-off' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    // optimistic: there before the daemon answered (its row is pending: no edit yet)
    await until(() => within(list).getAllByRole('row').length === 4)
    await until(() => app.daemon.calls.includes('addAgendaItems'))
    expect(app.daemon.log.find((c) => c.name === 'addAgendaItems')!.opts.body).toEqual({
      items: [{ text: 'Budget sign-off', kind: 'topic' }],
    })
    await until(() => d.state.seq > 100)
    await until(() => screen.queryAllByRole('button', { name: 'Edit “Budget sign-off”' }).length === 1)
    // the temporary row is gone, the real one (itm_new0) stands in its place — once
    expect(within(list).getAllByRole('row')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Edit “Budget sign-off”' }).hasAttribute('disabled')).toBe(
      false,
    )
    app.stop()
  })

  it('changes a status from its menu; a refusal rolls it back and says why', async () => {
    const { app } = mount({
      view: agendaView(),
      path: '/agendas/agd_1',
      handlers: {
        setAgendaItemStatus: () => {
          throw Object.assign(new Error('the tracker may not move it back'), { status: 409 })
        },
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Status of “Hiring plan”: Open' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Covered' }))
    await screen.findByText(/Could not change the status: the tracker may not move it back/)
    expect(screen.getByRole('button', { name: 'Status of “Hiring plan”: Open' })).toBeTruthy()
    app.stop()
  })

  it('moves an item down from its menu (the keyboard path) and sends the full order', async () => {
    const { app } = mount({ view: agendaView(), path: '/agendas/agd_1' })
    fireEvent.click(await screen.findByRole('button', { name: 'More for “Promo timeline”' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move down' }))
    await until(() => app.daemon.calls.includes('reorderAgendaItems'))
    expect(app.daemon.log.find((c) => c.name === 'reorderAgendaItems')!.opts.body).toEqual({
      itemIds: ['Hiring plan', 'Promo timeline', 'Offsite dates'],
    })
    const rows = within(screen.getByRole('grid', { name: 'Agenda items' })).getAllByRole('row')
    expect(rows[0]!.textContent).toContain('Hiring plan')
    app.stop()
  })

  it('Send the agenda: a preview of what attendees get (never private notes), then the text to paste when the calendar refuses', async () => {
    const fb = fakeBridge()
    const view = agendaView({
      meeting: {
        eventUid: 'uid-1',
        start: T,
        end: '2026-09-30T10:30:00.000Z',
        recurrenceId: null,
        meetingId: 'mtg_1',
        title: '1:1',
        calendar: 'Work',
        recurring: false,
      },
    })
    view.context = [
      {
        id: 'ctx_1',
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
    const WEB = 'https://share.example/a/AbCdEfGhIjKlMnOpQrStUvWxYz012345'
    const invite = `Agenda: ${WEB}\nIn kacola: kacola://agenda/agd_1`
    const { app } = mount({
      view,
      path: '/agendas/agd_1',
      bridge: fb,
      handlers: {
        sendAgenda: () => ({
          state: 'ready',
          message: 'Ana can open this link without kacola.',
          reason: null,
          inviteText: invite,
          webLink: WEB,
          appLink: 'kacola://agenda/agd_1',
          share: shareStatus({ shared: true, role: 'owner', shareId: 'shr_1', link: WEB, state: 'ok' }),
          written: false,
          writeReason: 'You are not the organiser of this event.',
        }),
      },
    })
    // one action: no separate "Add link to invite" or "Share…"
    expect(screen.queryByRole('button', { name: 'Add Link to Invite' })).toBeNull()
    const send = await screen.findByRole('button', { name: 'Send the agenda' })
    await until(() => !send.hasAttribute('disabled'))
    fireEvent.click(send)
    const dlg = await screen.findByRole('dialog', { name: 'Send the agenda' })
    const preview = within(dlg).getByRole('region', { name: 'What attendees see' })
    expect(preview.textContent).toContain('Promo timeline')
    expect(preview.textContent).not.toContain('nervous')
    expect(dlg.textContent).toContain('1 private note stays on this computer')
    fireEvent.click(within(dlg).getByRole('button', { name: 'Send' }))
    await until(() => app.daemon.calls.includes('sendAgenda'))
    expect(app.daemon.log.find((c) => c.name === 'sendAgenda')!.opts.body).toEqual({
      shareGoals: false,
      writeInvite: true,
    })
    await within(dlg).findByRole('status', { name: 'Ana can open this link without kacola.' })
    expect(dlg.textContent).toContain('You are not the organiser of this event.')
    fireEvent.click(within(dlg).getByRole('button', { name: 'Copy invitation text' }))
    await until(() => fb.bridge.copyText.mock.calls.length === 1)
    expect(fb.bridge.copyText.mock.calls[0]![0]).toBe(invite)
    app.stop()
  })

  it('Send the agenda without a sharing server: the daemon’s sentence and the one action', async () => {
    const { app } = mount({
      view: agendaView(),
      path: '/agendas/agd_1',
      handlers: {
        getAgendaShare: () => shareStatus({ host: null }),
        sendAgenda: () => ({
          state: 'no-share-host',
          message: "kacola can't make a link attendees can open: sharing isn't set up.",
          reason: 'no-share-host',
          inviteText: null,
          webLink: null,
          appLink: 'kacola://agenda/agd_1',
          share: null,
          written: false,
          writeReason: null,
        }),
      },
    })
    const send = await screen.findByRole('button', { name: 'Send the agenda' })
    await until(() => !send.hasAttribute('disabled'))
    fireEvent.click(send)
    const dlg = await screen.findByRole('dialog', { name: 'Send the agenda' })
    fireEvent.click(within(dlg).getByRole('button', { name: 'Send' }))
    await within(dlg).findByRole('status', {
      name: "kacola can't make a link attendees can open: sharing isn't set up.",
    })
    expect(within(dlg).getByRole('button', { name: 'Set up sharing' })).toBeTruthy()
    expect(within(dlg).queryByRole('button', { name: 'Copy invitation text' })).toBeNull()
    app.stop()
  })

  type DaemonState = ReturnType<typeof agendaDaemon>['state']
  /** Prep over the one-agenda daemon, plus handlers that see its state. */
  const mountWith = (extra: (s: () => DaemonState) => Record<string, Handler>, items?: AgendaItem[]) => {
    const ref: { state: DaemonState | null } = { state: null }
    const r = mount({
      view: agendaView({}, items),
      path: '/agendas/agd_1',
      handlers: extra(() => ref.state!),
    })
    ref.state = r.d.state
    return r
  }

  it('deletes an item at once from its row, and Undo in the toast restores it through its history', async () => {
    const removed: { item: AgendaItem; seq: number }[] = []
    let restored: unknown = null
    const { app } = mountWith((s) => ({
      deleteAgendaItem: ({ params }) => {
        const st = s()
        const it = st.view.items.find((i) => i.id === params!.itemId)!
        st.view = { ...st.view, items: st.view.items.filter((i) => i.id !== it.id) }
        removed.push({ item: it, seq: 40 + removed.length })
        return { deleted: true }
      },
      getAgendaItemHistory: ({ query }) => {
        const itemId = (query as { itemId: string }).itemId
        const r = removed.find((x) => x.item.id === itemId)!
        const v = (seq: number, kind: string) => ({
          seq,
          itemId,
          kind,
          by: 'user',
          actor: actorOf('user'),
          at: T,
          item: r.item,
          fields: [],
          status: null,
          restorable: true,
          cause: null,
        })
        return { versions: [v(1, 'added'), v(r.seq, 'removed')] }
      },
      restoreAgendaItem: ({ params, body }) => {
        restored = { itemId: params!.itemId, body }
        const st = s()
        const r = removed.find((x) => x.item.id === params!.itemId)!
        st.view = { ...st.view, items: [...st.view.items, r.item].sort((a, b) => a.order - b.order) }
        return { item: r.item, version: 9 }
      },
    }))
    // a clear but quiet delete per item, named for it; no confirm dialog
    fireEvent.click(await screen.findByRole('button', { name: 'Delete “Hiring plan”' }))
    await until(() => app.daemon.calls.includes('deleteAgendaItem'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    const grid = screen.getByRole('grid', { name: 'Agenda items' })
    await until(() => !within(grid).queryByText('Hiring plan'))
    const region = screen.getByRole('region', { name: 'Notifications' })
    await within(region).findByText('Deleted “Hiring plan”')
    fireEvent.click(within(region).getByRole('button', { name: 'Undo' }))
    await until(() => restored !== null)
    // put back as it was when removed: the removal's version
    expect(restored).toEqual({ itemId: 'Hiring plan', body: { seq: 40 } })
    app.stop()
  })

  it('Delete on a focused row deletes that item; a follower may delete only what they added', async () => {
    const { app } = mountWith(
      (s) => ({
        deleteAgendaItem: ({ params }) => {
          const st = s()
          st.view = { ...st.view, items: st.view.items.filter((i) => i.id !== params!.itemId) }
          return { deleted: true }
        },
        getAgendaShare: () => shareStatus({ shared: true, role: 'member', shareId: 'shr_1', state: 'ok' }),
      }),
      [item('Owner topic', 0, { createdBy: 'peer:ana@example.com' }), item('My question', 1)],
    )
    await screen.findByRole('button', { name: 'Delete “My question”' })
    // the owner's item: not this follower's to delete (once the share status says who this is)
    await until(() => screen.queryByRole('button', { name: 'Delete “Owner topic”' }) === null)
    const rows = within(screen.getByRole('grid', { name: 'Agenda items' })).getAllByRole('row')
    fireEvent.keyDown(rows[0]!, { key: 'Delete' })
    await new Promise((r) => setTimeout(r, 50))
    expect(app.daemon.calls.includes('deleteAgendaItem')).toBe(false)
    fireEvent.keyDown(rows[1]!, { key: 'Delete' })
    await until(() => app.daemon.calls.includes('deleteAgendaItem'))
    expect(app.daemon.log.find((c) => c.name === 'deleteAgendaItem')!.opts.params).toEqual({
      id: 'agd_1',
      itemId: 'My question',
    })
    app.stop()
  })

  it('canDeleteItem and removalVersion: the rules Undo and the follower check rest on', () => {
    expect(canDeleteItem(item('a', 0), undefined)).toBe(true)
    expect(canDeleteItem(item('a', 0, { createdBy: 'peer:ana@x' }), shareStatus({ role: 'owner' }))).toBe(
      true,
    )
    expect(canDeleteItem(item('a', 0, { createdBy: 'peer:ana@x' }), shareStatus({ role: 'member' }))).toBe(
      false,
    )
    expect(canDeleteItem(item('a', 0, { createdBy: 'agent:claude' }), shareStatus({ role: 'member' }))).toBe(
      true,
    )
    expect(canDeleteItem(item('tmp_1', 0), undefined)).toBe(false)
    const v = (seq: number, kind: ItemVersion['kind'], restorable = true) =>
      ({ seq, kind, restorable }) as ItemVersion
    expect(removalVersion([v(1, 'added'), v(5, 'removed'), v(7, 'restored'), v(9, 'removed')])?.seq).toBe(9)
    expect(removalVersion([v(1, 'added'), v(5, 'removed', false)])).toBeNull()
  })
})

const meeting = (end: string) => ({
  eventUid: 'uid-1',
  start: '2026-09-30T10:00:00.000Z',
  end,
  recurrenceId: null,
  meetingId: 'mtg_1',
  title: '1:1',
  calendar: 'Work',
  recurring: false,
})

const recording = session('s1', {
  title: '1:1 with Ana',
  status: 'recording',
  startedAt: T,
})

describe('live: the checklist and the one suggestion', () => {
  it('ticks what is covered, highlights the current item, says when kacola ticked one (with Undo), and shows one suggestion', async () => {
    const view = agendaView({ sessionId: 's1' }, [
      item('Promo timeline', 0, {
        status: 'covered',
        changedBy: 'tracker',
        evidence: [{ segmentId: 'seg_9', quote: 'so March it is', confidence: 0.92 }],
      }),
      item('Hiring plan', 1, {
        kind: 'must-cover',
        status: 'in-progress',
        evidence: [{ segmentId: 'seg_12', quote: 'two hires in Q1', confidence: 0.8 }],
      }),
      item('Offsite dates', 2),
    ])
    view.suggestions = [
      sug('budget'),
      sug('hiring', { kind: 'looks-covered', text: 'Hiring sounds settled', itemId: 'Hiring plan' }),
    ]
    const history: StatusChange[] = [
      {
        itemId: 'Promo timeline',
        from: 'open',
        to: 'covered',
        by: 'tracker',
        at: T,
        note: null,
        evidence: view.items[0]!.evidence,
        override: false,
        auto: true,
        confidence: 0.92,
      },
    ]
    const { app } = mount({ view, history, path: '/sessions/s1', sessions: [recording] })
    const list = await screen.findByRole('list', { name: 'Agenda items' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((l) => l.getAttribute('aria-label')),
    ).toEqual(['Promo timeline', 'Hiring plan', 'Offsite dates'])
    expect(within(list).getByRole('listitem', { name: 'Hiring plan' }).getAttribute('aria-current')).toBe(
      'step',
    )
    // no times anywhere in the checklist
    expect(list.textContent).not.toMatch(/\bmin\b/)
    const promo = within(list).getByRole('listitem', { name: 'Promo timeline' })
    await within(promo).findByText('ticked by kacola')
    // undo: the item is restored to the version before the tick (its history; itself undoable)
    fireEvent.click(within(promo).getByRole('button', { name: 'Undo the tick on “Promo timeline”' }))
    await until(() => app.daemon.calls.includes('restoreAgendaItem'))
    expect(app.daemon.log.find((c) => c.name === 'restoreAgendaItem')!.opts.body).toEqual({ seq: 1 })
    await screen.findByRole('button', { name: 'Status of “Promo timeline”: Open' })
    // ONE suggestion: what just happened (looks covered) before what to ask, with the words that prompted it
    const card = await screen.findByRole('region', { name: 'Suggestion: Hiring plan' })
    expect(screen.getAllByRole('region', { name: /^Suggestion: / })).toHaveLength(1)
    expect(card.textContent).toContain('Looks covered?')
    expect(card.textContent).toContain('from your Claude')
    fireEvent.click(within(card).getByRole('button', { name: 'Show in transcript: “two hires in Q1”' }))
    await until(() => app.router.state.location.search.panel === 'transcript')
    expect(app.router.state.location.search).toMatchObject({ segment: 'seg_12' })
    fireEvent.click(within(card).getByRole('button', { name: 'Accept' }))
    await until(() => app.daemon.calls.includes('acceptSuggestion'))
    // the next one takes the slot; Not now dismisses it
    const next = await screen.findByRole('region', { name: 'Suggestion: Ask about budget' })
    expect(next.textContent).toContain('Say next')
    fireEvent.click(within(next).getByRole('button', { name: 'Not now' }))
    await until(() => app.daemon.calls.includes('dismissSuggestion'))
    await until(() => screen.queryByRole('region', { name: /^Suggestion: / }) === null)
    app.stop()
  })

  it('a tracker or agent event moves an item live (the checklist only folds events)', async () => {
    const view = agendaView({ sessionId: 's1' })
    const { app } = mount({ view, path: '/sessions/s1', sessions: [recording] })
    await screen.findByRole('button', { name: 'Status of “Hiring plan”: Open' })
    const moved = { ...view.items[1]!, status: 'covered' as const, changedBy: 'agent:claude' }
    act(() =>
      app.daemon.emit(
        durable(
          200,
          {
            type: 'agenda.item.status',
            agendaId: 'agd_1',
            version: 6,
            at: T,
            item: moved,
            change: {
              itemId: moved.id,
              from: 'open',
              to: 'covered',
              by: 'agent:claude',
              at: T,
              note: null,
              evidence: [],
              override: false,
              auto: false,
              confidence: null,
            },
          },
          's1',
        ),
      ),
    )
    await screen.findByRole('button', { name: 'Status of “Hiring plan”: Covered' })
    await screen.findByText('ticked by your Claude')
    app.stop()
  })

  it('never hurries: no “not covered yet”, no timeboxes, no missed suggestions, no card without a suggestion', async () => {
    const end = new Date(Date.now() + 3 * 60_000).toISOString()
    const view = agendaView({ sessionId: 's1', meeting: meeting(end) }, [
      item('Hiring plan', 0, { timeboxMin: 10 }),
      item('Promo timeline', 1, { kind: 'must-cover', timeboxMin: 5 }),
    ])
    view.suggestions = [sug('late', { kind: 'missed', text: 'Promo timeline was missed' })]
    const { app } = mount({ view, path: '/sessions/s1', sessions: [recording] })
    const list = await screen.findByRole('list', { name: 'Agenda items' })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('region', { name: 'Not covered yet' })).toBeNull()
    expect(screen.queryByRole('region', { name: /^Suggestion: / })).toBeNull()
    expect(list.textContent).not.toMatch(/\bmin\b/)
    expect(screen.queryByText(/min left/)).toBeNull()
    app.stop()
  })

  it('private context is hidden in case the screen is shared, until Show', async () => {
    const view = agendaView({ sessionId: 's1' })
    view.context = [
      {
        id: 'ctx_1',
        agendaId: 'agd_1',
        title: 'My notes on Ana',
        body: 'Ana wants the lead role.',
        source: { kind: 'user', ref: null },
        visibility: 'private',
        pinned: false,
        createdBy: 'user',
        createdAt: T,
        updatedAt: T,
      },
    ]
    const { app } = mount({ view, path: '/sessions/s1', sessions: [recording] })
    const box = await screen.findByRole('region', { name: 'Private context' })
    expect(box.textContent).toContain('Hidden in case you share your screen')
    expect(box.textContent).not.toContain('Ana wants the lead role.')
    fireEvent.click(within(box).getByRole('button', { name: 'Show' }))
    await within(box).findByText('Ana wants the lead role.')
    fireEvent.click(within(box).getByRole('button', { name: 'Hide' }))
    await until(() => !box.textContent?.includes('Ana wants the lead role.'))
    app.stop()
  })

  it('after the meeting: the outcome first (decided, to do), and the recap per item', async () => {
    const view = agendaView({ sessionId: 's1' }, [
      item('Promo timeline', 0, {
        status: 'covered',
        outcome: 'Outcome: March cycle.\nDecisions:\n- March, not January\nActions:\n- Ana: send the packet',
      }),
      item('Hiring plan', 1),
    ])
    const stopped = session('s1', { title: '1:1 with Ana', status: 'stopped', startedAt: T, endedAt: T })
    const { app } = mount({
      view,
      path: '/sessions/s1',
      sessions: [stopped],
      handlers: {
        getNotes: () => ({
          note: { sessionId: 's1', version: 0, markdown: '', updatedAt: null, pendingEnhancement: null },
          enhanced: null,
        }),
      },
    })
    const outcome = await screen.findByRole('region', { name: 'Outcome' })
    await within(outcome).findByText('March, not January')
    const todo = within(outcome).getByRole('list', { name: 'Action items' })
    expect(within(todo).getByRole('listitem', { name: 'send the packet' }).textContent).toContain('Ana')
    expect(within(outcome).getByText('Not settled')).toBeTruthy()
    const recap = screen.getByRole('list', { name: 'Recap per item' })
    expect(within(recap).getByRole('listitem', { name: 'Promo timeline' }).textContent).toContain('settled')
    expect(within(recap).getByRole('listitem', { name: 'Hiring plan' }).textContent).toContain('not settled')
    expect(screen.queryByRole('region', { name: /^Suggestion: / })).toBeNull()
    expect(screen.getByRole('button', { name: 'Share summary' })).toBeTruthy()
    app.stop()
  })
})

describe('the live tracker', () => {
  const status = (over: Partial<TrackerStatus> = {}): TrackerStatus => ({
    sessionId: 's1',
    agendaId: 'agd_1',
    state: 'running',
    selected: 'openai',
    provider: 'openai',
    model: 'gpt-5.5',
    detail: null,
    segments: 10,
    relevant: 6,
    rounds: 4,
    decisionCalls: 12,
    dropped: 0,
    errors: 0,
    costUsd: null,
    lastRoundAt: T,
    recap: { state: 'pending', detail: null, items: 0 },
    ...over,
  })

  it('live, its provider and fallbacks are internals: nothing about them on screen', async () => {
    const { app } = mount({
      view: agendaView({ sessionId: 's1' }),
      path: '/sessions/s1',
      sessions: [recording],
      handlers: { getAgendaTracker: () => ({ tracker: status() }) },
    })
    await screen.findByRole('list', { name: 'Agenda items' })
    act(() =>
      app.daemon.emit(
        ephemeral(
          {
            type: 'agenda.tracker',
            status: status({ state: 'degraded', provider: 'local', detail: 'quota: no credits remaining' }),
          },
          's1',
        ),
      ),
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/Following the meeting|decisions OpenAI|fell back/)).toBeNull()
    app.stop()
  })

  it('after the meeting, the recap’s state is one quiet line (agenda.tracker events)', async () => {
    const stopped = session('s1', { title: '1:1 with Ana', status: 'stopped', startedAt: T, endedAt: T })
    const { app } = mount({
      view: agendaView({ sessionId: 's1' }),
      path: '/sessions/s1',
      sessions: [stopped],
      handlers: {
        getAgendaTracker: () => ({
          tracker: status({ state: 'stopped', recap: { state: 'running', detail: null, items: 0 } }),
        }),
      },
    })
    await screen.findByRole('status', { name: 'Writing the recap…' })
    act(() =>
      app.daemon.emit(
        ephemeral(
          {
            type: 'agenda.tracker',
            status: status({
              state: 'stopped',
              recap: { state: 'unavailable', detail: 'no API key', items: 0 },
            }),
          },
          's1',
        ),
      ),
    )
    await screen.findByRole('status', { name: 'No recap: no API key' })
    app.stop()
  })

  it('a suggestion the tracker replaced (dismissed by tracker) leaves the slot; its successor takes it', async () => {
    const view = agendaView({ sessionId: 's1' })
    view.suggestions = [
      sug('old', { kind: 'next-point', source: 'tracker', text: 'Old bridge', itemId: 'Hiring plan' }),
    ]
    const { app } = mount({ view, path: '/sessions/s1', sessions: [recording] })
    const card = await screen.findByRole('region', { name: 'Suggestion: Old bridge' })
    // kacola's own suggestion is not attributed (only a surprise is)
    expect(card.textContent).not.toContain('from')
    act(() => {
      app.daemon.emit(
        durable(300, {
          type: 'agenda.suggestion.upserted',
          agendaId: 'agd_1',
          suggestion: sug('old', {
            kind: 'next-point',
            source: 'tracker',
            text: 'Old bridge',
            itemId: 'Hiring plan',
            state: 'dismissed',
            resolvedBy: 'tracker',
            resolvedAt: T,
          }),
        }),
      )
      app.daemon.emit(
        durable(301, {
          type: 'agenda.suggestion.upserted',
          agendaId: 'agd_1',
          suggestion: sug('new', {
            kind: 'next-point',
            source: 'tracker',
            text: 'New bridge',
            itemId: 'Offsite dates',
            createdAt: '2026-09-30T10:05:00.000Z',
          }),
        }),
      )
    })
    await screen.findByRole('region', { name: 'Suggestion: New bridge' })
    expect(screen.queryByText(/Old bridge/)).toBeNull()
    // not a user dismissal: nothing was sent
    expect(app.daemon.calls).not.toContain('dismissSuggestion')
    app.stop()
  })
})

describe('presence', () => {
  const lease = (over: Partial<LeaseInfo> = {}): LeaseInfo => ({
    id: 'lse_1',
    sessionId: 's1',
    agendaId: 'agd_1',
    name: 'claude',
    mode: 'suggest',
    createdAt: T,
    expiresAt: '2026-09-30T11:00:00.000Z',
    heartbeatAt: T,
    state: 'connected',
    endedAt: null,
    endReason: null,
    counts: { statusChanges: 1, suggestions: 2, items: 0, context: 1, refused: 0 },
    actions: [
      { at: T, kind: 'suggestion', outcome: 'suggested', summary: 'Asked about the budget', ref: 'sug_1' },
    ],
    ...over,
  })

  it('the chip shows the connected agent, pulses while it reads, changes mode and disconnects', async () => {
    let leases = [lease()]
    const { app } = mount({
      view: agendaView({ sessionId: 's1' }),
      path: '/sessions/s1',
      sessions: [recording],
      handlers: {
        listAgentLeases: () => ({ leases }),
        updateAgentLease: ({ body }) => ({ ...lease(), mode: (body as { mode: 'act' }).mode }),
        releaseAgentLease: () => {
          leases = [lease({ endedAt: T, endReason: 'revoked', state: 'disconnected' })]
          return { released: true }
        },
      },
    })
    // what the agent may do, said plainly
    const chip = await screen.findByRole('button', { name: 'Your Claude · can suggest. Show agent' })
    expect(document.querySelector('.record-pulse.bg-status-info')).toBeNull()
    act(() =>
      app.daemon.emit(
        ephemeral(
          { type: 'agent.presence', leaseId: 'lse_1', name: 'claude', mode: 'suggest', state: 'reading' },
          's1',
        ),
      ),
    )
    await until(() => document.querySelector('.record-pulse.bg-status-info') !== null)
    fireEvent.click(chip.isConnected ? chip : screen.getByRole('button', { name: /Claude ·/ }))
    const pop = await screen.findByRole('dialog', { name: 'Connected agents' })
    expect(pop.textContent).toContain('Asked about the budget')
    fireEvent.click(within(pop).getByRole('radio', { name: 'Act' }))
    await until(() => app.daemon.calls.includes('updateAgentLease'))
    expect(app.daemon.log.find((c) => c.name === 'updateAgentLease')!.opts).toMatchObject({
      params: { leaseId: 'lse_1' },
      body: { mode: 'act' },
    })
    fireEvent.click(within(pop).getByRole('button', { name: 'Disconnect' }))
    await until(() => app.daemon.calls.includes('releaseAgentLease'))
    await until(() => !screen.queryByRole('button', { name: /Claude ·/ }))
    app.stop()
  })

  it('a private meeting: agents only with the user’s allow', async () => {
    const priv = { ...recording, private: true }
    let allow = false
    const { app } = mount({
      view: agendaView({ sessionId: 's1' }),
      path: '/sessions/s1',
      sessions: [priv],
      handlers: {
        getAgentAccess: () => ({ sessionId: 's1', private: true, allowAgents: allow, attachable: allow }),
        setAgentAccess: ({ body }) => {
          allow = (body as { allowAgents: boolean }).allowAgents
          return { sessionId: 's1', private: true, allowAgents: allow, attachable: allow }
        },
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Agent access' }))
    const sw = await screen.findByRole('switch', { name: 'Allow agents in this private meeting' })
    fireEvent.click(sw)
    await until(() => app.daemon.calls.includes('setAgentAccess'))
    expect(app.daemon.log.find((c) => c.name === 'setAgentAccess')!.opts.body).toEqual({ allowAgents: true })
    app.stop()
  })
})

describe('deep links', () => {
  it('opens the agenda a kacola:// link names (resolved, created if needed)', async () => {
    const fb = fakeBridge({
      takeDeepLink: async () => 'kacola://meeting/uid-1?start=2026-09-30T10:00:00.000Z',
    } as never)
    const view = agendaView()
    const { app } = mount({
      view,
      path: '/',
      bridge: fb,
      handlers: { resolveAgendaLink: () => ({ agenda: view, meeting: null, live: false, created: true }) },
    })
    await screen.findByRole('heading', { name: '1:1 with Ana' })
    expect(app.daemon.log.find((c) => c.name === 'resolveAgendaLink')!.opts.body).toEqual({
      link: 'kacola://meeting/uid-1?start=2026-09-30T10:00:00.000Z',
      create: true,
      includePrivate: true,
    })
    expect(app.router.state.location.pathname).toBe('/agendas/agd_1')
    app.stop()
  })
})

describe('team sharing', () => {
  const LINK = 'https://share.example/a/AbCdEfGhIjKlMnOpQrStUvWxYz012345'
  const ivy: SharedActor = {
    participantId: 'spt_ivy',
    role: 'invitee',
    label: 'ivy@example.com',
    name: 'Ivy',
    by: 'user',
  }
  const ben: SharedActor = {
    participantId: 'spt_ben',
    role: 'member',
    label: 'ben@example.com',
    name: null,
    by: 'user',
  }
  const owner: SharedActor = {
    participantId: 'owner',
    role: 'owner',
    label: 'kacper@example.com',
    name: null,
    by: 'user',
  }
  const comment = (text: string, itemId: string | null): SharedComment => ({
    id: `cmt_${text.length}`,
    occurrence: 'agd_1',
    itemId,
    author: ivy,
    text,
    at: T,
    hidden: false,
  })
  const shared = shareStatus({
    shared: true,
    role: 'owner',
    shareId: 'shr_1',
    link: LINK,
    ownerName: 'Kacper',
    state: 'ok',
    lastSyncAt: T,
    members: ['ben@example.com'],
  })
  const change = (over: Partial<SharedChange>): SharedChange => ({
    id: `chg_${over.key}`,
    key: 'k',
    itemId: 'Hiring plan',
    occurrence: 'agd_1',
    from: 'open',
    to: 'covered',
    actor: ben,
    at: T,
    receivedAt: T,
    auto: false,
    confidence: null,
    outcome: 'applied',
    reason: null,
    before: 'open',
    after: 'covered',
    ...over,
  })

  it('once shared: the share’s options, the link to copy, the state; agenda.share events re-render it; unshare asks first', async () => {
    const fb = fakeBridge()
    let current = { ...shared }
    const { app } = mount({
      view: agendaView(),
      path: '/agendas/agd_1',
      bridge: fb,
      handlers: {
        getAgendaShare: () => current,
        updateAgendaShare: ({ body }) => {
          current = { ...current, ...(body as object) }
          return current
        },
        unshareAgenda: () => {
          current = shareStatus()
          return current
        },
        getAgendaShareHistory: () => ({ changes: [] }),
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Shared: Up to date' }))
    const dlg = await screen.findByRole('dialog', { name: 'Share the agenda' })
    await within(dlg).findByLabelText('Web link')
    expect((within(dlg).getByLabelText('Web link') as HTMLInputElement).value).toBe(LINK)
    expect(within(dlg).getByText('Up to date')).toBeTruthy()
    fireEvent.click(within(dlg).getByRole('button', { name: 'Copy link' }))
    await until(() => fb.bridge.copyText.mock.calls.length === 1)
    expect(fb.bridge.copyText.mock.calls[0]![0]).toBe(LINK)
    // the daemon's sync reports arrive as agenda.share events: rendered as they come, nothing refetched
    act(() =>
      app.daemon.emit(
        ephemeral({
          type: 'agenda.share',
          agendaId: 'agd_1',
          status: { ...current, state: 'error', error: 'host down' },
        }),
      ),
    )
    await within(dlg).findByText('Sync failed')
    expect(within(dlg).getByRole('status', { name: 'host down' })).toBeTruthy()
    act(() => app.daemon.emit(ephemeral({ type: 'agenda.share', agendaId: 'agd_1', status: current })))
    await within(dlg).findByText('Up to date')
    // unshare: a confirmation first; then the one action to send it again
    fireEvent.click(within(dlg).getByRole('button', { name: 'Unshare…' }))
    const sure = await screen.findByRole('alertdialog', { name: 'Stop sharing this agenda?' })
    expect(app.daemon.calls).not.toContain('unshareAgenda')
    fireEvent.click(within(sure).getByRole('button', { name: 'Unshare' }))
    await until(() => app.daemon.calls.includes('unshareAgenda'))
    await screen.findByRole('button', { name: 'Send the agenda' })
    app.stop()
  })

  it('shows contributions attributed: invitee items and comments, peers’ status changes, the merge history', async () => {
    const view = agendaView({}, [
      item('Promo timeline', 0),
      item('Hiring plan', 1, { status: 'covered', changedBy: 'peer:ben@example.com' }),
      item('Offsite dates', 2, { createdBy: 'invitee:ivy@example.com' }),
      item('Budget', 3, { status: 'in-progress', changedBy: 'peer:ben@example.com/tracker' }),
    ])
    const sc = (itemId: string, to: AgendaItem['status'], by: string): StatusChange => ({
      itemId,
      from: 'open',
      to,
      by,
      at: T,
      note: null,
      evidence: [],
      override: false,
      auto: false,
      confidence: null,
    })
    const history = [
      sc('Hiring plan', 'covered', 'peer:ben@example.com'),
      sc('Budget', 'in-progress', 'peer:ben@example.com/tracker'),
    ]
    const { app } = mount({
      view,
      history,
      path: '/agendas/agd_1',
      handlers: {
        getAgendaShare: () => ({
          ...shared,
          refused: 1,
          comments: [comment('Friday works for me', 'Offsite dates'), comment('Can we start late?', null)],
          participants: [
            {
              id: 'spt_ivy',
              shareId: 'shr_1',
              email: 'ivy@example.com',
              name: 'Ivy',
              role: 'invitee',
              createdAt: T,
              revokedAt: null,
            },
            {
              id: 'spt_ben',
              shareId: 'shr_1',
              email: 'ben@example.com',
              name: null,
              role: 'member',
              createdAt: T,
              revokedAt: null,
            },
          ],
        }),
        getAgendaShareHistory: () => ({
          changes: [
            change({ key: 'a' }),
            change({ key: 'b', itemId: 'Budget', to: 'in-progress', actor: { ...ben, by: 'tracker' } }),
            change({ key: 'c', to: 'open', actor: owner }),
            change({
              key: 'd',
              outcome: 'refused',
              reason: 'the owner set it to open by hand',
              actor: { ...ben, by: 'agent:claude' },
            }),
          ],
        }),
      },
    })
    const list = await screen.findByRole('grid', { name: 'Agenda items' })
    const row = (t: string) =>
      within(list)
        .getAllByRole('row')
        .find((r) => r.textContent?.includes(t))!
    await until(() => (row('Offsite dates').textContent ?? '').includes('added by Ivy (ivy@example.com)'))
    expect(row('Offsite dates').textContent).toContain('Ivy (invitee): Friday works for me')
    expect(row('Hiring plan').textContent).toContain('by Ben')
    expect(row('Budget').textContent).toContain('by kacola')
    fireEvent.click(within(row('Budget')).getByRole('button', { name: 'History of “Budget”' }))
    await screen.findByText('Open → In progress by kacola')
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'History of “Budget”' }), { key: 'Escape' })
    await until(() => screen.queryByRole('dialog', { name: 'History of “Budget”' }) === null)
    // the Sharing section (prep shows it once shared): comments, people, the merge history
    const comments = await screen.findByRole('list', { name: 'Comments' })
    expect(comments.textContent).toMatch(/Ivy on “Offsite dates”.*Friday works for me/)
    expect(comments.textContent).toMatch(/on “the agenda”.*Can we start late\?/)
    expect(screen.getByRole('list', { name: 'People' }).textContent).toMatch(
      /Ivy · ivy@example.com.*Invitee.*ben@example.com.*Follows in kacola/,
    )
    const merged = await screen.findByRole('list', { name: 'Status changes' })
    const entries = within(merged)
      .getAllByRole('listitem')
      .map((l) => l.getAttribute('aria-label'))
    expect(entries).toEqual([
      'Hiring plan: Open → Covered by Ben’s Claude, Refused',
      'Hiring plan: Open → Open by you, Applied',
      'Budget: Open → In progress by Ben’s kacola, Applied',
      'Hiring plan: Open → Covered by Ben, Applied',
    ])
    expect(merged.textContent).toContain('the owner set it to open by hand')
    expect(screen.getByText('1 change was refused or superseded')).toBeTruthy()
    app.stop()
  })

  it('a followed copy whose owner stopped sharing: the banner, the state on the button', async () => {
    const { app } = mount({
      view: agendaView(),
      path: '/agendas/agd_1',
      handlers: {
        getAgendaShare: () =>
          shareStatus({
            shared: false,
            role: 'member',
            shareId: 'shr_1',
            ownerName: 'Kacper',
            state: 'revoked',
          }),
      },
    })
    await screen.findByRole('status', {
      name: 'Kacper stopped sharing this agenda. Your copy stays on this computer.',
    })
    expect(screen.getByRole('button', { name: 'Following: No longer shared' })).toBeTruthy()
    app.stop()
  })

  it('Share summary offers the Share recap switch (owner, shared)', async () => {
    const view = agendaView({ sessionId: 's1' }, [
      item('Promo timeline', 0, { status: 'covered', outcome: 'March.' }),
    ])
    const stopped = session('s1', { title: '1:1 with Ana', status: 'stopped', startedAt: T, endedAt: T })
    let current = shared
    const { app } = mount({
      view,
      path: '/sessions/s1',
      sessions: [stopped],
      handlers: {
        getAgendaShare: () => current,
        shareAgendaRecap: ({ body }) => {
          current = { ...current, recapShared: (body as { shared: boolean }).shared }
          return current
        },
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Share summary' }))
    const dlg = await screen.findByRole('dialog', { name: 'Share summary' })
    expect(dlg.textContent).toContain('# 1:1 with Ana')
    const sw = await within(dlg).findByRole('switch', { name: /Share recap/ })
    expect((sw as HTMLInputElement).checked).toBe(false)
    fireEvent.click(sw)
    await until(() => app.daemon.calls.includes('shareAgendaRecap'))
    expect(app.daemon.log.find((c) => c.name === 'shareAgendaRecap')!.opts.body).toEqual({ shared: true })
    await until(() => (screen.getByRole('switch', { name: /Share recap/ }) as HTMLInputElement).checked)
    app.stop()
  })

  it('follows a shared agenda: link + email → code → the local copy opens; a wrong code says so', async () => {
    const view = agendaView({ id: 'agd_copy', title: 'Team sync' })
    const { app } = mount({
      view,
      path: '/',
      handlers: {
        followAgenda: () => ({ pending: true, expiresAt: '2026-09-30T10:15:00.000Z' }),
        confirmFollowAgenda: ({ body }) => {
          if ((body as { code: string }).code !== 'ABCD-EFGH')
            throw Object.assign(new Error('wrong code'), { status: 403 })
          return shareStatus({ agendaId: 'agd_copy', shared: true, role: 'member', state: 'ok', link: LINK })
        },
        getAgenda: () => view,
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Main menu' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Follow a shared agenda…' }))
    const dlg = await screen.findByRole('dialog', { name: 'Follow a shared agenda' })
    fireEvent.change(within(dlg).getByLabelText('Link'), { target: { value: 'https://share.example/x' } })
    expect(within(dlg).getByText(/not a shared agenda link/)).toBeTruthy()
    fireEvent.change(within(dlg).getByLabelText('Link'), { target: { value: LINK } })
    fireEvent.change(within(dlg).getByLabelText('Your email'), { target: { value: 'ben@example.com' } })
    fireEvent.change(within(dlg).getByLabelText('Your name (optional)'), { target: { value: 'Ben' } })
    fireEvent.click(within(dlg).getByRole('button', { name: 'Send code' }))
    await within(dlg).findByLabelText('Code')
    expect(app.daemon.log.find((c) => c.name === 'followAgenda')!.opts.body).toEqual({
      link: LINK,
      email: 'ben@example.com',
      name: 'Ben',
    })
    fireEvent.change(within(dlg).getByLabelText('Code'), { target: { value: 'XXXX-XXXX' } })
    fireEvent.click(within(dlg).getByRole('button', { name: 'Follow' }))
    await within(dlg).findByText(/That code is wrong or has expired/)
    fireEvent.change(within(dlg).getByLabelText('Code'), { target: { value: 'ABCD-EFGH' } })
    fireEvent.click(within(dlg).getByRole('button', { name: 'Follow' }))
    await screen.findByRole('heading', { name: 'Team sync' })
    expect(app.router.state.location.pathname).toBe('/agendas/agd_copy')
    expect(screen.queryByRole('dialog', { name: 'Follow a shared agenda' })).toBeNull()
    app.stop()
  })

  it('a shared agenda’s web link handed to the app opens Follow with the link filled in', async () => {
    const fb = fakeBridge({ takeDeepLink: async () => LINK } as never)
    const { app } = mount({ view: agendaView(), path: '/', bridge: fb })
    const dlg = await screen.findByRole('dialog', { name: 'Follow a shared agenda' })
    expect((within(dlg).getByLabelText('Link') as HTMLInputElement).value).toBe(LINK)
    expect(app.daemon.calls).not.toContain('resolveAgendaLink')
    expect(app.daemon.calls).not.toContain('followAgenda')
    app.stop()
  })
})
