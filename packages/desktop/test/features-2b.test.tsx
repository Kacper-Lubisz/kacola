// @vitest-environment jsdom
import type { QaMessage, Segment, SpeakerSummary } from '@gnomeola/protocol'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderApp } from './app-harness.tsx'
import { segment, session, until } from './helpers.ts'

// Transcript / Ask / Speakers through the real router and panes (jsdom, fake daemon): the states and
// names the e2e suite relies on, without a window. (The virtualised list itself needs layout, so its
// rows are covered by the Playwright e2e.)

afterEach(() => cleanup())

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
    const r = app({})
    await screen.findByRole('heading', { name: 'No Transcript' })
    r.stop()
  })

  it('a live session waiting for speech shows the live badge and “Listening…”', async () => {
    const r = app({ status: 'recording' })
    await screen.findByRole('heading', { name: 'Listening…' })
    expect(within(screen.getByRole('region', { name: 'Transcript' })).getByText('Live')).toBeTruthy()
    r.stop()
  })

  it('has a transcript listbox once there are lines', async () => {
    const r = app({ segments: [segment('g1', S, { text: 'Hello', quality: 'final' })] })
    await screen.findByRole('listbox', { name: 'Transcript' })
    r.stop()
  })
})

describe('Ask pane', () => {
  it('shows the history: answers with named citation chips, and a refusal as a notice (no partial text)', async () => {
    const cite = { sessionId: S, segmentId: 'g1', startMs: 66_000, endMs: 70_000, speaker: 'Ana' }
    const r = app({
      path: `/sessions/${S}?tab=ask`,
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
        qa('r2', 'user', 'Refuse this'),
        qa('r2', 'assistant', 'The retry', { stopReason: 'refusal' }),
      ],
    })
    await screen.findByText('Retry budget?')
    const chip = screen.getByRole('button', { name: 'Citation 1: Ana at 1:06' })
    expect(chip.textContent).toBe('[1]')
    // the paragraph reads as the answer text, markers included
    expect(chip.closest('p')!.textContent).toBe('Three attempts [1].')
    expect(screen.getByText(/The model declined to answer this question/)).toBeTruthy()
    expect(screen.queryByText('The retry')).toBeNull()
    // following the chip opens the transcript at the cited line
    fireEvent.click(chip)
    await until(() => r.router.state.location.search.tab === 'transcript')
    expect(r.router.state.location.search).toMatchObject({ tab: 'transcript', segment: 'g1', t: 66 })
    r.stop()
  })

  it('an empty history explains what Ask does; the composer offers scope and effort', async () => {
    const r = app({ path: `/sessions/${S}?tab=ask` })
    await screen.findByRole('heading', { name: 'Ask About This Meeting' })
    expect(screen.getByRole('textbox', { name: 'Question' })).toBeTruthy()
    for (const g of ['Scope', 'Effort']) expect(screen.getByRole('radiogroup', { name: g })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ask' }).hasAttribute('disabled')).toBe(true)
    r.stop()
  })
})

describe('Speakers dialog', () => {
  it('lists me first, far-end speakers with rename and merge, and a voiceprint link as “Recognised”', async () => {
    const r = app({})
    fireEvent.click(await screen.findByRole('button', { name: 'Speakers' }))
    const list = await screen.findByRole('list', { name: 'Speakers' })
    const rows = within(list).getAllByRole('listitem')
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
