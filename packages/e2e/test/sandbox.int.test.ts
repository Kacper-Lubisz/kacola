import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createClient, type GnomeolaClient } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SandboxState } from '../src/sandbox/cli.ts'

// `pnpm sandbox` end to end, as the user runs it (scripts/sandbox.ts in a child process): start brings
// up an isolated daemon with the mock calendar and a local sharing server; meeting add edits the
// calendar live; play records a scenario whose script the tracker checks items off from (on-device
// decisions, no key); Send the agenda gives a working web link; stop leaves nothing running — and a
// "real" daemon on another data dir, running the whole time, is untouched.

const REPO = resolve(import.meta.dirname, '..', '..', '..')
const freePort = () =>
  new Promise<number>((res) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port
      s.close(() => res(p))
    })
  })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function until<T>(what: string, probe: () => Promise<T | undefined | null | false>, ms = 30_000) {
  const end = Date.now() + ms
  for (;;) {
    const v = await probe().catch(() => undefined)
    if (v) return v
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await sleep(200)
  }
}
const alive = (pid: number | undefined) => {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

let root = ''
let dir = ''
let port = 0
let sharePort = 0
let real: DaemonHandle
let realBefore: unknown
let api: GnomeolaClient

function sandbox(...args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((res) => {
    const c = spawn(process.execPath, [join(REPO, 'scripts', 'sandbox.ts'), '--dir', dir, ...args], {
      cwd: REPO,
      env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', TYPESAFE_API_KEY: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    c.stdout.on('data', (d: Buffer) => {
      out += d.toString()
    })
    c.stderr.on('data', (d: Buffer) => {
      out += d.toString()
    })
    c.on('exit', (code) => res({ code: code ?? 1, out }))
  })
}
const state = (): SandboxState => JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')) as SandboxState

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'kacola-sandbox-int-'))
  dir = join(root, 'kacola-sandbox')
  port = await freePort()
  sharePort = await freePort()
  // stands in for the user's everyday daemon: its own data dir, a recording already made
  real = await startDaemon({ dataDir: join(root, 'real-data') })
  const s = await real.client.call('createSession', { body: { title: 'My real meeting' } })
  await real.client.call('startSession', { params: { id: s.id } })
  await sleep(1500)
  await real.client.call('stopSession', { params: { id: s.id } })
  realBefore = await realSnapshot()
}, 60_000)

afterAll(async () => {
  if (dir && existsSync(join(dir, 'state.json'))) await sandbox('stop')
  await real?.stop()
  if (root) rmSync(root, { recursive: true, force: true })
}, 60_000)

async function realSnapshot() {
  const { sessions } = await real.client.call('listSessions', { query: { includePrivate: true } })
  return Promise.all(
    sessions.map(async (s) => ({
      ...s,
      segments: (await real.client.call('getTranscript', { params: { id: s.id }, query: {} })).segments
        .length,
    })),
  )
}

