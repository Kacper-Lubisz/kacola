import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { formatOffset, type QaMessage } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { gnomeola } from '../src/cli.ts'
import {
  expectScreenshot,
  poll,
  rowName,
  selectedRowNames,
  setScheme,
  speakerName,
  transcriptList,
  visibleRowNames,
} from '../src/desktop-ui.ts'
import {
  type CannedResponse,
  type FakeAnthropic,
  loadCassette,
  startFakeAnthropic,
} from '../src/fake-anthropic.ts'
import { SEED, seedMeetings } from '../src/seed.ts'
import { markOnboarded } from '../src/ui.ts'

// Port of ui-ask.e2e.test.ts (V-9a / Q-5) to the Electron window. The whole chain is real — Electron
// renderer → fetch tunnel → gnomeolad (child process) → @gnomeola/llm → provider SDK → HTTP — and only
// the far end is a replay of recorded streams, trickled one SSE event at a time so the streaming state
// is visible. Plus what the GTK pane did not have: cross-meeting asking (from home), the no-credits notice.

const CASSETTES = join(import.meta.dirname, '..', '..', 'llm', 'test', 'fixtures', 'cassettes')
const KEY = 'sk-ant-e2e-desktop-planted-key-9876543210'
const OPENAI_KEY = 'sk-proj-e2e-desktop-planted-openai-key-0123'
const PIPELINE = { speed: 4, segmentEveryMs: 2500, partialEveryMs: 250, finalizeAfterMs: 1500, tickMs: 20 }

const frame = (o: { type: string } & Record<string, unknown>) =>
  `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`
const noCredits = (): CannedResponse => ({
  status: 200,
  headers: { 'content-type': 'text/event-stream' },
  body:
    frame({
      type: 'response.created',
      response: { id: 'resp_e2e', object: 'response', status: 'in_progress' },
    }) +
    frame({
      type: 'error',
      error: {
        type: 'insufficient_quota',
        code: 'credit_balance_exhausted',
        message: 'You have no credits remaining.',
      },
    }) +
    frame({
      type: 'response.failed',
      response: {
        id: 'resp_e2e',
        object: 'response',
        status: 'failed',
        error: { code: 'credit_balance_exhausted', message: 'You have no credits remaining.' },
      },
    }),
})

