import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { formatOffset, type QaMessage, type Segment } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { type AppHandle, type HeadlessDisplay, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { SEED, seedMeetings } from '../src/seed.ts'
import {
  APP,
  buildUi,
  capture,
  launchUi,
  logTail,
  markOnboarded,
  unnamedInteractive,
  waitForWindow,
} from '../src/ui.ts'

// V-9a / Q-5: the Ask pane in the real window. The whole chain is real — GTK window → protocol client →
// gnomeolad (child process) → @gnomeola/llm → @anthropic-ai/sdk → HTTP — and only the far end is a replay
// of recorded Messages API streams, trickled one SSE event at a time so the streaming state is visible.

const CASSETTES = join(import.meta.dirname, '..', '..', 'llm', 'test', 'fixtures', 'cassettes')
const KEY = 'sk-ant-e2e-ui-planted-key-9876543210'
const PIPELINE = { speed: 4, segmentEveryMs: 2500, partialEveryMs: 250, finalizeAfterMs: 1500, tickMs: 20 }

const speakerName = (s: string) => (s === 'me' ? 'Me' : s === 'them' ? 'Them' : s)
const rowName = (s: Pick<Segment, 'speaker' | 'startMs' | 'text'>) =>
  `${speakerName(s.speaker)} at ${formatOffset(s.startMs)}: ${s.text}`

async function openTab(d: HeadlessDisplay, name: 'Transcript' | 'Ask' | 'Details') {
  const tab = await d.findOne({ app: APP, role: 'page tab', name, states: ['showing'] })
  await d.click(tab)
  await d.waitFor(async () => (await d.describe(tab)).states.includes('selected'), 5000, `the ${name} tab`)
}

/** Type a question into the Ask pane with the real keyboard and submit it with Return. */
async function ask(d: HeadlessDisplay, question: string) {
  const entry = await d.findOne({ app: APP, role: 'text', name: 'Question', states: ['showing'] })
  await d.focus(entry)
  await d.typeText(question)
  await d.pressKeys('Return')
}

async function lastAnswer(daemon: DaemonHandle, sessionId: string): Promise<QaMessage> {
  const { messages } = await daemon.client.call('getQaHistory', {
    params: { id: sessionId },
    query: { includePrivate: true },
  })
  const a = messages.filter((m) => m.role === 'assistant').at(-1)
  if (!a) throw new Error('no answer in the history')
  return a
}

describe('Ask pane against the real daemon and a replayed Anthropic API', () => {
  let d: HeadlessDisplay
  let daemon: DaemonHandle
  let api: FakeAnthropic
  let app: AppHandle
  let dataDir: string

  beforeAll(async () => {
    buildUi()
    api = await startFakeAnthropic({ eventDelayMs: 350 })
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-ui-ask-'))
    seedMeetings(dataDir)
    daemon = await startDaemon({
      dataDir,
      env: {
        ANTHROPIC_API_KEY: KEY,
        ANTHROPIC_BASE_URL: api.url,
        GNOMEOLA_FAKE_PIPELINE: JSON.stringify(PIPELINE),
      },
    })
    d = await startHeadlessDisplay({ size: '1280x800' })
    markOnboarded(d)
    app = launchUi(d, { GNOMEOLA_URL: daemon.baseUrl })
    await waitForWindow(d, app)
  })

  afterEach(() => {
    if (app?.hasExited()) throw new Error(`gnomeola exited:\n${logTail(app)}`)
  })

  afterAll(async () => {
    await d?.close()
    await daemon?.stop()
    await api?.close()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
  })

  it('streams an answer, then shows citation chips that jump to and highlight the cited line', async () => {
    await d.click(await d.findOne({ app: APP, role: 'list item', name: 'Quarterly planning' }))
    await d.findOne({ app: APP, role: 'heading', name: 'Quarterly planning' })
    // park the transcript at its far end, so following a citation must scroll back up
    const list = await d.findOne({ app: APP, role: 'list', name: 'Transcript', states: ['showing'] })
    await d.focusInto(list, { reverse: true })
    await d.pressKeys('End')
    await d.findOne({ app: APP, role: 'list item', nameContains: 'Planning item 1349:', states: ['showing'] })

    await openTab(d, 'Ask')
    await d.findOne({ app: APP, role: 'label', name: 'Ask About This Meeting' })
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    await ask(d, 'What did we decide about the retry budget?')

    // the question appears at once, and the answer streams in under a spinner
    await d.findOne({ app: APP, role: 'label', name: 'What did we decide about the retry budget?' })
    const partial = await d.waitFor(
      async () => {
        const spinning = await d.find({ app: APP, name: 'Answering', states: ['showing'] })
        const text = await d.find({
          app: APP,
          role: 'label',
          nameContains: 'three attempts',
          states: ['showing'],
        })
        return spinning.length && text.length ? text[0]!.name : null
      },
      15_000,
      'streamed text under the Answering spinner',
    )
    expect(partial).not.toMatch(/\[s\d/) // aliases never leak: markers are rewritten as they stream
    await capture(d, 'ask-streaming')

    // the answer: text with [n] markers, and one chip per citation
    const answer = await d.waitFor(() => lastAnswer(daemon, SEED.long), 15_000, 'the persisted answer')
    expect(answer.citations).toHaveLength(2)
    await d.findOne({ app: APP, role: 'label', name: answer.text, states: ['showing'] }, 10_000)
    expect(await d.find({ app: APP, name: 'Answering', states: ['showing'] })).toEqual([])
    const { segments } = await daemon.client.call('getTranscript', { params: { id: SEED.long } })
    const cited = answer.citations.map((c) => segments.find((s) => s.id === c.segmentId)!)
    const chipName = (n: number) =>
      `Citation ${n}: ${speakerName(cited[n - 1]!.speaker)} at ${formatOffset(cited[n - 1]!.startMs)}`
    const chip2 = await d.findOne({ app: APP, role: 'button', name: chipName(2), states: ['showing'] })
    await d.findOne({ app: APP, role: 'button', name: chipName(1), states: ['showing'] })
    expect(await unnamedInteractive(d)).toEqual([])
    await capture(d, 'ask-answer')

    // follow citation 2: the Transcript page shows, scrolled back to that line, which is selected
    await d.click(chip2)
    await d.findOne({ app: APP, role: 'page tab', name: 'Transcript', states: ['selected'] }, 5000)
    const row = await d.findOne(
      { app: APP, role: 'list item', name: rowName(cited[1]!), states: ['showing', 'selected'] },
      5000,
    )
    expect(row.states).toContain('selected')
    // only one line is highlighted
    const rows =
      (
        await d.describe(
          await d.findOne({ app: APP, role: 'list', name: 'Transcript', states: ['showing'] }),
          true,
        )
      ).children ?? []
    expect(rows.filter((r) => r.states.includes('selected')).map((r) => r.name)).toEqual([rowName(cited[1]!)])
    await capture(d, 'ask-citation-followed')

    // and back: citation 1 moves the highlight
    await openTab(d, 'Ask')
    await d.click(await d.findOne({ app: APP, role: 'button', name: chipName(1), states: ['showing'] }))
    await d.findOne(
      { app: APP, role: 'list item', name: rowName(cited[0]!), states: ['showing', 'selected'] },
      5000,
    )
  })

  it('shows a refusal as a notice, replacing the partial text that streamed before it', async () => {
    await openTab(d, 'Ask')
    api.enqueue(...loadCassette(join(CASSETTES, 'refusal.json')))
    await ask(d, 'Tell me something you will refuse')
    // the partial arrives first…
    await d.waitFor(
      async () =>
        (await d.find({ app: APP, role: 'label', states: ['showing'] })).some(
          (l) => l.name.trim() === 'The retry budget',
        ),
      15_000,
      'the partial text before the refusal',
    )
    // …then the notice replaces it
    await d.findOne(
      {
        app: APP,
        role: 'label',
        nameContains: 'The model declined to answer this question',
        states: ['showing'],
      },
      15_000,
    )
    await d.waitFor(
      async () =>
        !(await d.find({ app: APP, role: 'label', states: ['showing'] })).some(
          (l) => l.name.trim() === 'The retry budget',
        ),
      5000,
      'the partial text to be gone',
    )
    expect((await lastAnswer(daemon, SEED.long)).stopReason).toBe('refusal')
    await capture(d, 'ask-refusal')
  })

  it('answers during a live recording, with citations into the growing transcript', async () => {
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Record', states: ['showing'] }))
    const session = await d.waitFor(
      async () =>
        (await daemon.client.call('listSessions', { query: {} })).sessions.find(
          (s) => s.status === 'recording',
        ),
      10_000,
      'a recording session',
    )
    await d.findOne({ app: APP, role: 'heading', name: session.title })
    // the cassette cites the 3rd and 5th lines: wait until there are enough
    await d.waitFor(
      async () =>
        (await daemon.client.call('getTranscript', { params: { id: session.id } })).segments.length >= 6,
      20_000,
      'six segments',
    )
    await openTab(d, 'Ask')
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    await ask(d, 'What have we said so far?')
    const answer = await d.waitFor(
      () => lastAnswer(daemon, session.id).catch(() => null),
      20_000,
      'an answer',
    )
    expect(answer.citations.length).toBeGreaterThan(0)
    const status = (await daemon.client.call('getSession', { params: { id: session.id } })).status
    expect(status).toBe('recording') // it really was asked mid-recording
    const { segments } = await daemon.client.call('getTranscript', { params: { id: session.id } })
    const cited = segments.find((s) => s.id === answer.citations[0]!.segmentId)!
    const chip = await d.findOne(
      { app: APP, role: 'button', nameContains: 'Citation 1:', states: ['showing'] },
      10_000,
    )
    await capture(d, 'ask-live')
    await d.click(chip)
    // the cited line is found by its start time and speaker (its text may have been revised to final)
    const prefix = `${speakerName(cited.speaker)} at ${formatOffset(cited.startMs)}: `
    await d.waitFor(
      async () =>
        (await d.find({ app: APP, role: 'list item', nameContains: prefix, states: ['showing', 'selected'] }))
          .length === 1,
      5000,
      'the cited live line highlighted',
    )
    // it went through the real API with the key from the environment
    expect(api.seen.at(-1)!.headers['x-api-key']).toBe(KEY)
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Stop', states: ['showing'] }))
    await d.findOne({ app: APP, role: 'button', name: 'Record', states: ['showing'] })
  })
})
