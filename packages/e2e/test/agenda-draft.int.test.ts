import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DRAFT_SYSTEM_PROMPT } from '@gnomeola/daemon'
import {
  type AgendaDraftEvent,
  type DraftAgendaBody,
  draftEvents,
  GnomeolaApiError,
} from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { type CannedResponse, type FakeAnthropic, startFakeAnthropic } from '../src/fake-anthropic.ts'

// "Plan with Claude", for real: gnomeolad (child process) → the draft route → @gnomeola/llm's provider
// (Anthropic SDK, then OpenAI's Responses API) → HTTP. Only the far ends are local stand-ins. The agenda
// is for next week's occurrence of a weekly 1:1 whose current occurrence was recorded, has notes, and
// has an agenda with an outcome — the "past meeting with the same people" the draft must see.

const box = mkdtempSync(join(tmpdir(), 'gnomeola-e2e-draft-'))
const calFile = join(box, 'calendar.json')
const now = Date.now()
const t = (min: number) => new Date(now + min * 60_000).toISOString()
const WEEK = 7 * 24 * 60
const weekly = (week: number) => ({
  uid: 'one-on-one@x',
  summary: '1:1 with Ana',
  sourceUid: 'cal-work',
  calendarName: 'Work',
  recurrenceId: t(-5 + week * WEEK),
  start: t(-5 + week * WEEK),
  end: t(25 + week * WEEK),
  description: '',
  location: '',
  url: '',
  allDay: false,
  startDate: null,
  endDate: null,
  timezone: 'Europe/Warsaw',
  status: 'CONFIRMED',
  myPartstat: null,
  organizer: 'mailto:me@example.com',
  attendees: 2,
  recurring: true,
  xprops: {},
})

const OUTCOME = 'three attempts, then the dead-letter queue'
const NOTES = '- Ana will own the dashboard from Monday\n'
const GOALS = ['decide the migration date', 'hear how onboarding is going']

const sse = (body: string): CannedResponse => ({
  status: 200,
  headers: { 'content-type': 'text/event-stream' },
  body,
})
const frame = (type: string, data: Record<string, unknown>) =>
  `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`

/** A Messages API stream writing `chunks` as text deltas. */
const anthropicText = (chunks: string[]) =>
  sse(
    frame('message_start', {
      message: {
        id: 'msg_draft',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 700,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 1,
        },
      },
    }) +
      frame('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
      chunks
        .map((text) => frame('content_block_delta', { index: 0, delta: { type: 'text_delta', text } }))
        .join('') +
      frame('content_block_stop', { index: 0 }) +
      frame('message_delta', {
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: {
          input_tokens: 700,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 60,
        },
      }) +
      frame('message_stop', {}),
  )

const resp = (extra: Record<string, unknown> = {}) => ({
  id: 'resp_draft',
  object: 'response',
  model: 'gpt-5.5-2026-04-23',
  ...extra,
})
/** A Responses API stream writing `chunks` as output text deltas. */
const openaiText = (chunks: string[]) =>
  sse(
    frame('response.created', { response: resp({ status: 'in_progress' }) }) +
      chunks.map((delta) => frame('response.output_text.delta', { delta })).join('') +
      frame('response.completed', {
        response: resp({ status: 'completed', usage: { input_tokens: 800, output_tokens: 30 } }),
      }),
  )

let anthropic: FakeAnthropic
let openai: FakeAnthropic
let d: DaemonHandle
let target = ''

async function draft(id: string, body: DraftAgendaBody = {}): Promise<AgendaDraftEvent[]> {
  const out: AgendaDraftEvent[] = []
  for await (const e of draftEvents(d.client.stream('draftAgenda', { params: { id }, body }))) out.push(e)
  return out
}
const agendaState = async (id: string) => {
  const v = await d.client.call('getAgenda', { params: { id }, query: { includePrivate: true } })
  return { version: v.agenda.version, items: v.items.map((i) => i.text) }
}

