import { type ChildProcess, spawn } from 'node:child_process'
import { chmodSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import {
  extractInviteBlock,
  INVITE_BLOCK_START,
  removeInviteBlock,
  renderInviteBlock,
  upsertInviteBlock,
} from '@gnomeola/protocol'
import { type EdsHandle, type FixtureCalendar, startEds, WINDOW } from '@gnomeola/testkit/eds'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AgentMessage, type DescriptionRequestTarget } from '../src/calendar/agent-protocol.ts'
import { EdsCalendarProvider } from '../src/calendar/providers.ts'
import { Logger } from '../src/logger.ts'

// Agendas, deliverable 6: the invitation block's WRITE path — the real cal-agent (GJS + ECal) and the
// real EdsCalendarProvider against an isolated Evolution Data Server. Every description is read back
// independently (eds-ctl, straight through ECal), never through the code under test.

const AGENT = join(import.meta.dirname, '..', 'gjs', 'cal-agent.js')
const W = 'gnomeola-work'
const RO = 'gnomeola-readonly'
const ORGANISER_TEXT = 'Quarterly planning.\nBring numbers, please; thanks.\n\nRoom 4 — ask Ana for the key.'

const ev = (lines: string[]) =>
  ['BEGIN:VEVENT', 'DTSTAMP:20260901T000000Z', ...lines, 'END:VEVENT'].join('\n')
const CALENDARS: FixtureCalendar[] = [
  {
    uid: W,
    name: 'Work',
    enabled: true,
    components: [
      ev([
        'UID:owned@test',
        'SUMMARY:Planning',
        'DTSTART:20261020T090000Z',
        'DTEND:20261020T100000Z',
        'LOCATION:https://meet.google.com/abc-defg-hij',
        'ORGANIZER:mailto:me@example.com',
        'ATTENDEE;PARTSTAT=ACCEPTED:mailto:ana@example.com',
        'DESCRIPTION:Quarterly planning.\\nBring numbers\\, please\\; thanks.\\n\\nRoom 4 — ask Ana for the key.',
      ]),
      ev(['UID:noorg@test', 'SUMMARY:Focus', 'DTSTART:20261021T090000Z', 'DTEND:20261021T100000Z']),
      ev([
        'UID:theirs@test',
        'SUMMARY:Board review',
        'DTSTART:20261022T090000Z',
        'DTEND:20261022T100000Z',
        'ORGANIZER;CN=Boss:mailto:boss@example.com',
        'ATTENDEE;PARTSTAT=ACCEPTED:mailto:me@example.com',
        'DESCRIPTION:The boss wrote this.',
      ]),
      ev([
        'UID:weekly@test',
        'SUMMARY:Weekly 1:1',
        'DTSTART:20261005T090000Z',
        'DTEND:20261005T093000Z',
        'RRULE:FREQ=WEEKLY;COUNT=3',
        'ORGANIZER:mailto:me@example.com',
        'DESCRIPTION:Standing 1:1.',
      ]),
      // the second occurrence was moved: a detached instance that must survive a series edit
      ev([
        'UID:weekly@test',
        'RECURRENCE-ID:20261012T090000Z',
        'SUMMARY:Weekly 1:1 (moved)',
        'DTSTART:20261013T090000Z',
        'DTEND:20261013T093000Z',
        'ORGANIZER:mailto:me@example.com',
        'DESCRIPTION:Standing 1:1 — moved to Tuesday.',
      ]),
    ],
  },
  {
    uid: RO,
    name: 'Read-only',
    enabled: true,
    components: [
      ev([
        'UID:ro@test',
        'SUMMARY:Subscribed',
        'DTSTART:20261023T090000Z',
        'DTEND:20261023T100000Z',
        'DESCRIPTION:Someone else’s feed.',
      ]),
    ],
  },
]

type Reply = Extract<AgentMessage, { type: 'description' | 'description-written' }>
type Snapshot = Extract<AgentMessage, { type: 'snapshot' }>

class Agent {
  readonly child: ChildProcess
  readonly messages: AgentMessage[] = []
  readonly invalid: string[] = []
  private waiters: (() => void)[] = []
  private n = 0
  stderr = ''

