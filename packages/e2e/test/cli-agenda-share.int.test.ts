import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { AgendaView } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { gnomeola } from '../src/cli.ts'
import { linkToken, type ShareHost, startShareHost } from '../src/share-host.ts'

// Team sharing from the CLI and MCP (docs/sharing.md), through REAL daemons and a local hosted server
// (the hosted app over PGlite, an in-memory mailer for the codes): the organiser's daemon shares, an
// invitee adds an item and a comment through the link, an attendee's daemon follows with the emailed
// code, statuses merge (one refused under the organiser's override), the recap is shared, and the
// agenda is unshared. Every verb's JSON is compared to a reviewed golden file (ids, links and times
// normalised); the exit codes are the contract's: 6 without a sharing host, 1 for what the daemon refuses
// (a private agenda, someone else's copy), 5 for a wrong code. MCP exposes the reads only.

const MAIN = join(import.meta.dirname, '..', '..', 'cli', 'src', 'main.ts')
const box = mkdtempSync(join(tmpdir(), 'gnomeola-e2e-agenda-share-'))
let host: ShareHost
let A: DaemonHandle // the organiser (a sharing host configured)
let B: DaemonHandle // an attendee who runs kacola
let C: DaemonHandle // no sharing host
const s = { agenda: '', link: '', bAgenda: '' }

const now = Date.now()
const t = (min: number) => new Date(now + min * 60_000).toISOString()
const calendar = (file: string) =>
  writeFileSync(
    file,
    JSON.stringify({
      calendars: [{ id: 'cal-work', name: 'Work' }],
      occurrences: [0, 1].map((week) => ({
        uid: 'team-sync@x',
        summary: 'Team sync',
        sourceUid: 'cal-work',
        calendarName: 'Work',
        recurrenceId: t(30 + week * 7 * 24 * 60),
        start: t(30 + week * 7 * 24 * 60),
        end: t(60 + week * 7 * 24 * 60),
        description: '',
        location: '',
        url: '',
        allDay: false,
        startDate: null,
        endDate: null,
        timezone: 'UTC',
        status: 'CONFIRMED',
        myPartstat: null,
        organizer: 'mailto:kacper@example.com',
        attendees: 3,
        recurring: true,
        xprops: {},
      })),
    }),
  )

beforeAll(async () => {
  host = await startShareHost()
  const daemon = async (name: string, env: Record<string, string>) => {
    const file = join(box, `${name}.json`)
    calendar(file)
    const d = await startDaemon({
      dataDir: join(box, name),
      env: {
        GNOMEOLA_CALENDAR: `file:${file}`,
        // sync on demand (the test calls sync), pushes soon after a change
        GNOMEOLA_SHARE_POLL_MS: '0',
        GNOMEOLA_SHARE_DEBOUNCE_MS: '20',
        ...env,
      },
    })
    await waitFor(async () => (await d.client.call('nextMeeting')).next !== null, 10_000, 'the calendar file')
    return d
  }
  A = await daemon('owner', host.ownerEnv({ name: 'Kacper', email: 'kacper@example.com' }))
  B = await daemon('attendee', { GNOMEOLA_OWNER_EMAIL: 'ben@example.com' })
  C = await daemon('nohost', {})
}, 90_000)
afterAll(async () => {
  await A?.stop()
  await B?.stop()
  await C?.stop()
  await host?.close()
  rmSync(box, { recursive: true, force: true })
})

const golden = (name: string) => join(import.meta.dirname, '__golden__', `${name}.json`)

/** Stable across runs: ids → <kind:n>, instants → <iso>, the share link → <link>. */
function stable(out: string): string {
  const seen = new Map<string, string>()
  const counts = new Map<string, number>()
  const id = (v: string) =>
    v.replace(/\b(agd|itm|ctx|sug|ses|mtg|shr|spt)_[0-9A-Za-z_-]{12,}/g, (m, kind: string) => {
      if (!seen.has(m)) {
        const n = (counts.get(kind) ?? 0) + 1
        counts.set(kind, n)
        seen.set(m, `<${kind}:${n}>`)
      }
      return seen.get(m)!
    })
  const value = JSON.parse(out, (_k, v) => {
    if (typeof v !== 'string') return v
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return '<iso>'
    if (/^http:\/\/127\.0\.0\.1:\d+\/a\/[A-Za-z0-9_-]+$/.test(v)) return '<link>'
    return id(v)
  })
  return `${JSON.stringify(value, null, 2)}\n`
}

