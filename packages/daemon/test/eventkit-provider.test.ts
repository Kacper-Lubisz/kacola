import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CalendarState } from '@kacola/protocol'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { EventKitCalendarProvider } from '../src/calendar/providers.ts'
import { Logger } from '../src/logger.ts'

// EventKitCalendarProvider against a scripted stand-in for kacola-cal-agent (the Swift helper needs a Mac
// and a person to click Allow): access reported before any snapshot, then the snapshot once granted.

const dir = mkdtempSync(join(tmpdir(), 'kacola-fake-eventkit-'))
const FAKE = join(dir, 'kacola-cal-agent')
writeFileSync(
  FAKE,
  `#!${process.execPath}
import { createInterface } from 'node:readline'
const send = (m) => process.stdout.write(JSON.stringify(m) + '\\n')
send({ type: 'hello', protocol: 2 })
send({ type: 'access', granted: false, detail: 'kacola has not been allowed to read your calendars yet' })
createInterface({ input: process.stdin }).on('line', (line) => {
  const m = JSON.parse(line)
  if (m.type !== 'refresh') return
  send({ type: 'access', granted: true, detail: null })
  send({ type: 'snapshot', from: '2026-10-20T00:00:00.000Z', to: '2026-10-30T00:00:00.000Z',
    calendars: [{ id: 'cal-1', name: 'kacper@gmail.com' }], occurrences: [] })
})
`,
)
chmodSync(FAKE, 0o755)

const open: EventKitCalendarProvider[] = []
afterEach(async () => {
  await Promise.all(open.splice(0).map((p) => p.stop()))
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('EventKitCalendarProvider', () => {
  it('is unavailable until access is granted, then delivers the calendars', async () => {
    const p = new EventKitCalendarProvider({ logger: new Logger(), agentPath: FAKE, minBackoffMs: 60_000 })
    open.push(p)
    const states: [CalendarState, string | null][] = []
    const calendars: string[][] = []
    const next = (pred: () => boolean) =>
      new Promise<void>((done) => {
        const t = setInterval(() => {
          if (!pred()) return
          clearInterval(t)
          done()
        }, 10)
      })
    p.start({
      snapshot: (s) => calendars.push(s.calendars.map((c) => c.name)),
      status: (state, detail) => states.push([state, detail]),
    })
    await next(() => states.some(([s]) => s === 'unavailable'))
    expect(states.at(-1)).toEqual(['unavailable', 'kacola has not been allowed to read your calendars yet'])
    expect(calendars).toEqual([])
    p.refresh()
    await next(() => calendars.length > 0)
    expect(calendars).toEqual([['kacper@gmail.com']])
    expect(states.at(-1)).toEqual(['ok', null])
  })

  it('reports a build without the helper instead of retrying it forever', () => {
    const p = new EventKitCalendarProvider({ logger: new Logger(), agentPath: join(dir, 'missing') })
    const states: CalendarState[] = []
    p.start({ snapshot: () => {}, status: (s) => states.push(s) })
    expect(states).toEqual(['unavailable'])
    expect(p.agentPid).toBeNull()
  })
})