describe('pnpm sandbox', () => {
  it('start: an isolated daemon with the mock day, the sharing server, providers named', async () => {
    const r = await sandbox('start', '--no-window', '--port', String(port), '--share-port', String(sharePort))
    expect(r.code, r.out).toBe(0)
    expect(r.out).toContain(`export GNOMEOLA_URL=http://127.0.0.1:${port}`)
    expect(r.out).toMatch(/Live check-offs:\s+on-device/)
    expect(r.out).toMatch(/Ask \/ Enhance \/ recaps: canned answers/)
    api = createClient({ baseUrl: `http://127.0.0.1:${port}` })
    // its own data dir, beside the "real" daemon's (each holds its own lock)
    const info = await api.call('daemonInfo')
    expect(info.dataDir).toBe(join(dir, 'data'))
    expect((await real.client.call('daemonInfo')).dataDir).toBe(join(root, 'real-data'))
    const now = Date.now()
    const { meetings } = await until('the mock meetings', async () => {
      const m = await api.call('listMeetings', {
        query: {
          from: new Date(now - 30 * 3_600_000).toISOString(),
          to: new Date(now + 3_600_000).toISOString(),
        },
      })
      return m.meetings.length >= 4 && m
    })
    const titles = meetings.map((m) => m.title)
    expect(titles).toEqual(
      expect.arrayContaining(['1:1 with Ana', 'Intro call with Sam', 'Prototype feedback with the PM']),
    )
    const ana = meetings.find((m) => m.title === '1:1 with Ana' && Date.parse(m.start) > now)!
    expect(Math.round((Date.parse(ana.start) - now) / 60_000)).toBe(2)
    expect(ana.join?.url).toMatch(/^https:\/\/meet\.google\.com\//)
    expect(meetings.find((m) => m.title === 'Intro call with Sam')!.join?.provider).toBe('zoom')
    // past meetings for home and search (the private one hidden from agent surfaces)
    const past = (await api.call('listSessions', { query: {} })).sessions.map((s) => s.title)
    expect(past).toEqual(expect.arrayContaining(['1:1 with Ana', 'Design review: checkout flow']))
    expect(past).not.toContain('Hiring sync')
    const hits = await api.call('search', { query: { q: 'retry banner' } })
    expect(hits.hits[0]?.sessionTitle).toBe('Design review: checkout flow')
    // the sharing server answers
    expect((await fetch(`http://127.0.0.1:${sharePort}/health`)).status).toBeLessThan(500)
    // the providers were applied
    expect((await api.call('getSettings')).decisions?.provider).toBe('local')
  }, 120_000)

  it('meeting add: a new meeting shows up through the API', async () => {
    const r = await sandbox(
      'meeting',
      'add',
      'Coffee with Ben',
      '--in',
      '50m',
      '--for',
      '15m',
      '--with',
      'Ben Okafor',
    )
    expect(r.code, r.out).toBe(0)
    await until('the added meeting', async () => {
      const m = await api.call('listMeetings', {
        query: { from: new Date().toISOString(), to: new Date(Date.now() + 2 * 3_600_000).toISOString() },
      })
      return m.meetings.find((x) => x.title === 'Coffee with Ben')
    })
    const list = await sandbox('meeting', 'list')
    expect(list.out).toMatch(/in (49|50) min\s+Coffee with Ben — Ben Okafor\s+\(added by you\)/)
  }, 60_000)

  it('play: the scripted 1:1 is recorded live and the tracker ticks items off on-device', async () => {
    const r = await sandbox('play', 'one-on-one', '--speed', '4', '--detach')
    expect(r.code, r.out).toBe(0)
    expect(r.out).toContain('Loaded the suggested agenda into "1:1 with Ana" (5 items)')
    const live = (await api.call('listSessions', { query: {} })).sessions.find(
      (s) => s.status === 'recording',
    )!
    expect(live.meeting?.title).toBe('1:1 with Ana')
    const agendaId = (await api.call('listAgendas', { query: { eventUid: 'sandbox-ana-1on1@kacola.test' } }))
      .agendas[0]!.id
    const ticked = await until(
      'a check-off by the tracker',
      async () => {
        const v = await api.call('getAgenda', { params: { id: agendaId }, query: { includePrivate: true } })
        const auto = v.items.filter(
          (i) => i.status === 'covered' && i.changedBy !== 'me' && i.evidence.length > 0,
        )
        return auto.length > 0 && auto
      },
      60_000,
    )
    expect(ticked.length).toBeGreaterThan(0)
    const segs = (await api.call('getTranscript', { params: { id: live.id }, query: {} })).segments
    expect(segs.length).toBeGreaterThan(5)
    expect(segs.some((s) => s.speaker === 'Ana')).toBe(true)
    expect(segs.some((s) => s.speaker === 'me')).toBe(true)
    // the item that is never mentioned is never ticked
    await until(
      'the script to end',
      async () => {
        const t = await api.call('getTranscript', { params: { id: live.id }, query: {} })
        return t.segments.some((s) => s.text.includes('everything for today'))
      },
      60_000,
    )
    const v = await api.call('getAgenda', { params: { id: agendaId }, query: { includePrivate: true } })
    expect(v.items.find((i) => i.text === 'December vacation dates')?.status).toBe('open')
    await api.call('stopSession', { params: { id: live.id } })
  }, 120_000)

  it('Send the agenda: a local web link that opens, and the sign-in code lands in `sandbox mail`', async () => {
    const add = await sandbox('agenda', 'intro-call')
    expect(add.code, add.out).toBe(0)
    const id = /agenda (agd_\w+)/.exec(add.out)![1]!
    const sent = await sandbox('cli', '--', 'agenda', 'send', id, '--no-write')
    expect(sent.code, sent.out).toBe(0)
    const link = (JSON.parse(sent.out) as { webLink: string }).webLink
    expect(link).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${sharePort}/a/[A-Za-z0-9_-]{32}$`))
    const page = await fetch(link)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('<script type="module" src="/agenda.js">')
    expect((await fetch(`http://127.0.0.1:${sharePort}/agenda.js`)).status).toBe(200)
    // "Ana" asks to contribute: the code is "mailed" to the sandbox's mail log
    const token = link.split('/a/')[1]!
    const web = createClient({ baseUrl: `http://127.0.0.1:${sharePort}` })
    await web.call('shareVerify', { params: { token }, body: { email: 'ana@sandbox.test', name: 'Ana' } })
    const mail = await sandbox('mail')
    expect(mail.out).toMatch(/to ana@sandbox\.test: code [A-Z]{4}-[A-Z]{4}/)
  }, 60_000)

  it('stop: nothing keeps running; the real daemon on another data dir is untouched; reset deletes only the sandbox', async () => {
    const st = state()
    const r = await sandbox('stop')
    expect(r.code, r.out).toBe(0)
    expect(r.out).toContain('Stopped the sandbox')
    await until('every sandbox process to exit', async () =>
      [st.pids.daemon, st.pids.host, st.pids.window].every((p) => !alive(p)),
    )
    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow()
    await expect(fetch(`http://127.0.0.1:${sharePort}/health`)).rejects.toThrow()
    expect(existsSync(join(dir, 'state.json'))).toBe(false)
    // the everyday daemon: still answering, its meetings exactly as before
    expect((await real.client.call('health')).ok).toBe(true)
    expect(await realSnapshot()).toEqual(realBefore)
    // reset needs a confirmation, and removes the sandbox directory only
    const refused = await sandbox('reset')
    expect(refused.code).toBe(1)
    expect(refused.out).toContain('pass --yes')
    expect(existsSync(dir)).toBe(true)
    const reset = await sandbox('reset', '--yes')
    expect(reset.code, reset.out).toBe(0)
    expect(existsSync(dir)).toBe(false)
    expect(existsSync(join(root, 'real-data', 'gnomeola.db'))).toBe(true)
  }, 60_000)
})