  constructor(env: Record<string, string>) {
    this.child = spawn('gjs', ['-m', AGENT], { env, stdio: ['pipe', 'pipe', 'pipe'] })
    this.child.stdin!.on('error', () => {})
    this.child.stderr!.on('data', (d: Buffer) => {
      this.stderr += d.toString()
    })
    createInterface({ input: this.child.stdout! }).on('line', (line) => {
      const parsed = AgentMessage.safeParse(JSON.parse(line))
      if (parsed.success) this.messages.push(parsed.data)
      else this.invalid.push(`${line.slice(0, 300)} → ${parsed.error.message}`)
      for (const w of this.waiters.splice(0)) w()
    })
  }

  send(msg: unknown) {
    this.child.stdin!.write(`${JSON.stringify(msg)}\n`)
  }

  private async until<T>(find: () => T | undefined, what: string, timeoutMs = 15_000): Promise<T> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const hit = find()
      if (hit !== undefined) return hit
      if (Date.now() > deadline)
        throw new Error(
          `timed out waiting for ${what}\n${this.stderr}\n${JSON.stringify(this.messages.filter((m) => m.type !== 'snapshot')).slice(-3000)}\n${JSON.stringify(this.snapshots().at(-1)?.calendars)}`,
        )
      await new Promise<void>((r) => {
        this.waiters.push(r)
        setTimeout(r, 200)
      })
    }
  }

  snapshots(): Snapshot[] {
    return this.messages.filter((m): m is Snapshot => m.type === 'snapshot')
  }

  nextSnapshot(after: number, pred: (s: Snapshot) => boolean) {
    return this.until(() => this.snapshots().slice(after).find(pred), 'a matching snapshot')
  }

  async ask(msg: Record<string, unknown>): Promise<Reply> {
    const requestId = `r${++this.n}`
    this.send({ ...msg, requestId })
    return this.until(
      () => this.messages.find((m): m is Reply => 'requestId' in m && m.requestId === requestId),
      `reply ${requestId}`,
    )
  }
}

let eds: EdsHandle
let agent: Agent

const target = (
  sourceUid: string,
  uid: string,
  recurring = false,
): Omit<DescriptionRequestTarget, 'requestId'> => ({
  sourceUid,
  uid,
  recurrenceId: null,
  recurring,
})
const read = (t: ReturnType<typeof target>) => agent.ask({ type: 'read-description', ...t })
const write = (t: ReturnType<typeof target>, expect: string, description: string) =>
  agent.ask({ type: 'write-description', ...t, expect, description })
const master = async (sourceUid: string, uid: string) =>
  (await eds.getEvent(sourceUid, uid)).find((c) => c.recurrenceId === null)!

const blockA = renderInviteBlock({
  appLink: 'kacola://agenda/agd_a',
  webLink: 'https://kacola.example/a/agd_a',
})
const blockB = renderInviteBlock({ appLink: 'kacola://agenda/agd_b', webLink: null })
const blocks = (s: string) => s.split(INVITE_BLOCK_START).length - 1

beforeAll(async () => {
  eds = await startEds({ calendars: CALENDARS })
  // The local backend opens a calendar read-only when its directory and file are not writable. The
  // factory opens backends on first connect, i.e. when cal-agent (started below) connects.
  const dir = join(eds.env.XDG_DATA_HOME!, 'evolution', 'calendar', RO)
  for (const f of readdirSync(dir)) chmodSync(join(dir, f), 0o444)
  chmodSync(dir, 0o555)
  agent = new Agent(eds.env)
  agent.send({ type: 'window', ...WINDOW })
  await agent.nextSnapshot(0, (s) => [W, RO].every((id) => s.calendars.some((c) => c.id === id)))
}, 120_000)

afterAll(async () => {
  if (agent && agent.child.exitCode === null) agent.child.kill('SIGKILL')
  if (eds) chmodSync(join(eds.env.XDG_DATA_HOME!, 'evolution', 'calendar', RO), 0o755)
  const r = await eds?.close()
  expect(r?.killedStragglers ?? []).toEqual([])
})

