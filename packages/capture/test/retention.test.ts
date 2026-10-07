import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyRetention,
  archivePathFor,
  DAY_MS,
  planRetention,
  type Retention,
  type RetentionSession,
} from '../src/index.ts'

const NOW = new Date('2026-09-28T12:00:00Z')
const ago = (days: number) => new Date(NOW.getTime() - days * DAY_MS)

const session = (id: string, over: Partial<RetentionSession> = {}): RetentionSession => ({
  id,
  endedAt: ago(1),
  transcribedAt: ago(1),
  tracks: [
    { wavPath: `/s/${id}/mic.wav`, archivePath: null },
    { wavPath: `/s/${id}/system.wav`, archivePath: null },
  ],
  ...over,
})

const policy = (p: Partial<Retention>): Retention => ({ audio: 'keep', days: 30, archive: false, ...p })
const kinds = (a: ReturnType<typeof planRetention>) =>
  a.map((x) => (x.type === 'encode' ? `encode ${x.wavPath}` : `delete ${x.path}`))

describe('planRetention', () => {
  it('keep, no archive: nothing to do', () => {
    expect(planRetention([session('a')], policy({}), NOW)).toEqual([])
  })

  it('keep + archive: encode each WAV once, keep the WAV', () => {
    expect(kinds(planRetention([session('a')], policy({ archive: true }), NOW))).toEqual([
      'encode /s/a/mic.wav',
      'encode /s/a/system.wav',
    ])
    const archived = session('a', {
      tracks: [{ wavPath: '/s/a/mic.wav', archivePath: '/s/a/mic.opus' }],
    })
    expect(planRetention([archived], policy({ archive: true }), NOW)).toEqual([])
  })

  it('never touches a session that is still recording, under any policy', () => {
    const live = session('live', { endedAt: null, transcribedAt: null })
    for (const audio of ['keep', 'delete-after-transcription', 'delete-after-days'] as const)
      for (const archive of [false, true])
        expect(planRetention([live], policy({ audio, archive, days: 1 }), NOW)).toEqual([])
  })

  it('delete-after-transcription: deletes WAVs only once transcribed', () => {
    const p = policy({ audio: 'delete-after-transcription' })
    expect(planRetention([session('t', { transcribedAt: null })], p, NOW)).toEqual([])
    expect(kinds(planRetention([session('t')], p, NOW))).toEqual([
      'delete /s/t/mic.wav',
      'delete /s/t/system.wav',
    ])
  })

  it('delete-after-transcription + archive: encode before delete, and keep the archive', () => {
    const a = planRetention(
      [session('t')],
      policy({ audio: 'delete-after-transcription', archive: true }),
      NOW,
    )
    expect(kinds(a)).toEqual([
      'encode /s/t/mic.wav',
      'delete /s/t/mic.wav',
      'encode /s/t/system.wav',
      'delete /s/t/system.wav',
    ])
    expect(a.some((x) => x.type === 'delete' && x.what === 'archive')).toBe(false)
  })

  it('delete-after-days: removes WAV and archive only past the age limit (strictly)', () => {
    const p = policy({ audio: 'delete-after-days', days: 7 })
    const old = session('old', {
      endedAt: ago(8),
      tracks: [{ wavPath: '/s/old/mic.wav', archivePath: '/s/old/mic.opus' }],
    })
    const edge = session('edge', { endedAt: ago(7) })
    const fresh = session('fresh', { endedAt: ago(2), transcribedAt: null })
    expect(kinds(planRetention([old, edge, fresh], p, NOW))).toEqual([
      'delete /s/old/mic.wav',
      'delete /s/old/mic.opus',
    ])
  })

  it('delete-after-days applies even to untranscribed audio (the age limit is the point)', () => {
    const p = policy({ audio: 'delete-after-days', days: 1 })
    expect(
      kinds(planRetention([session('u', { endedAt: ago(3), transcribedAt: null })], p, NOW)),
    ).toHaveLength(2)
  })

  it('skips tracks whose WAV is already gone', () => {
    const gone = session('g', { tracks: [{ wavPath: null, archivePath: '/s/g/mic.opus' }] })
    expect(
      planRetention([gone], policy({ audio: 'delete-after-transcription', archive: true }), NOW),
    ).toEqual([])
  })

  it('archivePathFor swaps the extension', () => {
    expect(archivePathFor('/x/mic.wav')).toBe('/x/mic.opus')
    expect(archivePathFor('/x/MIC.WAV')).toBe('/x/MIC.opus')
  })
})

describe('applyRetention', () => {
  it('a failed encode blocks deleting that WAV; other actions proceed; missing files are fine', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kacola-ret-'))
    const mic = join(dir, 'mic.wav')
    const sys = join(dir, 'system.wav')
    writeFileSync(mic, 'x')
    writeFileSync(sys, 'y')
    const s = session('t', {
      tracks: [
        { wavPath: mic, archivePath: null },
        { wavPath: sys, archivePath: null },
      ],
    })
    const plan = planRetention([s], policy({ audio: 'delete-after-transcription', archive: true }), NOW)
    const results = await applyRetention(
      [...plan, { type: 'delete', sessionId: 't', path: join(dir, 'nope.wav'), what: 'wav', reason: 'x' }],
      {
        encode: async (wav, out) => {
          if (wav === mic) throw new Error('ffmpeg exploded')
          writeFileSync(out, 'opus')
          return out
        },
      },
    )
    expect(results.map((r) => [r.type, r.type === 'encode' ? r.wavPath : r.path, r.ok])).toEqual([
      ['encode', mic, false],
      ['delete', mic, false],
      ['encode', sys, true],
      ['delete', sys, true],
      ['delete', join(dir, 'nope.wav'), true],
    ])
    expect(existsSync(mic)).toBe(true)
    expect(existsSync(sys)).toBe(false)
    expect(existsSync(join(dir, 'system.opus'))).toBe(true)
  })

  it('treats an encoder that "succeeds" without producing a file as a failure', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kacola-ret-'))
    const mic = join(dir, 'mic.wav')
    writeFileSync(mic, 'x')
    const s = session('t', { tracks: [{ wavPath: mic, archivePath: null }] })
    const plan = planRetention([s], policy({ audio: 'delete-after-transcription', archive: true }), NOW)
    const r = await applyRetention(plan, { encode: async (_w, out) => out })
    expect(r.map((x) => x.ok)).toEqual([false, false])
    expect(existsSync(mic)).toBe(true)
  })
})
