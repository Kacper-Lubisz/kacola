import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// `gnomeola mcp`'s live channel against the REAL daemon replaying a fixture meeting, over real stdio
// JSON-RPC: live_sessions / live_attach / live_events / live_detach, the agenda tools acting under the
// lease while attached (attribution, mode), and the gnomeola://live resource with a subscription that
// sends notifications/resources/updated as events arrive.

const MAIN = join(import.meta.dirname, '..', '..', 'cli', 'src', 'main.ts')
const FIXTURE = join(
  import.meta.dirname,
  '..',
  '..',
  'testkit',
  'fixtures',
  'agenda',
  'manager-1on1',
  'truth.json',
)
let d: DaemonHandle
let child: ChildProcess
let nextId = 1
const pending = new Map<number, (v: unknown) => void>()
const notifications: { method: string; params?: { uri?: string } }[] = []

function rpc(method: string, params: unknown): Promise<{ result?: unknown; error?: unknown }> {
  const id = nextId++
  child.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
  return new Promise((resolve) => pending.set(id, resolve as (v: unknown) => void))
}

async function tool(name: string, args: Record<string, unknown>) {
  const r = (await rpc('tools/call', { name, arguments: args })) as {
    result: { content: { text: string }[]; isError?: boolean }
  }
  const text = r.result.content[0]!.text
  return { text, isError: Boolean(r.result.isError), json: () => JSON.parse(text) }
}

let sessionId = ''
let agendaId = ''
const box = mkdtempSync(join(tmpdir(), 'gnomeola-e2e-mcp-live-'))
const calFile = join(box, 'calendar.json')
const now = Date.now()
const t = (min: number) => new Date(now + min * 60_000).toISOString()

beforeAll(async () => {
  writeFileSync(
    calFile,
    JSON.stringify({
      calendars: [{ id: 'cal-work', name: 'Work' }],
      occurrences: [
        {
          sourceUid: 'cal-work',
          calendarName: 'Work',
          uid: 'dana@x',
          recurrenceId: null,
          summary: '1:1 with Dana',
          description: '',
          location: '',
          url: '',
          start: t(-2),
          end: t(30),
          allDay: false,
          startDate: null,
          endDate: null,
          timezone: null,
          status: 'CONFIRMED',
          myPartstat: null,
          organizer: null,
          attendees: 2,
          recurring: false,
          xprops: {},
        },
      ],
    }),
  )
  d = await startDaemon({
    env: {
      // the channel on its own: the live tracker would check items off under the agents' feet
      GNOMEOLA_TRACKER: 'off',
      GNOMEOLA_CALENDAR: `file:${calFile}`,
      GNOMEOLA_FAKE_PIPELINE: JSON.stringify({
        scriptFile: FIXTURE,
        speed: 30,
        partialEveryMs: 3000,
        finalizeAfterMs: 30,
      }),
    },
  })
  child = spawn(process.execPath, [MAIN, 'mcp'], {
    env: { ...process.env, GNOMEOLA_URL: d.baseUrl },
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  createInterface({ input: child.stdout! }).on('line', (line) => {
    const msg = JSON.parse(line) as { id?: number; method?: string; params?: { uri?: string } }
    if (msg.id !== undefined) pending.get(msg.id)?.(msg)
    else if (msg.method) notifications.push({ method: msg.method, params: msg.params })
  })
  await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'e2e', version: '0' },
  })
  child.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
}, 60_000)

afterAll(async () => {
  child?.stdin?.end()
  child?.kill()
  await d?.stop()
  rmSync(box, { recursive: true, force: true })
})