describe('cal-agent: the description write path', () => {
  it('reads an event the user organises as writable, with the organiser text verbatim', async () => {
    expect(await read(target(W, 'owned@test'))).toEqual({
      type: 'description',
      requestId: expect.any(String),
      ok: true,
      description: ORGANISER_TEXT,
      writable: true,
      reason: null,
    })
    expect(await read(target(W, 'noorg@test'))).toMatchObject({ ok: true, description: '', writable: true })
  })

  it('appends the block after the organiser text, keeping it byte for byte and every other property', async () => {
    const before = await master(W, 'owned@test')
    const next = upsertInviteBlock(ORGANISER_TEXT, blockA)
    expect(await write(target(W, 'owned@test'), ORGANISER_TEXT, next)).toMatchObject({
      ok: true,
      changed: true,
      reason: null,
    })
    const after = await master(W, 'owned@test')
    expect(after.description.startsWith(ORGANISER_TEXT)).toBe(true)
    expect(after.description).toBe(`${ORGANISER_TEXT}\n\n${blockA}`)
    expect(extractInviteBlock(after.description)).toBe(blockA)
    expect(after.descriptions).toBe(1)
    expect({ summary: after.summary, location: after.location, organizer: after.organizer }).toEqual({
      summary: before.summary,
      location: before.location,
      organizer: before.organizer,
    })
    expect(after.ical).toContain('ATTENDEE')
    expect(after.ical).toMatch(/DTSTART:20261020T090000Z/)
  })

  it('is idempotent: the same text again is changed:false and still exactly one block', async () => {
    const cur = (await master(W, 'owned@test')).description
    expect(await write(target(W, 'owned@test'), cur, upsertInviteBlock(cur, blockA))).toMatchObject({
      ok: true,
      changed: false,
    })
    expect(blocks((await master(W, 'owned@test')).description)).toBe(1)
  })

  it('updates its own block in place (new link), still one block, organiser text untouched', async () => {
    const cur = (await master(W, 'owned@test')).description
    expect(await write(target(W, 'owned@test'), cur, upsertInviteBlock(cur, blockB))).toMatchObject({
      ok: true,
      changed: true,
    })
    const d = (await master(W, 'owned@test')).description
    expect(d).toBe(`${ORGANISER_TEXT}\n\n${blockB}`)
    expect(blocks(d)).toBe(1)
    // and removing it gives the organiser's text back
    expect(await write(target(W, 'owned@test'), d, removeInviteBlock(d))).toMatchObject({
      ok: true,
      changed: true,
    })
    expect((await master(W, 'owned@test')).description).toBe(ORGANISER_TEXT)
  })

  it('refuses a stale write (compare-and-swap): nothing is written', async () => {
    const r = await write(target(W, 'owned@test'), 'not what is there', 'clobbered')
    expect(r).toMatchObject({ ok: false, changed: false, conflict: true })
    expect((await master(W, 'owned@test')).description).toBe(ORGANISER_TEXT)
  })

  it('edits a series on its master: every plain occurrence carries the block, the moved one survives', async () => {
    const t = target(W, 'weekly@test', true)
    const r0 = await read(t)
    expect(r0).toMatchObject({ ok: true, description: 'Standing 1:1.', writable: true })
    const n = agent.snapshots().length
    const next = upsertInviteBlock(
      'Standing 1:1.',
      renderInviteBlock({ appLink: 'kacola://meeting/weekly%40test' }),
    )
    expect(await write(t, 'Standing 1:1.', next)).toMatchObject({ ok: true, changed: true })
    const comps = await eds.getEvent(W, 'weekly@test')
    expect(comps).toHaveLength(2)
    expect(comps.find((c) => c.recurrenceId === null)!.description).toBe(next)
    const moved = comps.find((c) => c.recurrenceId !== null)!
    expect(moved).toMatchObject({
      summary: 'Weekly 1:1 (moved)',
      description: 'Standing 1:1 — moved to Tuesday.',
    })
    const snap = await agent.nextSnapshot(n, (s) =>
      s.occurrences.some((o) => o.uid === 'weekly@test' && o.description === next),
    )
    const occ = snap.occurrences.filter((o) => o.uid === 'weekly@test')
    expect(occ.map((o) => o.start)).toEqual([
      '2026-10-05T09:00:00.000Z',
      '2026-10-13T09:00:00.000Z',
      '2026-10-19T09:00:00.000Z',
    ])
    expect(occ.map((o) => o.description)).toEqual([next, 'Standing 1:1 — moved to Tuesday.', next])
  })

  it("refuses someone else's invitation, and leaves it untouched", async () => {
    const r = await read(target(W, 'theirs@test'))
    expect(r).toMatchObject({ ok: true, writable: false, description: 'The boss wrote this.' })
    expect((r as { reason: string }).reason).toMatch(/not the organiser.*boss@example\.com/)
    const w = await write(target(W, 'theirs@test'), 'The boss wrote this.', 'The boss wrote this.\n\nmine')
    expect(w).toMatchObject({ ok: false, changed: false })
    expect((await master(W, 'theirs@test')).description).toBe('The boss wrote this.')
  })

  it('refuses a read-only calendar', async () => {
    const r = await read(target(RO, 'ro@test'))
    expect(r).toMatchObject({ ok: true, writable: false })
    expect((r as { reason: string }).reason).toMatch(/read-only/)
    expect(await write(target(RO, 'ro@test'), 'Someone else’s feed.', 'x')).toMatchObject({ ok: false })
    expect((await master(RO, 'ro@test')).description).toBe('Someone else’s feed.')
  })

  it('answers errors as replies, never crashing: unknown calendar, unknown event', async () => {
    expect(await read(target('nope', 'x@test'))).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/not connected/),
    })
    expect(await read(target(W, 'missing@test'))).toMatchObject({ ok: false })
    expect(await write(target(W, 'missing@test'), '', 'x')).toMatchObject({ ok: false, changed: false })
    expect(agent.child.exitCode).toBeNull()
    expect(agent.invalid).toEqual([])
  })
})

