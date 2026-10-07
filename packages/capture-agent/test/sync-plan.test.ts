import { createClient, type DurableEvent, type DurableEventData, type Session } from '@kacola/protocol'
import { describe, expect, it } from 'vitest'
import { SyncAgent } from '../src/sync.ts'

// The sync agent's per-event policy (what may leave the machine), without any server.

const session = (id: string, priv: boolean): Session => ({
  id,
  title: id,
  createdAt: '2026-09-01T09:00:00.000Z',
  startedAt: null,
  endedAt: null,
  status: 'stopped',
  private: priv,
  durationMs: 0,
  tracks: [
    {
      kind: 'mic',
      device: 'x',
      sampleRate: 16000,
      audioPath: '/home/u/.local/share/kacola/a.wav',
      archivePath: null,
      gaps: [],
    },
  ],
  error: null,
})
let seq = 0
const ev = (data: DurableEventData): DurableEvent => ({
  seq: ++seq,
  at: '2026-09-01T09:00:00.000Z',
  sessionId: null,
  data,
})
const agent = () =>
  new SyncAgent({
    local: createClient({ baseUrl: 'http://x' }),
    remote: createClient({ baseUrl: 'http://y' }),
  })

describe('what the sync agent pushes', () => {
  it('speakers and attribution of public sessions — never voiceprints, never the voiceprint link', async () => {
    seq = 0
    const a = agent()
    const out = async (d: DurableEventData) => (await a.plan(ev(d))).map((i) => i.data)
    expect((await out({ type: 'session.upserted', session: session('ses_pub', false) }))[0]).toMatchObject({
      type: 'session.upserted',
      session: { tracks: [{ audioPath: null }] }, // local paths never leave
    })
    const speaker = {
      id: 'spk_1',
      sessionId: 'ses_pub',
      label: 'Ana',
      named: true,
      colour: 0,
      voiceprintId: 'vp_ana',
      mergedInto: null,
      createdAt: '2026-09-01T09:00:00.000Z',
    }
    expect(await out({ type: 'speaker.upserted', speaker })).toEqual([
      { type: 'speaker.upserted', speaker: { ...speaker, voiceprintId: null } },
    ])
    const vp = {
      id: 'vp_ana',
      name: 'Ana',
      model: 'm',
      embedding: [0.1, 0.2],
      samples: 1,
      createdAt: '2026-09-01T09:00:00.000Z',
      updatedAt: '2026-09-01T09:00:00.000Z',
    }
    expect(await out({ type: 'voiceprint.upserted', voiceprint: vp })).toEqual([])
    expect(await out({ type: 'voiceprint.deleted', voiceprintId: 'vp_ana' })).toEqual([])
    const attributed = {
      type: 'segments.attributed' as const,
      sessionId: 'ses_pub',
      speakerId: 'spk_1',
      segmentIds: ['seg_1'],
      by: 'user' as const,
    }
    expect(await out(attributed)).toEqual([attributed])

    // a private session's speakers and attribution stay home
    await out({ type: 'session.upserted', session: session('ses_priv', true) })
    expect(
      await out({ type: 'speaker.upserted', speaker: { ...speaker, id: 'spk_2', sessionId: 'ses_priv' } }),
    ).toEqual([])
    expect(await out({ ...attributed, sessionId: 'ses_priv' })).toEqual([])
    expect(
      await out({ type: 'speaker.merged', sessionId: 'ses_priv', fromId: 'spk_2', intoId: 'spk_3' }),
    ).toEqual([])
    // settings, templates and cross-session Q&A too
    expect(await out({ type: 'template.deleted', id: 't' })).toEqual([])
  })
})
