import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { BUDGET, countTokens } from '@gnomeola/cli'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// `gnomeola mcp` agenda tools against the REAL daemon, over real stdio JSON-RPC (a minimal MCP client:
// initialize, then tools/call): the same verbs, budgets and privacy as the CLI.

const MAIN = join(import.meta.dirname, '..', '..', 'cli', 'src', 'main.ts')
const box = mkdtempSync(join(tmpdir(), 'gnomeola-e2e-mcp-agenda-'))
const calFile = join(box, 'calendar.json')
let d: DaemonHandle
let child: ChildProcess
let nextId = 1
const pending = new Map<number, (v: unknown) => void>()

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

beforeAll(async () => {
  const now = Date.now()
  const t = (min: number) => new Date(now + min * 60_000).toISOString()
  writeFileSync(
    calFile,
    JSON.stringify([
      {
        sourceUid: 'cal-work',
        calendarName: 'Work',
        uid: 'sync@x',
        recurrenceId: null,
        summary: 'Planning sync',
        description: '',
        location: '',
        url: '',
        start: t(45),
        end: t(75),
        allDay: false,
        startDate: null,
        endDate: null,
        timezone: null,
        status: 'CONFIRMED',
        myPartstat: null,
        organizer: null,
        attendees: 3,
        recurring: false,
        xprops: {},
      },
    ]),
  )
  d = await startDaemon({ env: { GNOMEOLA_CALENDAR: `file:${calFile}` } })
  await waitFor(async () => (await d.client.call('nextMeeting')).next !== null, 10_000, 'the calendar file')
  child = spawn(process.execPath, [MAIN, 'mcp'], {
    env: { ...process.env, GNOMEOLA_URL: d.baseUrl },
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  createInterface({ input: child.stdout! }).on('line', (line) => {
    const msg = JSON.parse(line) as { id?: number }
    if (msg.id !== undefined) pending.get(msg.id)?.(msg)
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

describe('gnomeola mcp: agenda tools, real daemon', () => {
  it('create → add → status → context → show, under the CLI budgets; private cards by default', async () => {
    const c = await tool('create_agenda', {
      meeting: 'next',
      markdown: '## Goals\n- pick a launch date\n\n- [ ] Launch date (10m) [decision]\n',
    })
    expect(c.isError, c.text).toBe(false)
    expect(c.json().agenda).toMatchObject({ title: 'Planning sync', goals: ['pick a launch date'] })
    const again = await tool('create_agenda', { meeting: 'next' })
    expect(again.isError).toBe(true)
    expect(again.text).toMatch(/already has an agenda[\s\S]*\nhint: rerun with --reuse/)
    const add = await tool('add_agenda_items', { items: ['Risks (5m, @ana) [must-cover]', 'Budget'] })
    expect(add.json().added.map((i: { text: string }) => i.text)).toEqual(['Risks', 'Budget'])
    const st = await tool('set_agenda_item_status', { item: 'risks', status: 'in-progress' })
    expect(st.json().change).toMatchObject({ from: 'open', to: 'in-progress', by: 'user' })
    const card = await tool('add_context_card', { title: 'My notes', body: 'salary: keep private' })
    expect(card.json().card.visibility).toBe('private')
    const sug = await tool('suggest_for_agenda', {
      text: 'ask who owns the risks',
      kind: 'question',
      item: '2',
    })
    // suggestions come from a live-attached agent (mcp-live.int.test.ts)
    expect(sug.isError).toBe(true)
    expect(sug.text).toMatch(/needs a live lease/)
    const show = await tool('get_agenda', { history: true })
    expect(countTokens(show.text)).toBeLessThanOrEqual(BUDGET.agenda)
    expect(show.json().items.map((i: { text: string; status: string }) => `${i.text}:${i.status}`)).toEqual([
      'Launch date:open',
      'Risks:in-progress',
      'Budget:open',
    ])
    expect(show.json().history).toHaveLength(1)
    const md = await tool('export_agenda_markdown', {})
    const edited = md.json().markdown.replace('- [ ] Budget\n', '- [-] Budget\n')
    const imp = await tool('import_agenda_markdown', { markdown: edited })
    expect(imp.json().items.at(-1)).toMatchObject({ text: 'Budget', status: 'skipped' })
    const share = await tool('agenda_invite_block', { write: true })
    expect(share.json()).toMatchObject({ written: false, reason: expect.stringMatching(/read-only/) })
    expect((await tool('remove_agenda_item', { item: 'Budget' })).isError).toBe(false)
    expect((await tool('list_agendas', {})).json().agendas).toHaveLength(1)
    expect(
      (await tool('edit_agenda_item', { item: '1', owner: 'me', timebox: '15m' })).json().item,
    ).toMatchObject({
      owner: 'me',
      timeboxMin: 15,
    })
  })
})
