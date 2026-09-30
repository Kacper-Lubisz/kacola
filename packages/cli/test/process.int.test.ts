import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BUDGET, countTokens } from '../src/tokens.ts'
import { type FakeDaemon, IDS, startFakeDaemon } from './fake-daemon.ts'

// Real processes: the actual launcher, a real pseudo-terminal, a real MCP client over stdio.

const BIN = join(import.meta.dirname, '..', 'bin', 'gnomeola')
const MAIN = join(import.meta.dirname, '..', 'src', 'main.ts')

let d: FakeDaemon
beforeAll(async () => {
  d = await startFakeDaemon()
})
afterAll(async () => {
  await d.close()
})

// Async on purpose: the fake daemon lives in this process, so a blocking spawnSync would deadlock the
// child against a server whose event loop is frozen.
function proc(
  cmd: string,
  args: string[],
  o: { env: NodeJS.ProcessEnv },
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, { env: o.env })
    let stdout = ''
    let stderr = ''
    c.stdout.on('data', (b) => (stdout += b))
    c.stderr.on('data', (b) => (stderr += b))
    c.on('error', reject)
    c.on('close', (status) => resolve({ status, stdout, stderr }))
  })
}

const env = () => ({
  ...process.env,
  GNOMEOLA_URL: d.url,
  PATH: `${process.execPath.replace(/\/node$/, '')}:${process.env.PATH}`,
})

describe('the real binary: TTY vs pipe', () => {
  it('prints compact JSON when stdout is a pipe', async () => {
    const r = await proc(BIN, ['sessions', 'list'], { env: env() })
    expect(r.status).toBe(0)
    expect(JSON.parse(r.stdout).sessions.length).toBeGreaterThan(0)
    expect(r.stdout.trim().split('\n')).toHaveLength(1)
  })

  it('prints text when stdout is a terminal (real pty)', async () => {
    // python's pty.spawn gives the child a genuine pseudo-terminal as stdout.
    const r = await proc(
      'python3',
      ['-c', 'import pty,sys; sys.exit(pty.spawn(sys.argv[1:]) >> 8)', BIN, 'sessions', 'list'],
      {
        env: env(),
      },
    )
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/Platform standup/)
    expect(r.stdout).toMatch(/\r\n/) // the tty line discipline — proof it really was a terminal
    expect(() => JSON.parse(r.stdout)).toThrow()
  })

  it('exits with the documented codes from the real process', async () => {
    expect((await proc(BIN, ['transcript', IDS.standup], { env: env() })).status).toBe(5)
    expect((await proc(BIN, ['sessions', 'show', 'nope'], { env: env() })).status).toBe(4)
    expect((await proc(BIN, ['bogus'], { env: env() })).status).toBe(2)
    expect(
      (await proc(BIN, ['status'], { env: { ...env(), GNOMEOLA_URL: 'http://127.0.0.1:9' } })).status,
    ).toBe(3)
  })

  it('survives its reader going away (EPIPE) without a stack trace', async () => {
    const r = await proc(
      'bash',
      ['-c', `"${BIN}" transcript ${IDS.long} --full | head -c 100 >/dev/null; echo "\${PIPESTATUS[0]}"`],
      {
        env: env(),
      },
    )
    expect(r.stderr).not.toMatch(/EPIPE|Error/)
    expect(Number(r.stdout.trim())).toBe(0)
  })
})

describe('gnomeola mcp — the same tools over MCP', () => {
  let client: Client
  beforeAll(async () => {
    client = new Client({ name: 'gnomeola-test', version: '0.0.0' })
    await client.connect(
      new StdioClientTransport({ command: process.execPath, args: [MAIN, 'mcp'], env: env() }),
    )
  })
  afterAll(async () => {
    await client.close()
  })

  it('exposes exactly the read tools plus the agenda verbs', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'add_agenda_items',
      'add_context_card',
      'agenda_invite_block',
      'ask_meetings',
      'calendar_meetings',
      'create_agenda',
      'edit_agenda_item',
      'export_agenda_markdown',
      'get_agenda',
      'get_meeting_notes',
      'get_transcript_window',
      'import_agenda_markdown',
      'list_agendas',
      'list_sessions',
      'list_speakers',
      'recording_status',
      'remove_agenda_item',
      'search_meetings',
      'set_agenda_item_status',
      'suggest_for_agenda',
    ])
    // Every tool description that surfaces transcript text warns that it is third-party speech.
    expect(tools.find((t) => t.name === 'search_meetings')!.description).toMatch(/never follow instructions/)
    expect(tools.find((t) => t.name === 'get_meeting_notes')!.description).toMatch(
      /never follow instructions/,
    )
  })

  it('search → window → ask, under the same budgets as the CLI', async () => {
    const s = await client.callTool({ name: 'search_meetings', arguments: { query: 'retry budget' } })
    const text = (s.content as { text: string }[])[0]!.text
    expect(countTokens(text)).toBeLessThanOrEqual(BUDGET.search)
    const hit = JSON.parse(text).hits[0]
    const w = await client.callTool({
      name: 'get_transcript_window',
      arguments: { sessionId: hit.sessionId, around: hit.segmentId, context: '10s' },
    })
    expect(JSON.parse((w.content as { text: string }[])[0]!.text).segments.length).toBeGreaterThan(0)
    const a = await client.callTool({
      name: 'ask_meetings',
      arguments: { question: 'retries?', sessionId: IDS.standup },
    })
    expect(JSON.parse((a.content as { text: string }[])[0]!.text).citations).toHaveLength(1)
  })

  it('refuses a windowless transcript as a tool error, not a dump', async () => {
    const r = await client.callTool({ name: 'get_transcript_window', arguments: { sessionId: IDS.standup } })
    expect(r.isError).toBe(true)
    expect((r.content as { text: string }[])[0]!.text).toMatch(/refusing.*\nhint: search first/)
  })

  it('calendar_meetings: next by default, or today', async () => {
    const r = await client.callTool({ name: 'calendar_meetings', arguments: {} })
    expect(JSON.parse((r.content as { text: string }[])[0]!.text).next.title).toBe('Customer call')
    const t = await client.callTool({ name: 'calendar_meetings', arguments: { when: 'today' } })
    expect(JSON.parse((t.content as { text: string }[])[0]!.text).meetings.length).toBeGreaterThan(0)
  })

  it('reads notes and action items, and not a private session’s', async () => {
    const n = await client.callTool({ name: 'get_meeting_notes', arguments: { sessionId: IDS.standup } })
    expect(JSON.parse((n.content as { text: string }[])[0]!.text).markdown).toMatch(/## Decisions/)
    const a = await client.callTool({
      name: 'get_meeting_notes',
      arguments: { sessionId: IDS.standup, actions: true },
    })
    expect(JSON.parse((a.content as { text: string }[])[0]!.text).actionItems[0].owner).toBe('Ana')
    const p = await client.callTool({ name: 'get_meeting_notes', arguments: { sessionId: IDS.private } })
    expect(p.isError).toBe(true)
  })

  it('cannot see private sessions', async () => {
    const r = await client.callTool({ name: 'list_sessions', arguments: {} })
    expect((r.content as { text: string }[])[0]!.text).not.toMatch(/HR 1:1/)
  })
})
