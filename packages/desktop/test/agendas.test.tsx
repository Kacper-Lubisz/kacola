// @vitest-environment jsdom
import type {
  AgendaItem,
  AgendaView,
  DurableEvent,
  LeaseInfo,
  SseMessage,
  StatusChange,
  Suggestion,
} from '@gnomeola/protocol'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetDeepLinksForTests } from '../src/renderer/features/agendas/deep-links.tsx'
import { usePanelPrefs } from '../src/renderer/features/agendas/live-panel.tsx'
import { fakeBridge, renderApp } from './app-harness.tsx'
import type { Handler } from './helpers.ts'
import { durable, ephemeral, session, until } from './helpers.ts'

// The agenda screens through the real router, React Query and EventBridge, over a fake daemon that keeps
// one agenda in memory and echoes every write as the durable event the real daemon would append.

afterEach(() => cleanup())
beforeEach(() => {
  resetDeepLinksForTests()
  usePanelPrefs.setState({ compact: false, view: 'agenda' })
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
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }))
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
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move Down' }))
    await until(() => app.daemon.calls.includes('reorderAgendaItems'))
    expect(app.daemon.log.find((c) => c.name === 'reorderAgendaItems')!.opts.body).toEqual({
      itemIds: ['Hiring plan', 'Promo timeline', 'Offsite dates'],
    })
    const rows = within(screen.getByRole('grid', { name: 'Agenda items' })).getAllByRole('row')
    expect(rows[0]!.textContent).toContain('Hiring plan')
    app.stop()
  })

  it('Add Link to Invite: refused by the calendar → the reason and the block to copy', async () => {
    const fb = fakeBridge()
    const { app } = mount({
      view: agendaView({
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
      }),
      path: '/agendas/agd_1',
      bridge: fb,
      handlers: {
        agendaInviteBlock: () => ({
          block: '-- kacola agenda --\nAgenda: kacola://agenda/agd_1\n-- /kacola --',
          appLink: 'kacola://agenda/agd_1',
          webLink: null,
          written: false,
          reason: 'you are not the organiser of this event',
        }),
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Add Link to Invite' }))
    const dlg = await screen.findByRole('dialog', { name: 'Couldn’t Edit the Invitation' })
    expect(within(dlg).getByRole('status', { name: 'you are not the organiser of this event' })).toBeTruthy()
    expect(app.daemon.log.find((c) => c.name === 'agendaInviteBlock')!.opts.body).toEqual({ write: true })
    fireEvent.click(within(dlg).getByRole('button', { name: 'Copy' }))
    await until(() => fb.bridge.copyText.mock.calls.length === 1)
    expect(fb.bridge.copyText.mock.calls[0]![0]).toContain('kacola://agenda/agd_1')
    app.stop()
  })

  it('Plan with Claude streams proposals; unticked ones are left out', async () => {
    const { app } = mount({ view: agendaView(), path: '/agendas/agd_1' })
    const msgs = [
      { type: 'started', agendaId: 'agd_1', basedOn: { goals: 1, pastMeetings: 2, existingItems: 3 } },
      { type: 'item', item: { text: 'Promo criteria', kind: 'question', owner: null, timeboxMin: 5 } },
      { type: 'item', item: { text: 'Next review date', kind: 'decision', owner: 'ana', timeboxMin: null } },
      { type: 'done', items: 2, model: 'claude-test', usage: { inputTokens: 10, outputTokens: 5 } },
    ]
    let body: unknown
    ;(app.daemon.client as unknown as { stream: unknown }).stream = async function* (
      name: string,
      o: { body: unknown },
    ): AsyncGenerator<SseMessage> {
      expect(name).toBe('draftAgenda')
      body = o.body
      for (const m of msgs) yield { data: JSON.stringify(m) } as SseMessage
    }
    fireEvent.click(await screen.findByRole('button', { name: 'Plan with Claude' }))
    const dlg = await screen.findByRole('dialog', { name: 'Plan with Claude' })
    fireEvent.click(within(dlg).getByRole('button', { name: 'Draft Items' }))
    await within(dlg).findByText('Drafted by claude-test')
    expect(body).toEqual({ goals: ['agree the promo timeline'], includePrivate: true })
    expect(within(dlg).getByText('Using 2 past meetings')).toBeTruthy()
    fireEvent.click(within(dlg).getByRole('checkbox', { name: /Next review date/ }))
    fireEvent.click(within(dlg).getByRole('button', { name: 'Add 1 Item' }))
    await until(() => app.daemon.calls.includes('addAgendaItems'))
    expect(app.daemon.log.find((c) => c.name === 'addAgendaItems')!.opts.body).toEqual({
      items: [{ text: 'Promo criteria', kind: 'question', owner: null, timeboxMin: 5 }],
    })
    app.stop()
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

describe('live panel', () => {
  it('next talking point, suggestions, auto marks with undo, evidence chips', async () => {
    const view = agendaView({ sessionId: 's1' }, [
      item('Promo timeline', 0, {
        status: 'covered',
        changedBy: 'tracker',
        evidence: [{ segmentId: 'seg_9', quote: 'so March it is', confidence: 0.92 }],
      }),
      item('Hiring plan', 1, { kind: 'must-cover' }),
      item('Offsite dates', 2),
    ])
    view.suggestions = [sug('budget')]
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
    const { app } = mount({ view, history, path: '/sessions/s1?tab=agenda', sessions: [recording] })
    const next = await screen.findByRole('region', { name: 'Next talking point' })
    expect(next.textContent).toContain('Hiring plan')
    const promo = screen.getByRole('listitem', { name: 'Promo timeline' })
    await within(promo).findByText('auto')
    const chip = within(promo).getByRole('button', { name: 'Show in transcript: “so March it is”' })
    // undo: the user sets it back (an override)
    fireEvent.click(within(promo).getByRole('button', { name: 'Undo' }))
    await until(() => app.daemon.calls.includes('setAgendaItemStatus'))
    expect(app.daemon.log.find((c) => c.name === 'setAgendaItemStatus')!.opts.body).toMatchObject({
      status: 'open',
    })
    // a suggestion becomes an item (and is dismissed)
    const s = screen.getByRole('listitem', { name: 'Suggestion: Ask about budget' })
    expect(within(s).getByText('by Claude')).toBeTruthy()
    fireEvent.click(within(s).getByRole('button', { name: 'Turn into Item' }))
    await until(
      () => app.daemon.calls.includes('addAgendaItems') && app.daemon.calls.includes('dismissSuggestion'),
    )
    expect(app.daemon.log.find((c) => c.name === 'addAgendaItems')!.opts.body).toEqual({
      items: [{ text: 'Ask about budget', kind: 'question' }],
    })
    await until(() => !screen.queryByRole('listitem', { name: 'Suggestion: Ask about budget' }))
    // the evidence chip opens the transcript at that line
    fireEvent.click(chip)
    await until(() => app.router.state.location.search.tab === 'transcript')
    expect(app.router.state.location.search).toMatchObject({ segment: 'seg_9' })
    app.stop()
  })

  it('a tracker event moves an item live (the panel only folds events)', async () => {
    const view = agendaView({ sessionId: 's1' })
    const { app } = mount({ view, path: '/sessions/s1?tab=agenda', sessions: [recording] })
    await screen.findByRole('button', { name: 'Status of “Hiring plan”: Open' })
    const moved = { ...view.items[1]!, status: 'in-progress' as const, changedBy: 'agent:claude' }
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
              to: 'in-progress',
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
    await screen.findByRole('button', { name: 'Status of “Hiring plan”: In progress' })
    await screen.findByText('checked by Claude')
    app.stop()
  })

  it('shows “Not covered yet” from five minutes before the end, must-cover first', async () => {
    const end = new Date(Date.now() + 3 * 60_000).toISOString()
    const view = agendaView({ sessionId: 's1', meeting: meeting(end) }, [
      item('Hiring plan', 0),
      item('Promo timeline', 1, { kind: 'must-cover' }),
    ])
    const { app } = mount({ view, path: '/sessions/s1?tab=agenda', sessions: [recording] })
    const card = await screen.findByRole('region', { name: 'Not covered yet' })
    const rows = within(card).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Promo timeline'),
      expect.stringContaining('Hiring plan'),
    ])
    expect(card.textContent).toMatch(/3 min left/)
    app.stop()
  })

  it('interview view: Told (the answer and its quote) / Not told yet', async () => {
    const view = agendaView({ sessionId: 's1' }, [
      item('Salary range', 0, {
        kind: 'info-to-get',
        status: 'covered',
        outcome: '90 to 100k',
        evidence: [{ segmentId: 'seg_3', quote: 'we pay ninety to a hundred', confidence: 0.9 }],
      }),
      item('Team size', 1, { kind: 'info-to-get' }),
    ])
    const { app } = mount({ view, path: '/sessions/s1?tab=agenda', sessions: [recording] })
    fireEvent.click(await screen.findByRole('radio', { name: 'Interview' }))
    const told = await screen.findByRole('region', { name: 'Told (1)' })
    expect(told.textContent).toContain('90 to 100k')
    expect(within(told).getByRole('button', { name: /we pay ninety to a hundred/ })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Not told yet (1)' }).textContent).toContain('Team size')
    app.stop()
  })

  it('compact mode keeps what is in progress (and the next point)', async () => {
    const view = agendaView({ sessionId: 's1' }, [
      item('Promo timeline', 0, { status: 'in-progress' }),
      item('Hiring plan', 1),
    ])
    const { app } = mount({ view, path: '/sessions/s1?tab=agenda', sessions: [recording] })
    fireEvent.click(await screen.findByRole('button', { name: 'Compact view' }))
    const items = await screen.findByRole('list', { name: 'Agenda items' })
    expect(
      within(items)
        .getAllByRole('listitem')
        .map((l) => l.getAttribute('aria-label')),
    ).toEqual(['Promo timeline'])
    expect(screen.getByRole('region', { name: 'Next talking point' }).textContent).toContain('Hiring plan')
    app.stop()
  })

  it('after the meeting: the recap per item (outcome, decisions, actions)', async () => {
    const view = agendaView({ sessionId: 's1' }, [
      item('Promo timeline', 0, {
        status: 'covered',
        outcome: 'Outcome: March cycle.\nDecisions:\n- March, not January\nActions:\n- Ana: send the packet',
      }),
      item('Hiring plan', 1),
    ])
    const stopped = session('s1', { title: '1:1 with Ana', status: 'stopped', startedAt: T, endedAt: T })
    const { app } = mount({ view, path: '/sessions/s1?tab=agenda', sessions: [stopped] })
    const recap = await screen.findByRole('list', { name: 'Recap per item' })
    const promo = within(recap).getByRole('listitem', { name: 'Promo timeline' })
    expect(promo.textContent).toMatch(/March cycle\..*March, not January.*Ana: send the packet/)
    expect(within(recap).getByRole('listitem', { name: 'Hiring plan' }).textContent).toContain(
      'No outcome recorded.',
    )
    expect(screen.queryByRole('region', { name: 'Next talking point' })).toBeNull()
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
      path: '/sessions/s1?tab=agenda',
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
    const chip = await screen.findByRole('button', { name: 'Claude · connected. Show agent' })
    act(() =>
      app.daemon.emit(
        ephemeral(
          { type: 'agent.presence', leaseId: 'lse_1', name: 'claude', mode: 'suggest', state: 'reading' },
          's1',
        ),
      ),
    )
    await screen.findByRole('button', { name: 'Claude · reading. Show agent' })
    expect(document.querySelector('.record-pulse')).not.toBeNull()
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
      path: '/sessions/s1?tab=agenda',
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
