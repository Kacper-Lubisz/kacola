import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FakePipeline } from '../src/fakes/pipeline.ts'
import type { PipelineSink, SegmentUpsert } from '../src/interfaces.ts'
import { DEFAULT_SETTINGS } from '../src/settings.ts'

// The sandbox's live scripts (FakePipeline scriptLive): a recording starts quiet, ignores what the file
// held before it started, and speaks what is written while it records, from the audio time reached.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function sink(segments: SegmentUpsert[]): PipelineSink {
  return {
    level: () => {},
    partial: () => {},
    segment: (s: SegmentUpsert) => void segments.push(s),
    gap: () => {},
    error: () => {},
  } as unknown as PipelineSink
}

const script = (text: string) =>
  JSON.stringify({
    utterances: [
      { track: 'system', speaker: 'Ana', startMs: 0, endMs: 100, text },
      { track: 'mic', startMs: 150, endMs: 250, text: `${text} (me)` },
    ],
  })

describe('FakePipeline scriptLive', () => {
  it('starts quiet, ignores an old script, then speaks what is written while it records', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scripted-live-'))
    dirs.push(dir)
    const file = join(dir, 'play.json')
    writeFileSync(file, script('an old scenario'))
    const p = new FakePipeline({ scriptFile: file, scriptLive: true, speed: 1, tickMs: 10 })
    const segments: SegmentUpsert[] = []
    const rec = await p.start(
      {
        sessionId: 'ses_1',
        sessionDir: join(dir, 's'),
        tracks: [
          { kind: 'mic', device: 'default' },
          { kind: 'system', device: 'default' },
        ],
        settings: DEFAULT_SETTINGS,
      },
      sink(segments),
    )
    await wait(500)
    expect(segments).toEqual([])
    await wait(20)
    writeFileSync(file, script('the new one'))
    const until = Date.now() + 5000
    while (segments.filter((s) => s.quality === 'final').length < 2 && Date.now() < until) await wait(20)
    await rec.stop()
    const finals = segments.filter((s) => s.quality === 'final')
    expect(finals.map((s) => [s.speaker, s.text])).toEqual([
      ['Ana', 'the new one'],
      ['me', 'the new one (me)'],
    ])
    // offset by the audio time reached when it was written (not from 0)
    expect(finals[0]!.startMs).toBeGreaterThanOrEqual(500)
  })
})
