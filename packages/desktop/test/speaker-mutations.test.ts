import type { Speaker, SpeakerSummary } from '@gnomeola/protocol'
import { applySpeakerEvent, fromSummaries, type SpeakersState } from '@gnomeola/ui-core/speakers'
import { applyTranscriptEvent, fromSegments, type TranscriptState } from '@gnomeola/ui-core/transcript'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { keys } from '../src/renderer/data/keys.ts'
import type { Api } from '../src/renderer/data/queries.ts'
import {
  mergeSpeakerMutation,
  PENDING_SPEAKER,
  renameSpeakerMutation,
  splitSpeakerMutation,
} from '../src/renderer/features/speakers/mutations.ts'
import { durable, segment } from './helpers.ts'

// Speaker edits are optimistic (the change shows at once) and reconciled by the daemon's echo: the
// optimistic value is the echo folded early, so folding the real echo on top changes nothing; a
// refusal restores what was there.

const S = 's1'
const summary = (id: string, label: string, colour: number | null, segments = 1): SpeakerSummary => ({
  id,
  label,
  track: id === 'me' ? 'mic' : 'system',
  named: false,
  colour,
  voiceprintId: null,
  segments,
  talkMs: segments * 1000,
})
const speaker = (id: string, label: string, colour: number): Speaker => ({
  id,
  sessionId: S,
  label,
  named: true,
  colour,
  voiceprintId: null,
  mergedInto: null,
  createdAt: '2026-09-30T10:00:00.000Z',
})

function setup(call: (name: string, opts: unknown) => Promise<unknown>) {
  const qc = new QueryClient()
  qc.setQueryData(
    keys.speakers(S),
    fromSummaries([
      summary('me', 'me', null, 2),
      summary('spk_1', 'Speaker 1', 0, 2),
      summary('spk_2', 'Speaker 2', 1),
    ]),
  )
  qc.setQueryData(
    keys.transcript(S),
    fromSegments([
      segment('m1', S, { startMs: 0 }),
      segment('x1', S, { track: 'system', speaker: 'Speaker 1', speakerId: 'spk_1', startMs: 1000 }),
      segment('x2', S, { track: 'system', speaker: 'Speaker 2', speakerId: 'spk_2', startMs: 2000 }),
      segment('x3', S, { track: 'system', speaker: 'Speaker 1', speakerId: 'spk_1', startMs: 3000 }),
    ]),
  )
  const api = { call } as unknown as Api
  return { qc, api }
}

const run = <V>(qc: QueryClient, options: object, vars: V) =>
  new MutationObserver(qc, options as never).mutate(vars as never).catch(() => {})

const tr = (qc: QueryClient) => qc.getQueryData<TranscriptState>(keys.transcript(S))!
const sp = (qc: QueryClient) => qc.getQueryData<SpeakersState>(keys.speakers(S))!
const labels = (qc: QueryClient) => tr(qc).ordered.map((s) => `${s.id}:${s.speaker}:${s.speakerId ?? ''}`)

describe('speaker mutations', () => {
  it('rename: every line and the list relabel at once; the echo changes nothing', async () => {
    let resolve!: (v: unknown) => void
    const { qc, api } = setup(() => new Promise((r) => (resolve = r)))
    const p = run(qc, renameSpeakerMutation(api, qc), {
      sessionId: S,
      speaker: sp(qc).byId.get('spk_1')!,
      label: 'Ana',
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(labels(qc)).toEqual(['m1:me:', 'x1:Ana:spk_1', 'x2:Speaker 2:spk_2', 'x3:Ana:spk_1'])
    expect(sp(qc).byId.get('spk_1')).toMatchObject({ label: 'Ana', colour: 0, segments: 2 })
    // the daemon's echo, folded by the EventBridge into the optimistic cache
    const echo = durable(9, { type: 'speaker.upserted', speaker: speaker('spk_1', 'Ana', 0) }, S)
    const before = tr(qc)
    expect(applyTranscriptEvent(before, S, echo)).toBe(before)
    expect(applySpeakerEvent(sp(qc), S, echo).state.byId.get('spk_1')).toMatchObject({
      label: 'Ana',
      segments: 2,
    })
    resolve(speaker('spk_1', 'Ana', 0))
    await p
  })

  it('rename refused (409 duplicate): the old name comes back', async () => {
    const { qc, api } = setup(async () => {
      throw Object.assign(new Error('another speaker is called that — merge them instead'), { status: 409 })
    })
    const before = labels(qc)
    await run(qc, renameSpeakerMutation(api, qc), {
      sessionId: S,
      speaker: sp(qc).byId.get('spk_2')!,
      label: 'Speaker 1',
    })
    expect(labels(qc)).toEqual(before)
    expect(sp(qc).byId.get('spk_2')!.label).toBe('Speaker 2')
  })

  it('merge: the merged speaker leaves the list, its lines and counts move to the survivor', async () => {
    const { qc, api } = setup(async () => speaker('spk_1', 'Speaker 1', 0))
    await run(qc, mergeSpeakerMutation(api, qc), { sessionId: S, fromId: 'spk_2', intoId: 'spk_1' })
    expect(sp(qc).list.map((s) => s.id)).toEqual(['me', 'spk_1'])
    expect(sp(qc).byId.get('spk_1')!.segments).toBe(3)
    expect(labels(qc)).toEqual(['m1:me:', 'x1:Speaker 1:spk_1', 'x2:Speaker 1:spk_1', 'x3:Speaker 1:spk_1'])
    const echo = durable(10, { type: 'speaker.merged', sessionId: S, fromId: 'spk_2', intoId: 'spk_1' }, S)
    expect(applyTranscriptEvent(tr(qc), S, echo)).toBe(tr(qc))
  })

  it('split: the line shows a provisional new speaker until the echo names it; the mic is never split', async () => {
    const { qc, api } = setup(async () => speaker('spk_3', 'Speaker 3', 2))
    await run(qc, splitSpeakerMutation(api, qc), {
      sessionId: S,
      speakerId: 'spk_1',
      segmentIds: ['x3', 'm1'],
    })
    expect(labels(qc)).toEqual([
      'm1:me:',
      'x1:Speaker 1:spk_1',
      'x2:Speaker 2:spk_2',
      `x3:New speaker:${PENDING_SPEAKER}`,
    ])
    // the echo: the new speaker, then the attribution
    let t = applyTranscriptEvent(
      tr(qc),
      S,
      durable(11, { type: 'speaker.upserted', speaker: speaker('spk_3', 'Speaker 3', 2) }, S),
    )
    t = applyTranscriptEvent(
      t,
      S,
      durable(
        12,
        { type: 'segments.attributed', sessionId: S, speakerId: 'spk_3', segmentIds: ['x3'], by: 'user' },
        S,
      ),
    )
    expect(t.byId.get('x3')).toMatchObject({ speaker: 'Speaker 3', speakerId: 'spk_3' })
  })

  it('split refused: the line goes back to its speaker', async () => {
    const { qc, api } = setup(async () => {
      throw new Error('segment not found')
    })
    await run(qc, splitSpeakerMutation(api, qc), { sessionId: S, speakerId: 'spk_1', segmentIds: ['x1'] })
    expect(tr(qc).byId.get('x1')).toMatchObject({ speaker: 'Speaker 1', speakerId: 'spk_1' })
  })
})
