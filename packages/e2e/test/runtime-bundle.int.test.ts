import { mkdtempSync, readFileSync, readlinkSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Segment } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  type CannedResponse,
  type FakeAnthropic,
  loadCassette,
  startFakeAnthropic,
} from '../src/fake-anthropic.ts'
import { AS_NODE, bundledCli, electronBinary, REPO, testRuntime } from '../src/runtime.ts'

// P-1: the release runtime, end to end. The esbuild bundles of the daemon and the CLI run on Electron
// 44's Node (ELECTRON_RUN_AS_NODE=1) — the one runtime the desktop app, the Flatpak and the macOS .app
// ship — against a temp data dir: better-sqlite3 (N-API) loads, the store works, and the bundled CLI
// lists, searches and asks through both LLM providers (fake Anthropic / OpenAI servers).

const CASSETTES = join(REPO, 'packages', 'llm', 'test', 'fixtures', 'cassettes')
const FAKE_PIPELINE = JSON.stringify({ speed: 20, segmentEveryMs: 4000, finalizeAfterMs: 30, tickMs: 20 })

let runtime = ''
let api: FakeAnthropic

async function recordOne(d: DaemonHandle, title: string): Promise<{ id: string; segments: Segment[] }> {
  const s = await d.client.call('createSession', { body: { title } })
  await d.client.call('startSession', { params: { id: s.id } })
  await waitFor(
    async () => (await d.client.call('getTranscript', { params: { id: s.id } })).segments.length >= 8,
    15_000,
    'segments from the fake pipeline',
  )
  await d.client.call('stopSession', { params: { id: s.id } })
  return { id: s.id, segments: (await d.client.call('getTranscript', { params: { id: s.id } })).segments }
}

const bundledDaemon = (env: Record<string, string>) =>
  startDaemon({
    execPath: electronBinary(),
    entry: join(runtime, 'daemon.mjs'),
    env: { ...AS_NODE, GNOMEOLA_FAKE_PIPELINE: FAKE_PIPELINE, ...env },
  })

beforeAll(async () => {
  runtime = (await testRuntime()).outDir
  api = await startFakeAnthropic()
}, 60_000)
afterEach(() => api.reset())
afterAll(async () => {
  await api?.close()
})

describe('bundled daemon + CLI on Electron-as-Node', () => {
  let d: DaemonHandle
  let session: { id: string; segments: Segment[] }
  beforeAll(async () => {
    d = await bundledDaemon({ ANTHROPIC_API_KEY: 'sk-ant-bundle-0123456789', ANTHROPIC_BASE_URL: api.url })
    session = await recordOne(d, 'Bundle standup')
  }, 60_000)
  afterAll(async () => {
    await d?.stop()
  })

  it('really runs on Electron 44 (Node 24), not the test runner’s Node', () => {
    expect(readlinkSync(`/proc/${d.pid}/exe`)).toBe(realpathSync(electronBinary()))
    const info = JSON.parse(readFileSync(join(runtime, 'runtime.json'), 'utf8'))
    expect(info.electron).toMatch(/^44\./)
    expect(Object.keys(info.files).sort()).toEqual(['cli.mjs', 'daemon.mjs', 'diarize-worker.mjs'])
  })

  it('status, sessions list and search through the bundled CLI', async () => {
    const env = { GNOMEOLA_URL: d.baseUrl }
    const st = await bundledCli(runtime, ['status'], env)
    expect(st.code, st.stderr).toBe(0)
    expect(JSON.parse(st.stdout)).toMatchObject({ ok: true, url: d.baseUrl })

    const ls = await bundledCli(runtime, ['sessions', 'list'], env)
    expect(ls.code, ls.stderr).toBe(0)
    expect(JSON.parse(ls.stdout).sessions.map((s: { id: string }) => s.id)).toContain(session.id)

    const word = session.segments[0]!.text.split(/\s+/)
      .find((w) => w.length > 4)!
      .replace(/\W/g, '')
    const se = await bundledCli(runtime, ['search', word], env)
    expect(se.code, se.stderr).toBe(0)
    expect(JSON.parse(se.stdout).hits.some((h: { sessionId: string }) => h.sessionId === session.id)).toBe(
      true,
    )

    const tr = await bundledCli(runtime, ['transcript', session.id, '--from', '0:00', '--to', '0:30'], env)
    expect(tr.code, tr.stderr).toBe(0)
    expect(JSON.parse(tr.stdout).segments.length).toBeGreaterThan(0)
  })

  it('ask (Anthropic) through the bundled CLI, citations resolve to real segments', async () => {
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    const r = await bundledCli(runtime, ['ask', 'what is the retry budget?', '--session', session.id], {
      GNOMEOLA_URL: d.baseUrl,
    })
    expect(r.code, r.stderr).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(out.answer).toMatch(/three attempts/)
    const ids = new Set(session.segments.map((s) => s.id))
    for (const c of out.citations) expect(ids.has(c.segmentId)).toBe(true)
    expect(api.seen[0]!.path).toMatch(/^\/v1\/messages/)
  })

  it('token budgets (tiktoken WASM) and the inlined skill work from the bundle', async () => {
    const n = await bundledCli(runtime, ['transcript', session.id, '--full', '--max-tokens', '50'], {
      GNOMEOLA_URL: d.baseUrl,
    })
    expect(n.code, n.stderr).toBe(0)
    const dir = mkdtempSync(join(tmpdir(), 'gnomeola-skill-'))
    const sk = await bundledCli(runtime, ['skill', 'install', '--dir', dir])
    expect(sk.code, sk.stderr).toBe(0)
    expect(readFileSync(join(dir, 'meeting-context', 'SKILL.md'), 'utf8')).toBe(
      readFileSync(join(REPO, 'skills', 'meeting-context', 'SKILL.md'), 'utf8'),
    )
  })
})

describe('bundled daemon with the OpenAI provider', () => {
  let d: DaemonHandle
  let session: { id: string; segments: Segment[] }
  beforeAll(async () => {
    d = await bundledDaemon({ OPENAI_API_KEY: 'sk-proj-bundle-0123456789', OPENAI_BASE_URL: `${api.url}/v1` })
    session = await recordOne(d, 'Bundle planning')
  }, 60_000)
  afterAll(async () => {
    await d?.stop()
  })

  it('ask (OpenAI Responses API) through the bundled CLI', async () => {
    const frame = (o: { type: string } & Record<string, unknown>) =>
      `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`
    const resp = { id: 'resp_b', object: 'response', model: 'gpt-5.5-2026-04-23' }
    const canned: CannedResponse = {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body:
        frame({ type: 'response.created', response: { ...resp, status: 'in_progress' } }) +
        frame({ type: 'response.output_text.delta', delta: 'Three attempts, then dead-letter [s3].' }) +
        frame({
          type: 'response.completed',
          response: { ...resp, status: 'completed', usage: { input_tokens: 900, output_tokens: 12 } },
        }),
    }
    api.enqueue(canned)
    const r = await bundledCli(runtime, ['ask', 'retries?', '--session', session.id], {
      GNOMEOLA_URL: d.baseUrl,
    })
    expect(r.code, r.stderr).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(out.answer).toMatch(/Three attempts, then dead-letter \[1\]/)
    expect(out.model).toBe('gpt-5.5-2026-04-23')
    expect(`${api.seen[0]!.method} ${api.seen[0]!.path}`).toBe('POST /v1/responses')
    expect(session.segments.map((s) => s.id)).toContain(out.citations[0].segmentId)
  })
})
