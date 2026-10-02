// @vitest-environment jsdom
import type { QaMessage, Segment, SpeakerSummary } from '@gnomeola/protocol'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ownAsks } from '../src/renderer/features/ask/own-asks.ts'
import { renderApp } from './app-harness.tsx'
import { segment, session, until } from './helpers.ts'

// Transcript / Ask / Speakers through the real router and the meeting page (jsdom, fake daemon): the
// states and names the e2e suite relies on, without a window. (The virtualised list itself needs layout, so its
// rows are covered by the Playwright e2e.)

afterEach(() => {
  cleanup()
  // this window's own questions outlive a pane (by design); not a test
  ownAsks.setState({ bySession: {} })
})

const S = 's1'
const qa = (
  requestId: string,
  role: 'user' | 'assistant',
  text: string,
  over: Partial<QaMessage> = {},
): QaMessage => ({
  id: `${requestId}-${role}`,
  sessionId: S,
  requestId,
  role,
  text,
  citations: [],
  model: null,
  usage: null,
  stopReason: role === 'assistant' ? 'end_turn' : null,
  createdAt: '2026-09-30T10:00:00.000Z',
  ...over,
})
const summary = (
  id: string,
  label: string,
  colour: number | null,
  over: Partial<SpeakerSummary> = {},
): SpeakerSummary => ({
  id,
  label,
  track: id === 'me' ? 'mic' : 'system',
  named: false,
  colour,
  voiceprintId: null,
  segments: 2,
  talkMs: 5000,
  ...over,
})

function app(o: {
  status?: 'stopped' | 'recording'
  segments?: Segment[]
  messages?: QaMessage[]
  path?: string
}) {
  const s = session(S, { title: 'Weekly sync', status: o.status ?? 'stopped' })
  return renderApp({
    sessions: [s],
    path: o.path ?? `/sessions/${S}`,
    handlers: {
      getSession: () => s,
      getTranscript: () => ({
        session: s,
        segments: o.segments ?? [],
        window: null,
        total: o.segments?.length ?? 0,
      }),
      getQaHistory: () => ({ messages: o.messages ?? [] }),
      listAgendas: () => ({ agendas: [] }),
      listSpeakers: () => ({
        speakers: [
          summary('me', 'me', null),
          summary('spk_1', 'Ana', 0, { voiceprintId: 'vp_1', named: true }),
          summary('spk_2', 'Speaker 2', 1),
        ],
      }),
    },
  })
}

describe('Transcript pane states', () => {
  it('a finished session with nothing transcribed says so', async () => {
    const r = app({ path: `/sessions/${S}?panel=transcript` })
    await screen.findByRole('heading', { name: 'No Transcript' })
    r.stop()
  })

  it('a live session waiting for speech says “Listening…” (the recording state is the header’s alone)', async () => {
    const r = app({ status: 'recording', path: `/sessions/${S}?panel=transcript` })
    await screen.findByRole('heading', { name: 'Listening…' })
    expect(within(screen.getByRole('region', { name: 'Transcript' })).queryByText('Live')).toBeNull()
    r.stop()
  })

  it('has a transcript listbox once there are lines', async () => {
    const r = app({
      path: `/sessions/${S}?panel=transcript`,
      segments: [segment('g1', S, { text: 'Hello', quality: 'final' })],
    })
    await screen.findByRole('listbox', { name: 'Transcript' })
    r.stop()
  })
})

describe('Ask (Ctrl+K)', () => {
  const askBar = async () => {
    await screen.findByRole('heading', { level: 1, name: 'Weekly sync' })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    return screen.findByRole('region', { name: 'Ask about this meeting' })
  }

  it('shows the latest answer with named citation chips; a chip opens the transcript and the answer stays', async () => {
    const cite = { sessionId: S, segmentId: 'g1', startMs: 66_000, endMs: 70_000, speaker: 'Ana' }
    const r = app({
      segments: [
        segment('g1', S, {
          text: 'Three attempts.',
          startMs: 66_000,
          track: 'system',
          speaker: 'Ana',
          speakerId: 'spk_1',
          quality: 'final',
        }),
      ],
      messages: [
        qa('r1', 'user', 'Retry budget?'),
        qa('r1', 'assistant', 'Three attempts [1].', { citations: [cite] }),
      ],
    })
    const bar = await askBar()
    await within(bar).findByText('Retry budget?')
    const chip = within(bar).getByRole('button', { name: 'Citation 1: Ana at 1:06' })
    expect(chip.textContent).toBe('[1]')
    // the paragraph reads as the answer text, markers included
    expect(chip.closest('p')!.textContent).toBe('Three attempts [1].')
    expect(within(bar).getByRole('button', { name: 'Pin to notes' })).toBeTruthy()
    // following the chip opens the transcript beside the page at the cited line; the answer stays
    fireEvent.click(chip)
    await until(() => r.router.state.location.search.panel === 'transcript')
    expect(r.router.state.location.search).toMatchObject({ panel: 'transcript', segment: 'g1', t: 66 })
    expect(screen.getByRole('region', { name: 'Ask about this meeting' })).toBeTruthy()
    r.stop()
  })

  it('a refusal is a notice (no partial text); no scope or effort to choose; Escape closes it', async () => {
    const r = app({
      messages: [
        qa('r2', 'user', 'Refuse this'),
        qa('r2', 'assistant', 'The retry', { stopReason: 'refusal' }),
      ],
    })
    const bar = await askBar()
    await within(bar).findByText(/The model declined to answer this question/)
    expect(within(bar).queryByText('The retry')).toBeNull()
    expect(within(bar).queryByRole('button', { name: 'Pin to notes' })).toBeNull()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    const box = within(bar).getByRole('textbox', { name: 'Ask about this meeting' })
    expect(within(bar).getByRole('button', { name: 'Ask' }).hasAttribute('disabled')).toBe(true)
    fireEvent.keyDown(box, { key: 'Escape' })
    await until(() => screen.queryByRole('region', { name: 'Ask about this meeting' }) === null)
    r.stop()
  })
})