describe('gnomeola mcp: the live channel', () => {
  it('lists nothing to attach to before a recording, and refuses attach', async () => {
    expect((await tool('live_sessions', {})).json()).toEqual({ sessions: [] })
    const a = await tool('live_attach', {})
    expect(a.isError).toBe(true)
    expect(a.text).toMatch(/no recording is in progress/)
    expect((await tool('live_events', {})).isError).toBe(true)
  })

  it('attaches, streams the meeting, and notifies a subscriber of the live resource', async () => {
    await waitFor(async () => (await d.client.call('nextMeeting')).current !== null, 10_000, 'the calendar')
    const { current } = await d.client.call('nextMeeting')
    const agenda = await d.client.call('createAgenda', {
      body: {
        meetingId: current!.id,
        markdown: '- [ ] Promotion timeline to senior [must-cover]\n- [ ] December vacation dates\n',
      },
    })
    agendaId = agenda.agenda.id
    const waiting = tool('live_sessions', { wait: 10 })
    await new Promise((r) => setTimeout(r, 200))
    sessionId = (await d.client.call('joinMeeting', { params: { id: current!.id }, body: {} })).session.id
    expect((await waiting).json().sessions[0]).toMatchObject({ sessionId, agendaId })

    const res = (await rpc('resources/list', {})) as { result: { resources: { uri: string }[] } }
    expect(res.result.resources.map((r) => r.uri)).toContain('gnomeola://live')
    expect((await rpc('resources/subscribe', { uri: 'gnomeola://live' })).error).toBeUndefined()

    const a = await tool('live_attach', { mode: 'suggest', name: 'mcp-claude' })
    expect(a.isError, a.text).toBe(false)
    expect(a.json().lease).toMatchObject({ sessionId, name: 'mcp-claude', mode: 'suggest' })

    await waitFor(
      () => notifications.some((n) => n.method === 'notifications/resources/updated'),
      10_000,
      'a resource update',
    )
    const events: { type: string; text?: string; speaker?: string }[] = []
    await waitFor(
      async () => {
        const r = (await tool('live_events', { max: 200 })).json()
        events.push(...r.events)
        return events.some((e) => e.type === 'segment.final' && /nominate you for senior/.test(e.text ?? ''))
      },
      20_000,
      'the promotion settled',
    )
    expect(events[0]).toMatchObject({ type: 'attached' })
    expect(new Set(events.filter((e) => e.type === 'segment.final').map((e) => e.speaker))).toEqual(
      new Set(['Dana', 'me']),
    )
    const read = (await rpc('resources/read', { uri: 'gnomeola://live' })) as {
      result: { contents: { text: string }[] }
    }
    const state = JSON.parse(read.result.contents[0]!.text)
    expect(state.attached).toMatchObject({ name: 'mcp-claude' })
    expect(state.recent.length).toBeGreaterThan(0)
  })

  it('the agenda tools act under the lease while attached (suggest mode: suggestions, as the agent)', async () => {
    const seg = (
      await d.client.call('getTranscript', { params: { id: sessionId }, query: {} })
    ).segments.find((x) => /nominate you for senior/.test(x.text))!
    const st = await tool('set_agenda_item_status', {
      agenda: 'live',
      item: 'Promotion',
      status: 'covered',
      segment: seg.id,
    })
    expect(st.isError, st.text).toBe(false)
    expect(st.json()).toMatchObject({
      change: null,
      suggested: { kind: 'set-status', source: 'agent:mcp-claude' },
    })
    const sug = await tool('suggest_for_agenda', {
      agenda: 'live',
      text: 'ask about the March committee',
      kind: 'question',
    })
    expect(sug.isError, sug.text).toBe(false)
    expect(sug.json().suggestion.source).toBe('agent:mcp-claude')
    const card = await tool('add_context_card', {
      agenda: 'live',
      title: 'Committee',
      body: 'meets in March',
      shared: true,
    })
    expect(card.isError).toBe(true) // an agent's cards are private: sharing is the user's call
    const v = await d.client.call('getAgenda', { params: { id: agendaId } })
    expect(v.items[0]!.status).toBe('open') // the user decides
    // the stream carried the agent's own suggestion back
    await waitFor(
      async () => {
        const r = (await tool('live_events', {})).json()
        return r.events.some((e: { type: string }) => e.type === 'suggestion')
      },
      5_000,
      'the suggestion event',
    )
  })

  it('detaches: the lease is released and the tools act as the user again', async () => {
    expect((await tool('live_detach', {})).json()).toEqual({ detached: true })
    const { leases } = await d.client.call('listAgentLeases', {
      params: { id: sessionId },
      query: { includeEnded: true },
    })
    expect(leases[0]).toMatchObject({ name: 'mcp-claude', endReason: 'released' })
    const sug = await tool('suggest_for_agenda', { agenda: agendaId, text: 'x', kind: 'question' })
    expect(sug.isError).toBe(true)
    expect(sug.text).toMatch(/needs a live lease/)
  })
})
