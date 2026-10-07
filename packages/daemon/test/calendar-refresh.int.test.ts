import { mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type AnyEvent, createClient, type KacolaClient } from '@kacola/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import {
  type CalendarProvider,
  type CalendarSnapshot,
  FileCalendarProvider,
  type ProviderListener,
} from '../src/calendar/providers.ts'
import { createDaemon, type Daemon } from '../src/daemon.ts'
import { MemoryKeyring } from '../src/keyring.ts'
import { at, occ } from './calendar-helpers.ts'

// Refresh calendar (POST /calendar/refresh) in the real daemon, over HTTP: the provider is asked to
// re-read, the answer waits for its new snapshot and carries the status and the occurrence count,
// `calendar.updated` goes out like for any snapshot, calendars that are not up to date are named, and a
// provider that cannot deliver answers `refreshed: false` instead of hanging.

/** A provider that counts re-reads; each one delivers `next()` (or nothing, when it returns null). */
class CountingProvider implements CalendarProvider {
  readonly name = 'counting'
  readonly expands = false
  reads = 0
  private l: ProviderListener | null = null
  private readonly next: (read: number) => CalendarSnapshot | null
  constructor(next: (read: number) => CalendarSnapshot | null) {
    this.next = next
  }
  start(l: ProviderListener): void {
    this.l = l
    this.read()
  }
  private read(): void {
    this.reads++
    const s = this.next(this.reads)
    if (!s) return
    this.l?.snapshot(s)
    this.l?.status('ok', null)
  }
  setWindow(): void {}
  refresh(): void {
    // asynchronous, like the cal-agent's answer over its pipe
    setTimeout(() => this.read(), 20)
  }
  async stop(): Promise<void> {
    this.l = null
  }
}

const now = Date.now()
const meeting = (n: number) =>
  occ({ uid: `m${n}@x`, summary: `Meeting ${n}`, start: at(now, 60 * n), end: at(now, 60 * n + 30) })

describe('POST /calendar/refresh', () => {
  let dir = ''
  let daemon: Daemon | null = null
  afterEach(async () => {
    await daemon?.close()
    daemon = null
    if (dir) rmSync(dir, { recursive: true, force: true })
  })
  const start = async (calendar: CalendarProvider): Promise<KacolaClient> => {
    dir = mkdtempSync(join(tmpdir(), 'kacola-cal-refresh-'))
    daemon = await createDaemon({
      dataDir: join(dir, 'data'),
      port: 0,
      keyring: new MemoryKeyring(),
      env: {},
      calendar,
    })
    return createClient({ baseUrl: daemon.url, timeoutMs: 20_000 })
  }

  it('re-reads through the provider, waits for the snapshot, and answers the status and count', async () => {
    // each read sees one more meeting than the last (as if someone added one in GNOME Calendar)
    const p = new CountingProvider((read) => ({
      calendars: [{ id: 'cal-work', name: 'Work' }],
      occurrences: Array.from({ length: read }, (_, i) => meeting(i + 1)),
    }))
    const c = await start(p)
    expect(p.reads).toBe(1)
    const events: AnyEvent[] = []
    const off = daemon!.bus.subscribe((e) => events.push(e))

    const r = await c.call('refreshCalendar')
    expect(p.reads).toBe(2)
    expect(r).toMatchObject({
      refreshed: true,
      occurrences: 2,
      calendar: { state: 'ok', provider: 'counting', calendars: [{ id: 'cal-work' }], offline: [] },
    })
    // what home lists afterwards is the new snapshot
    const list = await c.call('listMeetings', { query: { from: at(now, -60), to: at(now, 6 * 60) } })
    expect(list.meetings.map((m) => m.title)).toEqual(['Meeting 1', 'Meeting 2'])
    await c.call('refreshCalendar')
    expect(p.reads).toBe(3)
    off()
    const updates = events.filter((e) => e.data.type === 'calendar.updated')
    expect(updates.length).toBeGreaterThanOrEqual(2) // one per refresh's snapshot
  })

  it('names the calendars that are not up to date, and why', async () => {
    const p = new CountingProvider(() => ({
      calendars: [{ id: 'cal-work', name: 'Work' }],
      occurrences: [meeting(1)],
      offline: [{ id: 'cal-team', name: 'Team', reason: 'sign-in' }],
    }))
    const c = await start(p)
    const r = await c.call('refreshCalendar')
    expect(r.calendar.offline).toEqual([{ id: 'cal-team', name: 'Team', reason: 'sign-in' }])
    expect((await c.call('calendarStatus')).offline).toEqual([
      { id: 'cal-team', name: 'Team', reason: 'sign-in' },
    ])
  })

  it('answers refreshed: false after the wait when no snapshot comes (the old meetings stay)', async () => {
    const p = new CountingProvider((read) =>
      read === 1 ? { calendars: [{ id: 'cal-work', name: 'Work' }], occurrences: [meeting(1)] } : null,
    )
    const c = await start(p)
    daemon!.calendar.refresh = (
      (orig) => (ms?: number) =>
        orig(ms ?? 300)
    )(daemon!.calendar.refresh.bind(daemon!.calendar))
    const r = await c.call('refreshCalendar')
    expect(p.reads).toBe(2)
    expect(r).toMatchObject({ refreshed: false, occurrences: 1, calendar: { state: 'ok' } })
  })

  it('the file provider re-reads its file even when its mtime did not change', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'kacola-cal-file-'))
    const file = join(tmp, 'calendar.json')
    try {
      writeFileSync(file, JSON.stringify([meeting(1)]))
      const c = await start(new FileCalendarProvider(file, { pollMs: 60_000 }))
      await expect.poll(async () => (await c.call('calendarStatus')).state).toBe('ok')
      const { mtime } = statSync(file)
      writeFileSync(file, JSON.stringify([meeting(1), meeting(2), meeting(3)]))
      utimesSync(file, mtime, mtime) // a copy that kept its timestamp: polling would never notice
      const r = await c.call('refreshCalendar')
      expect(r).toMatchObject({
        refreshed: true,
        occurrences: 3,
        calendar: { state: 'ok', provider: 'file' },
      })
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('a provider that fails answers at once with refreshed: false and the reason', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'kacola-cal-file-'))
    const file = join(tmp, 'calendar.json')
    try {
      writeFileSync(file, '{ not json')
      const c = await start(new FileCalendarProvider(file, { pollMs: 60_000 }))
      const t0 = Date.now()
      const r = await c.call('refreshCalendar')
      expect(Date.now() - t0).toBeLessThan(5000)
      expect(r.refreshed).toBe(false)
      expect(r.calendar.state).toBe('unavailable')
      expect(r.calendar.detail).toMatch(/calendar file/)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('with calendar reading off it answers at once, refreshed: false', async () => {
    dir = mkdtempSync(join(tmpdir(), 'kacola-cal-refresh-'))
    daemon = await createDaemon({
      dataDir: join(dir, 'data'),
      port: 0,
      keyring: new MemoryKeyring(),
      env: {},
    })
    const c = createClient({ baseUrl: daemon.url, timeoutMs: 5_000 })
    const r = await c.call('refreshCalendar')
    expect(r).toMatchObject({ refreshed: false, occurrences: 0, calendar: { state: 'off' } })
  })
})