describe('Ask errors and what was sent', () => {
  const askWith = (r: ReturnType<typeof app>, events: unknown[]) => {
    ;(r.services.api as unknown as { ask: unknown }).ask = async function* () {
      for (const e of events) yield e
    }
  }
  const ask = async (q: string) => {
    await screen.findByRole('heading', { level: 1, name: 'Weekly sync' })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const bar = await screen.findByRole('region', { name: 'Ask about this meeting' })
    fireEvent.change(within(bar).getByRole('textbox', { name: 'Ask about this meeting' }), {
      target: { value: q },
    })
    fireEvent.click(within(bar).getByRole('button', { name: 'Ask' }))
    return bar
  }
  const question = (requestId: string, scope?: unknown) => ({
    type: 'question',
    message: qa(requestId, 'user', 'Retry budget?'),
    ...(scope ? { scope } : {}),
  })

  it('says what was sent where', async () => {
    const r = app({})
    askWith(r, [
      question('r9', { sessionIds: [S], excludedPrivate: 0, provider: 'anthropic', onDevice: false }),
      { type: 'delta', text: 'Three.' },
      { type: 'answer', message: qa('r9', 'assistant', 'Three.') },
    ])
    const bar = await ask('Retry budget?')
    await within(bar).findByText('Sent 1 meeting to Anthropic')
    r.stop()
  })

  it('shows the daemon’s message with its one action: Add credits opens the billing page; Try again keeps the question', async () => {
    const r = app({})
    const err = {
      code: 'unavailable',
      message: 'Your Anthropic account has no credits left. Add credits with Anthropic, or switch provider.',
      reason: 'no-credits',
      action: 'add-credits',
      link: 'https://console.anthropic.com/settings/billing',
    }
    askWith(r, [question('r7'), { type: 'error', error: err }])
    const bar = await ask('Retry budget?')
    await within(bar).findByText(err.message)
    fireEvent.click(within(bar).getByRole('button', { name: 'Add credits' }))
    await until(() => r.fb.bridge.openExternal.mock.calls.length === 1)
    expect((r.fb.bridge.openExternal.mock.calls as unknown as string[][])[0]![0]).toBe(err.link)
    expect(within(bar).queryByRole('button', { name: 'Set up a provider' })).toBeNull()
    // overloaded: Try again asks the same question again
    let asked = 0
    ;(r.services.api as unknown as { ask: unknown }).ask = async function* (body: { question: string }) {
      asked++
      expect(body.question).toBe('Retry budget?')
      yield question('r8')
      yield {
        type: 'error',
        error: {
          code: 'unavailable',
          message: 'Anthropic is busy right now. Try again in a minute.',
          reason: 'overloaded',
          action: 'retry',
        },
      }
    }
    fireEvent.change(within(bar).getByRole('textbox', { name: 'Ask about this meeting' }), {
      target: { value: 'Retry budget?' },
    })
    fireEvent.click(within(bar).getByRole('button', { name: 'Ask' }))
    await within(bar).findByText('Anthropic is busy right now. Try again in a minute.')
    fireEvent.click(within(bar).getByRole('button', { name: 'Try again' }))
    await until(() => asked === 2)
    r.stop()
  })

  it('a private meeting with a cloud provider is not a failure', async () => {
    const r = app({})
    askWith(r, [
      {
        type: 'error',
        error: {
          code: 'conflict',
          message: "This meeting is private, so kacola won't send it to Anthropic.",
          reason: 'private-meeting',
          action: 'none',
        },
      },
    ])
    const bar = await ask('Retry budget?')
    await within(bar).findByText('Private meetings stay on this computer')
    expect(within(bar).queryByRole('button', { name: 'Try again' })).toBeNull()
    r.stop()
  })
})

describe('Speakers dialog', () => {
  it('lists me first, far-end speakers with rename and merge, and a voiceprint link as “Recognised”', async () => {
    const r = app({})
    fireEvent.click(await screen.findByRole('button', { name: 'Meeting actions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Speakers…' }))
    const list = await screen.findByRole('list', { name: 'Speakers' })
    const rows = await within(list).findAllByRole('listitem')
    expect(rows.map((x) => x.getAttribute('aria-label'))).toEqual(['Me', 'Ana', 'Speaker 2'])
    expect(within(rows[0]!).queryByRole('button', { name: /Rename/ })).toBeNull()
    expect(within(rows[1]!).getByText('Recognised from an earlier meeting')).toBeTruthy()
    expect(within(rows[2]!).queryByText('Recognised from an earlier meeting')).toBeNull()
    expect(screen.getByRole('img', { name: 'Ana, colour 1' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Me, your colour' })).toBeTruthy()
    await act(async () => {
      fireEvent.click(within(rows[1]!).getByRole('button', { name: 'Rename Ana' }))
    })
    expect(screen.getByRole('textbox', { name: 'New name for Ana' })).toBeTruthy()
    r.stop()
  })
})