beforeAll(async () => {
  writeFileSync(
    calFile,
    JSON.stringify({ calendars: [{ id: 'cal-work', name: 'Work' }], occurrences: [weekly(0), weekly(1)] }),
  )
  ;[anthropic, openai] = await Promise.all([startFakeAnthropic(), startFakeAnthropic()])
  d = await startDaemon({
    env: {
      GNOMEOLA_CALENDAR: `file:${calFile}`,
      ANTHROPIC_API_KEY: 'sk-ant-e2e-draft-planted-key-7777',
      ANTHROPIC_BASE_URL: anthropic.url,
      OPENAI_API_KEY: 'sk-proj-e2e-draft-planted-key-0123456789',
      OPENAI_BASE_URL: `${openai.url}/v1`,
      GNOMEOLA_FAKE_PIPELINE: JSON.stringify({
        speed: 20,
        segmentEveryMs: 4000,
        finalizeAfterMs: 30,
        tickMs: 20,
      }),
    },
  })
  const c = d.client
  const current = await waitFor(
    async () => (await c.call('nextMeeting')).current,
    10_000,
    'the calendar file (the 1:1 in progress)',
  )

  // this week's 1:1: an agenda, recorded (which links it), notes typed, one item settled with an outcome
  const past = await c.call('createAgenda', {
    body: {
      meetingId: current.id,
      goals: ['agree the retry budget'],
      items: [
        { text: 'Retry budget', kind: 'decision' },
        { text: 'Dashboard owner', kind: 'question' },
      ],
    },
  })
  const { session } = await c.call('joinMeeting', { params: { id: current.id }, body: {} })
  await waitFor(
    async () =>
      (await c.call('getAgenda', { params: { id: past.agenda.id } })).agenda.sessionId === session.id,
    10_000,
    'the agenda linked to the recording',
  )
  await c.call('putNotes', { params: { id: session.id }, body: { markdown: NOTES, baseVersion: 0 } })
  await c.call('setAgendaItemStatus', {
    params: { id: past.agenda.id, itemId: past.items[0]!.id },
    body: { status: 'covered', outcome: OUTCOME },
  })
  // the recap (the live tracker wave) would ask the same fake provider when the recording stops: no text
  // LLM for that moment, so it settles as `unavailable`
  const llm = (await c.call('getSettings')).llm
  await c.call('updateSettings', { body: { llm: { provider: 'none' } } })
  await c.call('stopSession', { params: { id: session.id } })
  await waitFor(
    async () => {
      const t = (await c.call('getAgendaTracker', { params: { id: past.agenda.id } })).tracker
      return t !== null && ['done', 'unavailable', 'failed'].includes(t.recap.state)
    },
    15_000,
    'the recap to settle',
  )
  await c.call('updateSettings', { body: { llm: { provider: llm.provider, model: llm.model } } })
  // (the tracker's bridge lines while it recorded reached the fakes too; the recording is over)
  anthropic.reset()
  openai.reset()

  // next week's: rolled over on stop (the open "Dashboard owner" carried), goals set by the user
  const next = await waitFor(
    async () =>
      (await c.call('listAgendas', { query: { eventUid: 'one-on-one@x' } })).agendas.find(
        (a) => a.id !== past.agenda.id,
      ),
    10_000,
    'the next occurrence rolled over',
  )
  target = next.id
  await c.call('updateAgenda', { params: { id: target }, body: { goals: GOALS } })
}, 60_000)
afterEach(() => {
  anthropic.reset()
  openai.reset()
})
afterAll(async () => {
  await d?.stop()
  await Promise.all([anthropic?.close(), openai?.close()])
  rmSync(box, { recursive: true, force: true })
})

type MessagesBody = {
  output_config: { effort: string }
  system: { text: string }[]
  messages: { content: { text: string }[] }[]
}

