import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Segment, SessionStatus } from '@kacola/protocol'
import { assertNoViolations, checkSegmentHistory, checkSegments } from '@kacola/testkit/invariants'
import { describe, expect, it } from 'vitest'
import { defaultDataDir, parseConfig, UsageError } from '../src/config.ts'
import { FakePipeline } from '../src/fakes/pipeline.ts'
import type { PipelineSink } from '../src/interfaces.ts'
import { type LifecycleAction, nextStatus } from '../src/lifecycle.ts'
import { Logger, REDACTED } from '../src/logger.ts'
import { DEFAULT_SETTINGS, mergeSettings } from '../src/settings.ts'

describe('lifecycle state machine', () => {
  const legal: Record<string, string> = {
    'idle:start': 'recording',
    'recording:pause': 'paused',
    'recording:stop': 'stopped',
    'paused:resume': 'recording',
    'paused:stop': 'stopped',
  }
  const actions: LifecycleAction[] = ['start', 'pause', 'resume', 'stop']
  for (const from of SessionStatus.options)
    for (const action of actions) {
      const expected = legal[`${from}:${action}`] ?? null
      it(`${from} --${action}--> ${expected ?? '409'}`, () => {
        expect(nextStatus(from, action)).toBe(expected)
      })
    }
})

describe('logger', () => {
  it('redacts registered secrets, key-shaped strings and credential-named fields, everywhere', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kacola-log-'))
    try {
      const file = join(dir, 'logs', 'd.log')
      const log = new Logger({ file, capacity: 3 })
      log.addSecret('hunter2-very-secret')
      log.info('user pasted hunter2-very-secret into chat', { note: 'x hunter2-very-secret y' })
      log.info('stray key sk-ant-api03-AAAAAAAAAAAAAAAA in a message')
      log.info('fields', { apiKey: 'whatever', Authorization: 'Bearer z', token: 1, fine: 'visible' })
      log.error('boom', { err: new Error('failed with hunter2-very-secret') })
      const lines = [...log.tail(10)]
      log.close()
      const onDisk = readFileSync(file, 'utf8')
      for (const text of [lines.join('\n'), onDisk]) {
        expect(text).not.toContain('hunter2-very-secret')
        expect(text).not.toContain('sk-ant-api03-AAAA')
        expect(text).not.toContain('Bearer z')
        expect(text).not.toContain('whatever')
        expect(text).toContain(REDACTED)
        expect(text).toContain('visible')
      }
      // ring buffer keeps the last N; the file keeps everything
      expect(lines).toHaveLength(3)
      expect(onDisk.trim().split('\n')).toHaveLength(4)
      for (const l of onDisk.trim().split('\n')) expect(() => JSON.parse(l)).not.toThrow()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('config', () => {
  it('resolves the data dir from KACOLA_DATA_DIR, then XDG_DATA_HOME, then ~/.local/share', () => {
    expect(defaultDataDir({ KACOLA_DATA_DIR: '/x/y' })).toBe('/x/y')
    expect(defaultDataDir({ XDG_DATA_HOME: '/xdg' })).toBe('/xdg/kacola')
    expect(defaultDataDir({})).toMatch(/\/\.local\/share\/kacola$/)
  })

  it('parses flags and env, and rejects nonsense', () => {
    const c = parseConfig(['--port', '0', '--data-dir', '/d', '--fake'], { KACOLA_HEARTBEAT_MS: '50' })
    expect(c).toMatchObject({
      port: 0,
      dataDir: '/d',
      fakes: true,
      heartbeatMs: 50,
      host: '127.0.0.1',
      keyring: 'secret-tool',
    })
    expect(parseConfig([], {}).port).toBe(8787)
    expect(() => parseConfig(['--port', 'abc'], {})).toThrow(UsageError)
    expect(() => parseConfig(['--bogus'], {})).toThrow(UsageError)
    expect(() => parseConfig([], { KACOLA_KEYRING: 'kwallet' })).toThrow(UsageError)
    expect(() => parseConfig([], { KACOLA_FAKE_PIPELINE: '{' })).toThrow(UsageError)
  })

  it('M4 desktop integrations: on for real runs, off under fakes, each overridable', () => {
    expect(parseConfig([], {})).toMatchObject({
      calendar: { kind: 'eds' },
      dbus: true,
      micActivity: { kind: 'pipewire' },
      micIdleStopMs: 30_000,
      gjs: 'gjs',
    })
    expect(parseConfig(['--fake'], {})).toMatchObject({
      calendar: { kind: 'off' },
      dbus: false,
      micActivity: { kind: 'off' },
    })
    expect(
      parseConfig(['--fake'], {
        KACOLA_CALENDAR: 'file:/tmp/cal.json',
        KACOLA_DBUS: 'session',
        KACOLA_MIC_ACTIVITY: 'pipewire:rig-mic',
        KACOLA_GJS: '/opt/gjs',
      }),
    ).toMatchObject({
      calendar: { kind: 'file', path: '/tmp/cal.json' },
      dbus: true,
      micActivity: { kind: 'pipewire', target: 'rig-mic' },
      gjs: '/opt/gjs',
    })
    for (const env of [
      { KACOLA_CALENDAR: 'google' },
      { KACOLA_CALENDAR: 'file:' },
      { KACOLA_DBUS: 'system' },
      { KACOLA_MIC_ACTIVITY: 'pulse' },
    ])
      expect(() => parseConfig([], env), JSON.stringify(env)).toThrow(UsageError)
  })
})

describe('settings', () => {
  it('merges patches section-wise over the defaults', () => {
    const s = mergeSettings(DEFAULT_SETTINGS, { llm: { model: 'm' }, retention: { days: 3 } })
    expect(s.llm).toEqual({ ...DEFAULT_SETTINGS.llm, model: 'm' })
    expect(s.retention).toEqual({ ...DEFAULT_SETTINGS.retention, days: 3 })
    expect(s.stt).toEqual(DEFAULT_SETTINGS.stt)
    expect(() => mergeSettings(DEFAULT_SETTINGS, { retention: { days: -1 } })).toThrow()
  })
})

describe('fake pipeline', () => {
  it('produces output that satisfies the segment invariants, including across pause and stop', async () => {
    const upserts: Segment[] = []
    const revisions = new Map<string, number>()
    let levels = 0
    let partials = 0
    const sink: PipelineSink = {
      level: () => levels++,
      partial: () => partials++,
      segment: (s) => {
        const revision = (revisions.get(s.id) ?? 0) + 1
        revisions.set(s.id, revision)
        upserts.push({ ...s, sessionId: 'ses_x', revision })
      },
      gap: () => {},
      error: () => {},
      speaker: () => null,
      attribute: () => {},
      voices: () => {},
    }
    const dir = mkdtempSync(join(tmpdir(), 'kacola-fake-'))
    try {
      const p = new FakePipeline({
        segmentEveryMs: 30,
        finalizeAfterMs: 20,
        tickMs: 5,
        levelEveryMs: 10,
        partialEveryMs: 10,
      })
      const t0 = Date.now()
      const rec = await p.start(
        {
          sessionId: 'ses_x',
          sessionDir: dir,
          tracks: [
            { kind: 'mic', device: 'default' },
            { kind: 'system', device: 'default' },
          ],
          settings: DEFAULT_SETTINGS,
        },
        sink,
      )
      await new Promise((r) => setTimeout(r, 200))
      await rec.pause()
      const pausedAt = Date.now()
      const n = upserts.length
      await new Promise((r) => setTimeout(r, 100))
      const pausedFor = Date.now() - pausedAt
      expect(upserts.filter((u) => u.quality === 'live').length).toBeLessThanOrEqual(n)
      await rec.resume()
      await new Promise((r) => setTimeout(r, 200))
      await rec.stop()
      const wall = Date.now() - t0 - pausedFor
      const latest = [...new Map(upserts.map((u) => [u.id, u])).values()]
      assertNoViolations(checkSegmentHistory(upserts), 'history')
      assertNoViolations(checkSegments(latest, { durationMs: wall, requireFinal: true }), 'final')
      expect(latest.length).toBeGreaterThan(8)
      expect(levels).toBeGreaterThan(10)
      expect(partials).toBeGreaterThan(10)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('deterministic + hold: the same output every run at the hold point, frozen until the release file', async () => {
    const run = async (dir: string) => {
      const out: string[] = []
      const sink: PipelineSink = {
        level: (l) => out.push(`level ${l.track} ${l.elapsedMs}`),
        partial: (p) => out.push(`partial ${p.track} ${p.startMs} ${p.text}`),
        segment: (s) => out.push(`segment ${s.track} ${s.startMs}-${s.endMs} ${s.quality} ${s.text}`),
        gap: () => {},
        error: () => {},
        speaker: () => null,
        attribute: () => {},
        voices: () => {},
      }
      const release = join(dir, 'release')
      const p = new FakePipeline({
        deterministic: true,
        speed: 4,
        tickMs: 2,
        segmentEveryMs: 250,
        partialEveryMs: 40,
        finalizeAfterMs: 100,
        levelEveryMs: 100,
        hold: { atMs: 2000, releaseFile: release },
      })
      const rec = await p.start(
        {
          sessionId: 'ses_x',
          sessionDir: dir,
          tracks: [
            { kind: 'mic', device: 'default' },
            { kind: 'system', device: 'default' },
          ],
          settings: DEFAULT_SETTINGS,
        },
        sink,
      )
      // 2000 audio ms = 250 ticks of 2 ms; give a loaded machine plenty of wall time to get there
      const until = Date.now() + 10_000
      while (!out.includes('level mic 2000') && Date.now() < until)
        await new Promise((r) => setTimeout(r, 20))
      await new Promise((r) => setTimeout(r, 100))
      // held: only the open lines and the level are repeated, nothing new is said
      const atHold = out.filter((l) => !l.startsWith('level') && !l.startsWith('partial'))
      const newest = new Set(out.filter((l) => l.startsWith('partial')).slice(-2))
      await new Promise((r) => setTimeout(r, 100))
      const repeated = out.slice(out.length - 20)
      expect(
        repeated.every(
          (l) => l.startsWith('level mic 2000') || l.startsWith('level system 2000') || newest.has(l),
        ),
      ).toBe(true)
      writeFileSync(release, '')
      const n = out.length
      await new Promise((r) => setTimeout(r, 100))
      expect(out.slice(n).some((l) => l.startsWith('segment'))).toBe(true)
      await rec.stop()
      return atHold
    }
    const dirs = [mkdtempSync(join(tmpdir(), 'kacola-fake-')), mkdtempSync(join(tmpdir(), 'kacola-fake-'))]
    try {
      const [a, b] = [await run(dirs[0]!), await run(dirs[1]!)]
      // provisional and final lines at the hold point, identical across runs
      expect(a.some((l) => l.includes(' live '))).toBe(true)
      expect(a.some((l) => l.includes(' final '))).toBe(true)
      expect(b).toEqual(a)
    } finally {
      for (const d of dirs) rmSync(d, { recursive: true, force: true })
    }
  })
})
