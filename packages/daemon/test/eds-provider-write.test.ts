import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderInviteBlock, upsertInviteBlock } from '@gnomeola/protocol'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { EdsCalendarProvider } from '../src/calendar/providers.ts'
import { Logger } from '../src/logger.ts'

// Agendas, deliverable 6: EdsCalendarProvider.editDescription's request/response plumbing against a
// scripted stand-in for cal-agent (the real one is exercised in cal-agent-write.e2e.test.ts): the
// compare-and-swap retry, refusals, a helper that never answers, and one that dies mid-request.

const dir = mkdtempSync(join(tmpdir(), 'gnomeola-fake-cal-agent-'))
const FAKE = join(dir, 'fake-gjs')
writeFileSync(
  FAKE,
  `#!${process.execPath}
import { createInterface } from 'node:readline'
const mode = process.env.FAKE_MODE
let desc = 'Organiser text.'
let writes = 0
const send = (m) => process.stdout.write(JSON.stringify(m) + '\\n')
send({ type: 'hello', protocol: 2 })
createInterface({ input: process.stdin }).on('line', (line) => {
  const m = JSON.parse(line)
  if (m.type === 'window') send({ type: 'snapshot', from: m.from, to: m.to, calendars: [], occurrences: [] })
  if (m.type === 'read-description') {
    if (mode === 'silent') return
    if (mode === 'exit') process.exit(3)
    const writable = mode !== 'readonly'
    send({ type: 'description', requestId: m.requestId, ok: true, description: desc, writable,
      reason: writable ? null : 'the calendar "Feed" is read-only' })
  }
  if (m.type === 'write-description') {
    writes++
    const conflict = (mode === 'conflict-once' && writes === 1) || mode === 'conflict-always' || m.expect !== desc
    if (conflict) {
      desc = 'Organiser text, edited meanwhile.'
      send({ type: 'description-written', requestId: m.requestId, ok: false, changed: false,
        reason: 'the description changed meanwhile', conflict: true })
      return
    }
    const changed = desc !== m.description
    desc = m.description
    send({ type: 'log', level: 'info', message: 'now: ' + JSON.stringify(desc) })
    send({ type: 'description-written', requestId: m.requestId, ok: true, changed, reason: null })
  }
})
`,
)
chmodSync(FAKE, 0o755)

const open: EdsCalendarProvider[] = []
afterEach(async () => {
  await Promise.all(open.splice(0).map((p) => p.stop()))
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

async function provider(mode: string, requestTimeoutMs = 2000) {
  const logger = new Logger()
  const p = new EdsCalendarProvider({
    logger,
    gjs: FAKE,
    env: { ...process.env, FAKE_MODE: mode },
    requestTimeoutMs,
    minBackoffMs: 60_000,
  })
  open.push(p)
  await new Promise<void>((ready) => {
    p.start({ snapshot: () => ready(), status: () => {} })
    p.setWindow(new Date('2026-10-01T00:00:00Z'), new Date('2026-10-02T00:00:00Z'))
  })
  return { p, logger }
}

const t = { sourceUid: 'cal', uid: 'e@test', recurrenceId: null, recurring: false }
const block = renderInviteBlock({ appLink: 'kacola://agenda/agd_x' })
const lastWrite = (logger: Logger) =>
  logger
    .tail(50)
    .filter((l) => l.includes('cal-agent: now:'))
    .at(-1)

describe('EdsCalendarProvider.editDescription', () => {
  it('reads, computes, writes; the same edit again writes nothing', async () => {
    const { p, logger } = await provider('ok')
    expect(await p.editDescription(t, (d) => upsertInviteBlock(d, block))).toEqual({
      ok: true,
      changed: true,
    })
    expect(lastWrite(logger)).toContain(
      JSON.stringify(JSON.stringify(`Organiser text.\n\n${block}`)).slice(1, -1),
    )
    expect(await p.editDescription(t, (d) => upsertInviteBlock(d, block))).toEqual({
      ok: true,
      changed: false,
    })
  })

  it('re-reads and retries once when the description changed between read and write', async () => {
    const { p, logger } = await provider('conflict-once')
    const seen: string[] = []
    expect(
      await p.editDescription(t, (d) => {
        seen.push(d)
        return upsertInviteBlock(d, block)
      }),
    ).toEqual({ ok: true, changed: true })
    // the second attempt was computed from the NEW text: the concurrent edit is kept
    expect(seen).toEqual(['Organiser text.', 'Organiser text, edited meanwhile.'])
    expect(lastWrite(logger)).toContain('edited meanwhile.')
  })

  it('gives up after a second conflict instead of looping', async () => {
    const { p } = await provider('conflict-always')
    const r = await p.editDescription(t, (d) => upsertInviteBlock(d, block))
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/kept changing/) })
  })

  it('passes a read-only refusal through with its reason, without writing', async () => {
    const { p, logger } = await provider('readonly')
    let edited = false
    const r = await p.editDescription(t, (d) => {
      edited = true
      return d
    })
    expect(r).toEqual({ ok: false, reason: 'the calendar "Feed" is read-only' })
    expect(edited).toBe(false)
    expect(lastWrite(logger)).toBeUndefined()
  })

  it('times out a helper that never answers', async () => {
    const { p } = await provider('silent', 300)
    expect(await p.editDescription(t, (d) => d)).toEqual({
      ok: false,
      reason: 'the calendar helper did not answer',
    })
  })

  it('fails a pending request when the helper exits', async () => {
    const { p } = await provider('exit', 5000)
    const t0 = Date.now()
    expect(await p.editDescription(t, (d) => d)).toEqual({ ok: false, reason: 'the calendar helper exited' })
    expect(Date.now() - t0).toBeLessThan(4000)
  })
})