describe('agenda drafting: daemon → llm → provider', () => {
  it('Anthropic: streams parsed items built from goals and the previous occurrence, writes nothing', async () => {
    expect((await d.client.call('getSettings')).llm.provider).toBe('anthropic')
    const before = await agendaState(target)
    expect(before.items).toEqual(['Dashboard owner'])
    anthropic.enqueue(
      anthropicText([
        'Here is the agenda:\n- [decision] Migration da',
        'te (10m, @me)\n- [question] dashboard owner\n- [info-to-get] How onboarding',
        ' is going (@Ana)\n\n- [brainstorm] Team offsite ideas',
      ]),
    )
    const events = await draft(target)

    expect(events.map((e) => e.type)).toEqual(['started', 'item', 'item', 'item', 'done'])
    expect(events[0]).toEqual({
      type: 'started',
      agendaId: target,
      basedOn: { goals: 2, pastMeetings: 1, existingItems: 1 },
    })
    expect(events.filter((e) => e.type === 'item').map((e) => e.item)).toEqual([
      { text: 'Migration date', kind: 'decision', owner: 'me', timeboxMin: 10 },
      // "dashboard owner" is already on the agenda (carried over): dropped
      { text: 'How onboarding is going', kind: 'info-to-get', owner: 'Ana', timeboxMin: null },
      { text: 'Team offsite ideas', kind: 'topic', owner: null, timeboxMin: null },
    ])
    expect(events.at(-1)).toEqual({
      type: 'done',
      items: 3,
      model: 'claude-opus-5',
      usage: { inputTokens: 700, outputTokens: 60 },
    })

    // what went over the wire
    expect(anthropic.seen).toHaveLength(1)
    const body = anthropic.seen[0]!.body as MessagesBody
    expect(body.system[0]!.text).toBe(DRAFT_SYSTEM_PROMPT)
    expect(body.output_config.effort).toBe('low')
    const user = body.messages[0]!.content.map((b) => b.text).join('')
    expect(user).toContain(`<goals>\n- ${GOALS[0]}\n- ${GOALS[1]}\n</goals>`)
    expect(user).toContain(`- [decision] Retry budget (status: covered; outcome: ${OUTCOME})`)
    expect(user).toContain(NOTES.trim())
    expect(user).toContain('Already on the agenda (do not repeat these):\n- [question] Dashboard owner')
    expect(user).toContain('"recurring":true')

    // proposals only
    expect(await agendaState(target)).toEqual(before)
  })

  it('OpenAI: the same route through the Responses API, capped at maxItems, with the user instructions', async () => {
    await d.client.call('updateSettings', { body: { llm: { provider: 'openai' } } })
    const before = await agendaState(target)
    openai.enqueue(openaiText(['- [must-cover] Migration date\n- [topic] Onboard', 'ing check-in\n']))
    const events = await draft(target, { maxItems: 1, instructions: 'keep it to 30 min' })

    expect(events.map((e) => e.type)).toEqual(['started', 'item', 'done'])
    expect(events[1]).toEqual({
      type: 'item',
      item: { text: 'Migration date', kind: 'must-cover', owner: null, timeboxMin: null },
    })
    expect(events.at(-1)).toMatchObject({ type: 'done', items: 1, model: 'gpt-5.5-2026-04-23' })
    expect(anthropic.seen).toHaveLength(0)
    expect(openai.seen).toHaveLength(1)
    const req = openai.seen[0]!
    expect(`${req.method} ${req.path}`).toBe('POST /v1/responses')
    const body = req.body as { instructions: string }
    expect(body.instructions).toBe(DRAFT_SYSTEM_PROMPT)
    const sent = JSON.stringify(req.body)
    expect(sent).toContain(
      JSON.stringify('<instructions>\nkeep it to 30 min\nPropose at most 1 item.\n</instructions>').slice(
        1,
        -1,
      ),
    )
    expect(sent).toContain(OUTCOME)
    expect(await agendaState(target)).toEqual(before)
  })

  it('no provider: the stream opens and ends with an unavailable error; nothing is sent', async () => {
    await d.client.call('updateSettings', { body: { llm: { provider: 'none' } } })
    const events = await draft(target)
    expect(events.map((e) => e.type)).toEqual(['started', 'error'])
    expect(events[1]).toMatchObject({ error: { code: 'unavailable' } })
    expect(anthropic.seen.length + openai.seen.length).toBe(0)
  })

  it('a private agenda is 404 without includePrivate (like its reads), and drafts with it', async () => {
    const priv = await d.client.call('createAgenda', { body: { title: 'Salary talk', private: true } })
    const refused = await draft(priv.agenda.id).then(
      () => null,
      (e: unknown) => e,
    )
    expect(refused).toBeInstanceOf(GnomeolaApiError)
    expect((refused as GnomeolaApiError).status).toBe(404)
    // with includePrivate it opens (the provider is still switched off here)
    const events = await draft(priv.agenda.id, { includePrivate: true })
    expect(events[0]).toMatchObject({
      type: 'started',
      basedOn: { goals: 0, pastMeetings: 0, existingItems: 0 },
    })
    const missing = await draft('agd_nope').then(
      () => null,
      (e: unknown) => e,
    )
    expect((missing as GnomeolaApiError).status).toBe(404)
  })
})