const cli = (d: DaemonHandle, argv: string[], tty = false) => gnomeola(argv, d.baseUrl, { tty })
async function ok(d: DaemonHandle, argv: string[]) {
  const r = await cli(d, argv)
  expect(r.stderr, argv.join(' ')).toBe('')
  expect(r.code, argv.join(' ')).toBe(0)
  return r
}
const view = (d: DaemonHandle, id: string): Promise<AgendaView> =>
  d.client.call('getAgenda', { params: { id }, query: { includePrivate: true } })
const itemId = async (d: DaemonHandle, id: string, text: string) =>
  (await view(d, id)).items.find((i) => i.text === text)!.id
const sync = async () => {
  await A.client.call('syncAgendaShare', { params: { id: s.agenda } })
  await B.client.call('syncAgendaShare', { params: { id: s.bAgenda } })
  await A.client.call('syncAgendaShare', { params: { id: s.agenda } })
}

describe('gnomeola agenda share|unshare|share-status|follow|follow-confirm|share-recap|share-history', () => {
  it('share: the web link for invitees; 6 without a sharing host; 1 for a private agenda', async () => {
    const v = await A.client.call('createAgenda', {
      body: {
        eventUid: 'team-sync@x',
        goals: ['a personal goal that stays home'],
        items: [{ text: 'Roadmap', kind: 'must-cover' }, { text: 'Hiring' }, { text: 'Budget' }],
      },
    })
    s.agenda = v.agenda.id
    const r = await ok(A, ['agenda', 'share', s.agenda, '--name', 'Kacper', '--members', 'ben@example.com'])
    const st = JSON.parse(r.stdout)
    expect(st).toMatchObject({ shared: true, role: 'owner', state: 'ok', shareGoals: false })
    s.link = st.link
    expect(s.link).toMatch(new RegExp(`^${host.url}/a/[A-Za-z0-9_-]{32}$`))
    await expect(stable(r.stdout)).toMatchFileSnapshot(golden('agenda-share'))
    // the invitation block now carries the web link (`agenda invite`; `share --write` points there)
    const inv = JSON.parse((await ok(A, ['agenda', 'invite', s.agenda])).stdout)
    expect(inv.block).toContain(`web: ${s.link}`)
    const moved = await cli(A, ['agenda', 'share', s.agenda, '--write'])
    expect(moved.code).toBe(2)
    expect(moved.stderr).toMatch(/agenda invite/)
    // text form, for a person at a terminal
    const text = await cli(A, ['agenda', 'share-status', s.agenda], true)
    expect(text.stdout).toMatch(new RegExp(`^up to date\nlink: ${s.link}\n`))
    // no sharing host on this daemon: 503 → exit 6, with what to set
    const c = await C.client.call('createAgenda', { body: { title: 'Elsewhere', items: [{ text: 'x' }] } })
    const none = await cli(C, ['agenda', 'share', c.agenda.id])
    expect(none.code).toBe(6)
    expect(none.stderr).toMatch(/GNOMEOLA_SHARE_URL/)
    // a private agenda cannot be shared: 409 → exit 1 (it stays invisible to `agenda list` either way)
    const p = await A.client.call('createAgenda', {
      body: { title: 'Private prep', private: true, items: [{ text: 'y' }] },
    })
    const priv = await cli(A, ['agenda', 'share', p.agenda.id])
    expect(priv.code).toBe(1)
    expect(priv.stderr).toMatch(/private/)
  })

  it('share-status: an invitee’s item and comment arrive, attributed; the participants (owner only)', async () => {
    const ivy = await host.invitee(linkToken(s.link), 'ivy@example.com', 'Ivy')
    const item = await ivy.call('shareAddItem', {
      params: { token: linkToken(s.link) },
      body: { text: 'Offsite dates', kind: 'question' },
    })
    await ivy.call('shareAddComment', {
      params: { token: linkToken(s.link) },
      body: { itemId: item.id, text: 'Friday works for me' },
    })
    await A.client.call('syncAgendaShare', { params: { id: s.agenda } })
    expect((await view(A, s.agenda)).items.find((i) => i.text === 'Offsite dates')?.createdBy).toBe(
      'invitee:ivy@example.com',
    )
    const r = await ok(A, ['agenda', 'share-status', s.agenda])
    expect(JSON.parse(r.stdout).comments).toEqual([
      expect.objectContaining({
        item: 'Offsite dates',
        author: 'Ivy',
        role: 'invitee',
        text: 'Friday works for me',
      }),
    ])
    await expect(stable(r.stdout)).toMatchFileSnapshot(golden('agenda-share-status'))
  })

  it('follow + follow-confirm: an attendee’s daemon follows with the emailed code (a wrong one: exit 5)', async () => {
    const f = await ok(B, ['agenda', 'follow', s.link, '--email', 'ben@example.com', '--name', 'Ben'])
    await expect(stable(f.stdout)).toMatchFileSnapshot(golden('agenda-follow'))
    const wrong = await cli(B, [
      'agenda',
      'follow-confirm',
      s.link,
      '--email',
      'ben@example.com',
      '--code',
      'BBBB-CCCC',
    ])
    expect(wrong.code).toBe(5)
    const r = await ok(B, [
      'agenda',
      'follow-confirm',
      s.link,
      '--email',
      'ben@example.com',
      '--code',
      host.codeFor('ben@example.com'),
    ])
    const st = JSON.parse(r.stdout)
    expect(st).toMatchObject({ shared: true, role: 'member', state: 'ok', link: s.link })
    s.bAgenda = st.agendaId
    expect((await view(B, s.bAgenda)).items.map((i) => i.text)).toEqual([
      'Roadmap',
      'Hiring',
      'Budget',
      'Offsite dates',
    ])
    await expect(stable(r.stdout)).toMatchFileSnapshot(golden('agenda-follow-confirm'))
    // a usage error without the link or the address
    expect((await cli(B, ['agenda', 'follow', 'https://example.com/nope', '--email', 'x@y.z'])).code).toBe(2)
    expect((await cli(B, ['agenda', 'follow', s.link])).code).toBe(2)
    // only the organiser shares: the attendee's copy refuses (409 → exit 1)
    const copy = await cli(B, ['agenda', 'share', s.bAgenda])
    expect(copy.code).toBe(1)
    expect(copy.stderr).toMatch(/someone else shared/)
  })

  it('share-history: every device’s status changes with their outcome — one refused under the organiser’s override', async () => {
    const roadmap = await itemId(A, s.agenda, 'Roadmap')
    // Ben covers the roadmap in person (applied); the organiser moves it back by hand (an override that
    // locks it); Ben covers it again — refused: below the organiser's lock
    await ok(B, ['agenda', 'status', s.bAgenda, 'Roadmap', 'covered'])
    await sync()
    await ok(A, ['agenda', 'status', s.agenda, 'Roadmap', 'in-progress'])
    await sync()
    await ok(B, ['agenda', 'status', s.bAgenda, 'Roadmap', 'covered'])
    await sync()
    expect((await view(A, s.agenda)).items.find((i) => i.id === roadmap)?.status).toBe('in-progress')
    const r = await ok(A, ['agenda', 'share-history', s.agenda])
    const h = JSON.parse(r.stdout)
    expect(
      h.changes.map((c: { by: string; to: string; outcome: string }) => [c.by, c.to, c.outcome]),
    ).toEqual([
      ['Ben', 'covered', 'applied'],
      ['Kacper', 'in-progress', 'applied'],
      ['Ben', 'covered', 'refused'],
    ])
    expect(h.changes[2].reason).toMatch(/owner/)
    await expect(stable(r.stdout)).toMatchFileSnapshot(golden('agenda-share-history'))
    // the attendee's daemon sees the same history, and its refused count
    expect(JSON.parse((await ok(B, ['agenda', 'share-history', s.bAgenda])).stdout).total).toBe(3)
    expect(JSON.parse((await ok(B, ['agenda', 'share-status', s.bAgenda])).stdout).refused).toBe(1)
  })

  it('share-recap: outcomes reach the link only once shared; --off takes them back', async () => {
    await A.client.call('updateAgendaItem', {
      params: { id: s.agenda, itemId: await itemId(A, s.agenda, 'Budget') },
      body: { outcome: 'Approved at 40k' },
    })
    await A.client.call('syncAgendaShare', { params: { id: s.agenda } })
    const page = () => host.web().call('getSharedPage', { params: { token: linkToken(s.link) } })
    expect((await page()).items.find((i) => i.text === 'Budget')?.outcome).toBeNull()
    const r = await ok(A, ['agenda', 'share-recap', s.agenda])
    expect(JSON.parse(r.stdout).recapShared).toBe(true)
    await expect(stable(r.stdout)).toMatchFileSnapshot(golden('agenda-share-recap'))
    await A.client.call('syncAgendaShare', { params: { id: s.agenda } })
    expect((await page()).items.find((i) => i.text === 'Budget')?.outcome).toBe('Approved at 40k')
    expect(JSON.parse((await ok(A, ['agenda', 'share-recap', s.agenda, '--off'])).stdout).recapShared).toBe(
      false,
    )
    await A.client.call('syncAgendaShare', { params: { id: s.agenda } })
    expect((await page()).items.find((i) => i.text === 'Budget')?.outcome).toBeNull()
  })

  it('MCP: share status and history are tools (reads); nothing shares from MCP', async () => {
    const child: ChildProcess = spawn(process.execPath, [MAIN, 'mcp'], {
      env: { ...process.env, GNOMEOLA_URL: A.baseUrl },
      stdio: ['pipe', 'pipe', 'inherit'],
    })
    let nextId = 1
    const pending = new Map<number, (v: unknown) => void>()
    createInterface({ input: child.stdout! }).on('line', (line) => {
      const msg = JSON.parse(line) as { id?: number }
      if (msg.id !== undefined) pending.get(msg.id)?.(msg)
    })
    const rpc = (method: string, params: unknown) => {
      const id = nextId++
      child.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
      return new Promise<{
        result: { tools?: { name: string }[]; content?: { text: string }[]; isError?: boolean }
      }>((resolve) => pending.set(id, resolve as (v: unknown) => void))
    }
    try {
      await rpc('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'e2e', version: '0' },
      })
      child.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
      const names = (await rpc('tools/list', {})).result.tools!.map((x) => x.name)
      expect(names).toEqual(expect.arrayContaining(['agenda_share_status', 'agenda_share_history']))
      // reads only: no tool shares, unshares or follows
      expect(names.filter((n) => /share|follow/.test(n)).sort()).toEqual([
        'agenda_share_history',
        'agenda_share_status',
      ])
      const st = await rpc('tools/call', { name: 'agenda_share_status', arguments: { agenda: s.agenda } })
      expect(st.result.isError).toBeFalsy()
      expect(JSON.parse(st.result.content![0]!.text)).toMatchObject({ shared: true, link: s.link })
      const h = await rpc('tools/call', { name: 'agenda_share_history', arguments: { agenda: s.agenda } })
      expect(JSON.parse(h.result.content![0]!.text).total).toBe(3)
    } finally {
      child.kill()
    }
  })

  it('unshare: the link answers 410; the attendee’s copy is revoked but kept', async () => {
    const r = await ok(A, ['agenda', 'unshare', s.agenda])
    expect(JSON.parse(r.stdout)).toMatchObject({ shared: false, state: 'off', link: null })
    await expect(stable(r.stdout)).toMatchFileSnapshot(golden('agenda-unshare'))
    await expect(
      host.web().call('getSharedPage', { params: { token: linkToken(s.link) } }),
    ).rejects.toMatchObject({ status: 410 })
    await B.client.call('syncAgendaShare', { params: { id: s.bAgenda } })
    expect(JSON.parse((await ok(B, ['agenda', 'share-status', s.bAgenda])).stdout)).toMatchObject({
      state: 'revoked',
      shared: false,
    })
    expect((await view(B, s.bAgenda)).items.length).toBe(4)
    // the history went with the share
    expect((await cli(A, ['agenda', 'share-history', s.agenda])).code).toBe(1)
  })
})