describe('EdsCalendarProvider.editDescription against the same EDS', () => {
  let provider: EdsCalendarProvider
  beforeAll(async () => {
    provider = new EdsCalendarProvider({ logger: new Logger(), env: eds.env, agentPath: AGENT })
    let ok!: () => void
    const ready = new Promise<void>((r) => {
      ok = r
    })
    provider.start({
      snapshot: (s) => {
        if ([W, RO].every((id) => s.calendars.some((c) => c.id === id))) ok()
      },
      status: () => {},
    })
    provider.setWindow(new Date(WINDOW.from), new Date(WINDOW.to))
    await ready
  }, 60_000)
  afterAll(async () => {
    await provider?.stop()
  })

  const t = (sourceUid: string, uid: string, recurring = false) => ({
    sourceUid,
    uid,
    recurrenceId: null,
    recurring,
  })

  it('writes, is idempotent, updates in place', async () => {
    const block = renderInviteBlock({ appLink: 'kacola://agenda/agd_p' })
    expect(await provider.editDescription(t(W, 'noorg@test'), (d) => upsertInviteBlock(d, block))).toEqual({
      ok: true,
      changed: true,
    })
    expect((await master(W, 'noorg@test')).description).toBe(block)
    expect(await provider.editDescription(t(W, 'noorg@test'), (d) => upsertInviteBlock(d, block))).toEqual({
      ok: true,
      changed: false,
    })
    const b2 = renderInviteBlock({ appLink: 'kacola://agenda/agd_q', webLink: 'https://w/a/agd_q' })
    expect(await provider.editDescription(t(W, 'noorg@test'), (d) => upsertInviteBlock(d, b2))).toEqual({
      ok: true,
      changed: true,
    })
    expect((await master(W, 'noorg@test')).description).toBe(b2)
  })

  it('maps refusals to a reason the user can act on', async () => {
    const theirs = await provider.editDescription(t(W, 'theirs@test'), (d) => `${d}\nx`)
    expect(theirs).toMatchObject({ ok: false, reason: expect.stringMatching(/not the organiser/) })
    const ro = await provider.editDescription(t(RO, 'ro@test'), (d) => `${d}\nx`)
    expect(ro).toMatchObject({ ok: false, reason: expect.stringMatching(/read-only/) })
    expect((await master(W, 'theirs@test')).description).toBe('The boss wrote this.')
  })

  it('refuses cleanly when the helper is not running', async () => {
    const idle = new EdsCalendarProvider({ logger: new Logger(), env: eds.env, agentPath: AGENT })
    expect(await idle.editDescription(t(W, 'owned@test'), (d) => d)).toEqual({
      ok: false,
      reason: 'the calendar helper is not running',
    })
  })
})
