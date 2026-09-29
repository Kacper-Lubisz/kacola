import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  defaultChoices,
  diffNoteBlocks,
  type EnhanceStreamEvent,
  enhanceEvents,
  type GnomeolaClient,
} from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { gnomeola } from '../src/cli.ts'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { SEED, seedMeetings } from '../src/seed.ts'

// N-2 / N-5 — the whole enhancement chain, for real: gnomeolad (child process) → LlmNotesEngine →
// @gnomeola/llm enhance → @anthropic-ai/sdk → HTTP, then the result read back through gnomeola(1). Only
// the far end is a replay of a hand-authored Messages API stream.

const CASSETTES = join(import.meta.dirname, '..', '..', 'llm', 'test', 'fixtures', 'cassettes')
const KEY = 'sk-ant-e2e-notes-planted-key-5555'
const NOTES = '- retry budget?\n- migration thursday\n- Ana dashboard\n'

type Body = {
  output_config: { effort: string }
  system: { text: string }[]
  messages: { content: { text: string; cache_control?: unknown }[] }[]
}

let api: FakeAnthropic
let d: DaemonHandle
let c: GnomeolaClient
let dataDir: string
let id: string

async function enhanceAll(sessionId: string): Promise<EnhanceStreamEvent[]> {
  const out: EnhanceStreamEvent[] = []
  for await (const e of enhanceEvents(c.stream('enhanceNotes', { params: { id: sessionId }, body: {} })))
    out.push(e)
  return out
}

beforeAll(async () => {
  api = await startFakeAnthropic()
  dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-notes-chain-'))
  seedMeetings(dataDir)
  d = await startDaemon({ dataDir, env: { ANTHROPIC_API_KEY: KEY, ANTHROPIC_BASE_URL: api.url } })
  c = d.client
  // the retro: a seeded meeting with no notes yet, whose title picks the general template
  id = SEED.retro
}, 60_000)
afterEach(() => api.reset())
afterAll(async () => {
  await d?.stop()
  await api?.close()
  if (dataDir) rmSync(dataDir, { recursive: true, force: true })
})

describe('notes enhancement chain: daemon → llm → SDK → API → CLI', () => {
  it('enhances with effort high and the user notes last, stores a pending version, leaves the head alone', async () => {
    await c.call('putNotes', { params: { id }, body: { markdown: NOTES, baseVersion: 0 } })
    api.enqueue(...loadCassette(join(CASSETTES, 'enhance-notes.json')))
    const events = await enhanceAll(id)

    // what went over the wire
    expect(api.seen).toHaveLength(1)
    const req = api.seen[0]!
    expect(req.path).toMatch(/^\/v1\/messages/)
    expect(req.headers['x-api-key']).toBe(KEY)
    const body = req.body as Body
    expect(body.output_config.effort).toBe('high')
    expect(body.system[0]!.text.startsWith('You write meeting notes')).toBe(true)
    const content = body.messages[0]!.content
    expect(content.at(-1)!.text).toContain(`<my_notes>\n${NOTES.trimEnd()}\n</my_notes>`)
    expect(content.at(-1)!.text).toContain('<template id="general"')

    // what came back
    expect(events[0]).toEqual({ type: 'started', templateId: 'general', baseVersion: 1 })
    expect(events.filter((e) => e.type === 'delta').length).toBeGreaterThan(3)
    const done = events.at(-1)
    if (done?.type !== 'done') throw new Error(`expected done, got ${JSON.stringify(done)}`)
    const v = done.version
    expect(v).toMatchObject({ kind: 'enhanced', version: 2, baseVersion: 1 })
    expect(v.enhancement).toMatchObject({
      templateId: 'general',
      model: 'claude-opus-5',
      stopReason: 'end_turn',
    })
    for (const line of NOTES.trimEnd().split('\n')) expect(v.markdown).toContain(`${line}\n`)
    expect(v.markdown).not.toMatch(/\[s\d/)

    // citations only point at this session's real segments (the retro has one line; the cassette cites
    // aliases up to s18, which the llm package drops as hallucinated before anything is stored)
    const { segments } = await c.call('getTranscript', { params: { id } })
    const real = new Set(segments.map((s) => s.id))
    expect(v.enhancement!.citations.every((x) => real.has(x.segmentId) && x.sessionId === id)).toBe(true)

    const state = await c.call('getNotes', { params: { id } })
    expect(state.note).toMatchObject({ version: 1, markdown: NOTES, pendingEnhancement: 2 })
  })

  it('merges the default review and serves it through `gnomeola notes`, with owners parsed', async () => {
    const { note, enhanced } = await c.call('getNotes', { params: { id } })
    const choices = defaultChoices(diffNoteBlocks(note.markdown, enhanced!.markdown))
    const merged = await c.call('mergeNotes', {
      params: { id },
      body: { enhancedVersion: enhanced!.version, baseVersion: note.version, choices },
    })
    expect(merged.version).toBe(3)

    const head = await gnomeola(['notes', id], d.baseUrl)
    expect(head.stderr).toBe('')
    expect(head.code).toBe(0)
    const j = JSON.parse(head.stdout)
    expect(j).toMatchObject({ version: 3, markdown: merged.markdown, pendingEnhancement: null })

    const actions = JSON.parse((await gnomeola(['notes', id, '--actions'], d.baseUrl)).stdout)
    expect(actions.actionItems).toEqual([
      { text: 'Add an alert on the dead-letter queue', owner: 'Bruno', due: 'Friday', done: false },
      { text: 'Share the new dashboard link', owner: 'Ana', due: null, done: false },
    ])
    // the user's original words are still there, as version 1
    const v1 = JSON.parse((await gnomeola(['notes', id, '--version', '1'], d.baseUrl)).stdout)
    expect(v1.markdown).toBe(NOTES)
  })

  it('a refusal stores nothing and says the notes are unchanged', async () => {
    const before = (await c.call('listNoteVersions', { params: { id } })).versions.length
    api.enqueue(...loadCassette(join(CASSETTES, 'refusal.json')))
    const events = await enhanceAll(id)
    expect(events.at(-1)).toMatchObject({ type: 'error', error: { code: 'unavailable' } })
    expect((events.at(-1) as { error: { message: string } }).error.message).toMatch(/notes are unchanged/)
    expect((await c.call('listNoteVersions', { params: { id } })).versions).toHaveLength(before)
    expect((await c.call('getNotes', { params: { id } })).note.pendingEnhancement).toBeNull()
  })

  it('rate limiting (429) is an unavailable error; the notes are untouched', async () => {
    const before = await c.call('getNotes', { params: { id } })
    // every attempt is a 429 (the SDK retries twice); a short retry hint keeps the test fast
    const limited = loadCassette(join(CASSETTES, 'rate-limited.json'))[0]!
    api.always({ ...limited, headers: { ...limited.headers, 'retry-after': '0', 'retry-after-ms': '10' } })
    const events = await enhanceAll(id)
    expect(events.at(-1)).toMatchObject({ type: 'error', error: { code: 'unavailable' } })
    expect((events.at(-1) as { error: { message: string } }).error.message).toMatch(/rate-limiting/)
    expect(await c.call('getNotes', { params: { id } })).toEqual(before)
    expect(api.seen.length).toBe(3) // the first attempt and the SDK's two retries
  })
})
