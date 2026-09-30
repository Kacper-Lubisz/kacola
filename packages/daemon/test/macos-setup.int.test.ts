import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// P-3: the daemon exactly as it is configured on macOS (GNOMEOLA_PLATFORM=darwin), on a PATH that holds
// nothing but node — no pw-record, pw-dump, gjs or secret-tool to fall back on. It must come up with
// external capture, the Keychain keyring (a fake `security` here), an ICS calendar, no D-Bus and no
// helper processes at all.

const FIXTURES = join(import.meta.dirname, 'fixtures')
const dir = mkdtempSync(join(tmpdir(), 'gnomeola-macos-setup-'))
const bin = join(dir, 'bin')
const db = join(dir, 'keychain.json')
const argvLog = join(dir, 'security-argv.log')
let d: DaemonHandle

beforeAll(async () => {
  mkdirSync(bin)
  symlinkSync(process.execPath, join(bin, 'node')) // the fake security's #!/usr/bin/env node
  d = await startDaemon({
    fake: false,
    env: {
      GNOMEOLA_PLATFORM: 'darwin',
      PATH: bin,
      // the macOS defaults, not the harness's Linux-safe ones
      GNOMEOLA_KEYRING: undefined,
      GNOMEOLA_DBUS: undefined,
      GNOMEOLA_MIC_ACTIVITY: undefined,
      GNOMEOLA_CALENDAR: `ics:${join(FIXTURES, 'ics', 'google-warsaw.ics')}`,
      GNOMEOLA_CALENDAR_ME: 'kacper@example.com',
      GNOMEOLA_SECURITY_BIN: join(FIXTURES, 'fake-security.mjs'),
      FAKE_SECURITY_DB: db,
      FAKE_SECURITY_ARGV_LOG: argvLog,
      GNOMEOLA_MODELS_DIR: join(dir, 'models'),
    },
  })
}, 60_000)

afterAll(async () => {
  await d?.stop()
})

describe('a daemon configured for macOS', () => {
  it('reports external capture and never starts a helper process (no pw-*, gjs, D-Bus bridge, cal-agent)', async () => {
    const h = await d.client.call('health')
    expect(h.capture).toMatchObject({ available: true, backend: 'external' })
    expect(h.capture.detail).toMatch(/models not ready/)
    expect((await d.client.call('listDevices')).devices.map((x) => `${x.kind}:${x.name}`)).toEqual([
      'source:default',
      'sink:default',
    ])
    await new Promise((r) => setTimeout(r, 1500))
    // ps exits 1 when the daemon has no children at all — the expected case
    const children = spawnSync('ps', ['-o', 'comm=', '--ppid', String(d.pid)], {
      encoding: 'utf8',
    }).stdout.trim()
    expect(children).toBe('')
    expect(d.output()).not.toMatch(/pw-record|pw-dump|gjs|cal-agent|dbus-bridge/)
    expect(await d.client.call('externalCaptureStatus')).toEqual({ captures: [] })
  })

  it('reads meetings from the ICS calendar, with the RSVP read from GNOMEOLA_CALENDAR_ME', async () => {
    await waitFor(
      async () => (await d.client.call('calendarStatus')).state === 'ok',
      10_000,
      'the ICS calendar',
    )
    const list = await d.client.call('listMeetings', {
      query: { from: '2026-10-21T00:00:00Z', to: '2026-10-23T00:00:00Z', includeDeclined: true },
    })
    const byTitle = Object.fromEntries(list.meetings.map((m) => [m.title, m]))
    expect(byTitle['Roadmap review']).toMatchObject({
      start: '2026-10-21T13:00:00.000Z',
      calendar: { name: 'Work' },
    })
    // 16:00 Europe/Warsaw in October (CEST, UTC+2)
    expect(byTitle['Design sync']).toMatchObject({ start: '2026-10-22T14:00:00.000Z' })
    expect(byTitle['Design sync']!.join).toMatchObject({ url: 'https://meet.google.com/abc-defg-hij' })
    const withoutDeclined = await d.client.call('listMeetings', {
      query: { from: '2026-10-21T00:00:00Z', to: '2026-10-23T00:00:00Z' },
    })
    expect(withoutDeclined.meetings.map((m) => m.title)).not.toContain('Roadmap review')
  })

  it('keeps API keys in the Keychain (per provider), never in argv, and across restarts', async () => {
    const key = 'sk-ant-keychain-0123456789abcdef'
    expect(await d.client.call('setApiKey', { body: { key, provider: 'anthropic' } })).toEqual({
      configured: true,
    })
    expect(
      await d.client.call('setApiKey', { body: { key: 'sk-proj-openai-0123', provider: 'openai' } }),
    ).toEqual({
      configured: true,
    })
    const stored = JSON.stringify(JSON.parse(readFileSync(db, 'utf8')))
    expect(stored).toContain(key)
    expect(stored).toContain('sk-proj-openai-0123')
    expect(readFileSync(argvLog, 'utf8')).not.toContain(key)
    await d.restart()
    expect((await d.client.call('getSettings')).llm.apiKeyConfigured).toBe(true)
    expect(await d.client.call('setApiKey', { body: { key: null, provider: 'anthropic' } })).toEqual({
      configured: false,
    })
    expect(JSON.stringify(JSON.parse(readFileSync(db, 'utf8')))).not.toContain(key)
  })

  it('left the macOS data locations alone on this Linux box (explicit dirs only)', () => {
    expect(existsSync(join(dir, 'models'))).toBe(false) // status reads never create the models dir
    expect(readdirSync(d.dataDir)).toContain('gnomeola.db')
  })
})