describe('desktop Ask pane against the real daemon and a replayed provider API', () => {
  let display: HeadlessDisplay
  let daemon: DaemonHandle
  let api: FakeAnthropic
  let app: DesktopApp
  let dataDir: string
  let markerId = ''

  const w = () => app.window
  // Ask is a bar over the meeting page (Ctrl+K): the latest exchange above its box
  const pane = () => w().getByRole('region', { name: 'Ask about this meeting' })
  const sessionId = async (title: string) =>
    poll(
      async () =>
        (await daemon.client.call('listSessions', { query: { includePrivate: true } })).sessions.find(
          (s) => s.title === title,
        )?.id,
      10_000,
      `the session ${title}`,
    )
  const openSession = async (title: string, search = '') => {
    const id = await sessionId(title)
    await w().evaluate(`location.hash = ${JSON.stringify(`#/sessions/${id}${search}`)}`)
    await w().getByRole('heading', { level: 1, name: title }).waitFor({ timeout: 10_000 })
  }
  const openAsk = async () => {
    if (!(await pane().count())) await w().keyboard.press('Control+k')
    await pane().waitFor({ timeout: 5000 })
  }
  const transcriptOpen = async () => (await transcriptList(w()).count()) > 0
  /** Type a question with the real keyboard and submit it with Enter. */
  const ask = async (question: string) => {
    const field = pane().getByRole('textbox', { name: 'Ask about this meeting' })
    await field.click()
    await w().keyboard.type(question)
    await w().keyboard.press('Enter')
  }
  const lastAnswer = async (sessionId: string): Promise<QaMessage> => {
    const { messages } = await daemon.client.call('getQaHistory', {
      params: { id: sessionId },
      query: { includePrivate: true },
    })
    const a = messages.filter((m) => m.role === 'assistant').at(-1)
    if (!a) throw new Error('no answer in the history')
    return a
  }
  const answering = () => pane().getByRole('progressbar', { name: 'Answering' })

  beforeAll(async () => {
    buildDesktop()
    api = await startFakeAnthropic({ eventDelayMs: 350 })
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-ask-'))
    seedMeetings(dataDir)
    daemon = await startDaemon({
      dataDir,
      env: {
        ANTHROPIC_API_KEY: KEY,
        ANTHROPIC_BASE_URL: api.url,
        OPENAI_API_KEY: OPENAI_KEY,
        OPENAI_BASE_URL: `${api.url}/v1`,
        GNOMEOLA_FAKE_PIPELINE: JSON.stringify(PIPELINE),
      },
    })
    await daemon.client.call('updateSettings', { body: { llm: { provider: 'anthropic' } } })
    display = await startHeadlessDisplay({ size: '1280x800' })
    markerId = display.env.GNOMEOLA_HEADLESS_ID!
    markOnboarded(
      display,
      (await daemon.client.call('listModels')).models.map((m) => m.id),
    )
    app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: daemon.baseUrl, GNOMEOLA_COLOR_SCHEME: 'light' },
    })
    await w().getByRole('searchbox', { name: 'Search or ask' }).waitFor({ timeout: 20_000 })
  }, 240_000)

  afterEach(() => {
    expect(app.problems()).toEqual([])
  })

  afterAll(async () => {
    await app?.close()
    await display?.close()
    await daemon?.stop()
    await api?.close()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('streams an answer, then shows citation chips that jump to and highlight the cited line', async () => {
    await openSession('Quarterly planning', '?panel=transcript')
    // park the transcript at its far end, so following a citation must scroll back up
    await transcriptList(w()).focus()
    await w().keyboard.press('End')
    await poll(
      async () => (await visibleRowNames(w())).some((n) => n.includes('Planning item 1349:')),
      5000,
      'the transcript at its end',
    )

    await openAsk()
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    // the provider stream stops after its 8th event — "…three attempts, then dead-letter [s" — until
    // released: a fixed mid-stream state (a marker cut in half) for the assertions and the baseline
    const release = api.holdAfter(8)
    try {
      await ask('What did we decide about the retry budget?')

      // the question appears at once, and the answer streams in under a spinner
      await pane()
        .getByText('What did we decide about the retry budget?', { exact: true })
        .waitFor({ timeout: 5000 })
      const partial = await poll(
        async () => {
          if (!(await answering().count())) return null
          const t = await pane()
            .getByText(/three attempts/)
            .first()
            .textContent()
          return t
        },
        15_000,
        'streamed text under the Answering spinner',
      )
      // held: everything before the cut has arrived, the half marker is not shown
      await pane()
        .getByText(/then dead-letter/)
        .first()
        .waitFor({ timeout: 10_000 })
      expect(
        await pane()
          .getByText(/then dead-letter/)
          .first()
          .textContent(),
      ).not.toMatch(/\[s/)
      expect(partial).not.toMatch(/\[s\d/) // aliases never leak: markers are rewritten as they stream
      // still spinner, no caret or hover: the baseline is the state
      await w().emulateMedia({ reducedMotion: 'reduce' })
      await w().evaluate('document.activeElement?.blur()')
      await w().mouse.move(0, 0)
      await expectScreenshot(app, 'ask-streaming-light', { region: pane() })
      await setScheme(w(), 'dark')
      await expectScreenshot(app, 'ask-streaming-dark', { region: pane() })
      await setScheme(w(), 'light')
      await w().emulateMedia({ reducedMotion: null })
    } finally {
      release()
    }

    // the answer: text with [n] markers (the chips), and one chip per citation
    const answer = await poll(() => lastAnswer(SEED.long), 15_000, 'the persisted answer')
    expect(answer.citations).toHaveLength(2)
    await pane().getByText(answer.text, { exact: true }).waitFor({ timeout: 10_000 })
    await poll(async () => (await answering().count()) === 0, 5000, 'the spinner to go')
    const { segments } = await daemon.client.call('getTranscript', { params: { id: SEED.long } })
    const cited = answer.citations.map((c) => segments.find((s) => s.id === c.segmentId)!)
    const chipName = (n: number) =>
      `Citation ${n}: ${speakerName(cited[n - 1]!.speaker)} at ${formatOffset(cited[n - 1]!.startMs)}`
    const chip2 = pane().getByRole('button', { name: chipName(2), exact: true })
    await chip2.waitFor()
    await pane()
      .getByRole('button', { name: chipName(1), exact: true })
      .waitFor()
    expect(await app.axe()).toEqual([])
    await expectScreenshot(app, 'ask-answered-light', { region: pane() })
    await setScheme(w(), 'dark')
    expect(await app.axe()).toEqual([])
    await expectScreenshot(app, 'ask-answered-dark', { region: pane() })
    await setScheme(w(), 'light')

    // follow citation 2: the transcript panel scrolls back to that line, which is the one selected;
    // the answer stays where it is
    await chip2.click()
    await poll(transcriptOpen, 5000, 'the transcript panel')
    await poll(
      async () => JSON.stringify(await selectedRowNames(w())) === JSON.stringify([rowName(cited[1]!)]),
      5000,
      'citation 2 selected (and only it)',
    )
    await poll(
      async () => (await visibleRowNames(w())).includes(rowName(cited[1]!)),
      5000,
      'citation 2 on screen',
    )

    // citation 1 moves the highlight (the answer never went away)
    await pane()
      .getByRole('button', { name: chipName(1), exact: true })
      .click()
    await poll(
      async () => JSON.stringify(await selectedRowNames(w())) === JSON.stringify([rowName(cited[0]!)]),
      5000,
      'citation 1 selected',
    )
    await poll(
      async () => (await visibleRowNames(w())).includes(rowName(cited[0]!)),
      5000,
      'citation 1 on screen',
    )
    // following the same citation again re-scrolls to it (a new navigation), even after scrolling away
    await transcriptList(w()).focus()
    await w().keyboard.press('End')
    await pane()
      .getByRole('button', { name: chipName(1), exact: true })
      .click()
    await poll(
      async () => (await visibleRowNames(w())).includes(rowName(cited[0]!)),
      5000,
      'citation 1 again',
    )
  })

  it('shows a refusal as a notice, replacing the partial text that streamed before it', async () => {
    await openAsk()
    api.enqueue(...loadCassette(join(CASSETTES, 'refusal.json')))
    await ask('Tell me something you will refuse')
    // the partial arrives first…
    const partial = pane().getByText('The retry budget', { exact: true })
    await partial.waitFor({ timeout: 15_000 })
    // …then the notice replaces it
    await pane()
      .getByText(/The model declined to answer this question/)
      .waitFor({ timeout: 15_000 })
    await poll(async () => (await partial.count()) === 0, 5000, 'the partial text to be gone')
    expect((await lastAnswer(SEED.long)).stopReason).toBe('refusal')
    expect(await app.axe()).toEqual([])
    await expectScreenshot(app, 'ask-refused-light', { region: pane() })
    await setScheme(w(), 'dark')
    await expectScreenshot(app, 'ask-refused-dark', { region: pane() })
    await setScheme(w(), 'light')
  })

  it('shows questions asked by another client live, and reloads the history from the daemon', async () => {
    // the CLI asks about the same session: qa.message events bring it into the open pane
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    const cli = await gnomeola(['ask', 'Asked from the CLI?', '--session', SEED.long], daemon.baseUrl)
    expect(cli.code).toBe(0)
    await pane().getByText('Asked from the CLI?', { exact: true }).waitFor({ timeout: 10_000 })
    await poll(
      async () =>
        (await pane()
          .getByRole('button', { name: /^Citation 1:/ })
          .count()) >= 1,
      10_000,
      'the CLI answer’s citation chips',
    )

    // away and back: the bar is rebuilt from getQaHistory (it shows the latest exchange)
    await openSession('Platform standup')
    await openSession('Quarterly planning')
    await openAsk()
    await pane().getByText('Asked from the CLI?', { exact: true }).waitFor({ timeout: 10_000 })
    await pane()
      .getByRole('button', { name: /^Citation 1:/ })
      .first()
      .waitFor({ timeout: 10_000 })
    const { messages } = await daemon.client.call('getQaHistory', {
      params: { id: SEED.long },
      query: { includePrivate: true },
    })
    expect(messages.filter((m) => m.role === 'user').map((m) => m.text)).toEqual([
      'What did we decide about the retry budget?',
      'Tell me something you will refuse',
      'Asked from the CLI?',
    ])
  })

  it('asks quickly (no effort to choose), and asks across meetings from home with citations into them', async () => {
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    await ask('Quick question?')
    await poll(
      async () => (await lastAnswer(SEED.long)).text.length > 0 && api.seen.length > 0,
      15_000,
      'an answer',
    )
    await poll(async () => (await answering().count()) === 0, 15_000, 'the answer to finish')
    const sent = api.seen.at(-1)!.body as { output_config?: { effort?: string } }
    expect(sent.output_config?.effort).toBe('low')

    // cross-meeting: home's search-and-ask box; no session history holds it, the stream's final answer
    // is shown, and its citations open the cited meeting at the line
    await w().getByRole('button', { name: 'Back to Today' }).click()
    const box = w().getByRole('searchbox', { name: 'Search or ask' })
    await box.fill('Across meetings: retry budget?')
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    await box.press('Enter')
    const answer = w().getByRole('region', { name: 'Answer' })
    const chip = answer.getByRole('button', { name: /^Citation 1:/ }).last()
    await poll(
      async () =>
        (await answer.getByRole('progressbar', { name: 'Answering' }).count()) === 0 &&
        (await chip.count()) > 0,
      20_000,
      'the cross-meeting answer',
    )
    const body = api.seen.at(-1)!.body as { output_config?: { effort?: string } }
    expect(body.output_config?.effort).toBe('low')
    const name = (await chip.getAttribute('aria-label'))!
    await chip.click()
    await poll(transcriptOpen, 5000, 'a transcript')
    const sel = await poll(async () => (await selectedRowNames(w()))[0], 5000, 'the cited line selected')
    // "Citation 1: Them at 1:06" ↔ "Them at 1:06: …"
    expect(sel.startsWith(`${name.replace(/^Citation 1: /, '')}: `)).toBe(true)
  })

  it('explains an exhausted provider account instead of a raw error — nothing persisted as an answer', async () => {
    await openSession('Platform standup')
    await openAsk()
    await daemon.client.call('updateSettings', { body: { llm: { provider: 'openai' } } })
    try {
      api.enqueue(noCredits())
      await ask('Anything?')
      // the daemon's sentence, and ONE action that fixes it (add credits, or switch provider)
      await pane().getByText('No answer this time', { exact: true }).waitFor({ timeout: 15_000 })
      await pane()
        .getByRole('button', { name: /^(Add Credits|Switch Provider)$/ })
        .waitFor()
      expect(await pane().getByRole('button', { name: 'Try Again' }).count()).toBe(0)
      expect(await answering().count()).toBe(0)
      const { messages } = await daemon.client.call('getQaHistory', { params: { id: SEED.standup } })
      expect(messages.at(-1)).toMatchObject({ role: 'user', text: 'Anything?' })
      expect(await app.axe()).toEqual([])
      await expectScreenshot(app, 'ask-no-credits-light', { region: pane() })
    } finally {
      await daemon.client.call('updateSettings', { body: { llm: { provider: 'anthropic' } } })
    }
  })

  it('answers during a live recording, with citations into the growing transcript', async () => {
    // started with home's New recording (as the GTK suite did with Record); it opens the new session
    await w().getByRole('button', { name: 'Back to Today' }).click()
    await w().getByRole('button', { name: 'New recording', exact: true }).click()
    const s = await poll(
      async () =>
        (await daemon.client.call('listSessions', { query: {} })).sessions.find(
          (x) => x.status === 'recording',
        ),
      10_000,
      'the recording started from the window',
    )
    await w().getByRole('heading', { level: 1, name: 'Untitled meeting' }).waitFor({ timeout: 10_000 })
    // the cassette cites the 3rd and 5th lines: wait until there are enough
    await poll(
      async () => (await daemon.client.call('getTranscript', { params: { id: s.id } })).segments.length >= 6,
      20_000,
      'six segments',
    )
    await openAsk()
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    await ask('What have we said so far?')
    const answer = await poll(() => lastAnswer(s.id).catch(() => null), 20_000, 'an answer')
    expect(answer.citations.length).toBeGreaterThan(0)
    expect((await daemon.client.call('getSession', { params: { id: s.id } })).status).toBe('recording')
    const { segments } = await daemon.client.call('getTranscript', { params: { id: s.id } })
    const cited = segments.find((x) => x.id === answer.citations[0]!.segmentId)!
    const chip = pane().getByRole('button', { name: /^Citation 1:/ })
    await chip.waitFor({ timeout: 10_000 })
    await chip.click()
    await poll(transcriptOpen, 5000, 'the transcript panel')
    // the cited line is found by its start time and speaker (its text may have been revised to final)
    const prefix = `${speakerName(cited.speaker)} at ${formatOffset(cited.startMs)}: `
    await poll(
      async () => {
        const sel = await selectedRowNames(w())
        return (
          sel.length === 1 && sel[0]!.startsWith(prefix) && (await visibleRowNames(w())).includes(sel[0]!)
        )
      },
      5000,
      'the cited live line highlighted',
    )
    // it went through the real API with the key from the environment
    expect(api.seen.at(-1)!.headers['x-api-key']).toBe(KEY)
    // …and stopped with the header's Stop button: the page moves on to the outcome
    await w().getByRole('button', { name: 'Stop', exact: true }).click()
    await w().getByRole('button', { name: 'Share summary' }).waitFor({ timeout: 10_000 })
    expect((await daemon.client.call('getSession', { params: { id: s.id } })).status).toBe('stopped')
  })
})
