import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AnyEvent, type DurableEvent, isDurable, LiveEvent } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import {
  assertNoViolations,
  checkAgendaLog,
  checkAgentLog,
  checkEventLog,
} from '@gnomeola/testkit/invariants'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type CliResult, gnomeola } from '../src/cli.ts'

// The BYO agent channel end to end: the REAL daemon replays a fixture meeting (the fake pipeline speaking
// testkit's agenda/hostile-planning script), and scripted fake agents — one per mode — follow it with
// `gnomeola live attach` and write back through the agent verbs, exactly as Claude would under the
// Monitor tool. Asserted: the stream (typed lines, speakers, meeting.ended, exit 0), mode enforcement,
// attribution bound to the lease, suggestions the user accepts, undo, lease expiry (re-granted by attach),
// revoke (exit 7), `live wait`, goldens and exit codes; then the log's invariants.

const FIXTURE = join(
  import.meta.dirname,
  '..',
  '..',
  'testkit',
  'fixtures',
  'agenda',
  'hostile-planning',
  'truth.json',
)
const box = mkdtempSync(join(tmpdir(), 'gnomeola-e2e-live-'))
const calFile = join(box, 'calendar.json')
const leaseDir = join(box, 'leases')
let d: DaemonHandle
const env = { GNOMEOLA_LEASE_DIR: leaseDir }
const now = Date.now()
const t = (min: number) => new Date(now + min * 60_000).toISOString()

const PLAN = `# Invoicing v2 launch planning

## Items
- [ ] Launch date for invoicing v2 [decision]
- [ ] Rollout plan: feature flag and regions [decision]
- [ ] Who writes the customer announcement [decision]
- [ ] Top launch risks [must-cover]
`

beforeAll(async () => {
  writeFileSync(
    calFile,
    JSON.stringify({
      calendars: [{ id: 'cal-work', name: 'Work' }],
      occurrences: [
        {
          sourceUid: 'cal-work',
          calendarName: 'Work',
          uid: 'invoicing@x',
          recurrenceId: null,
          summary: 'Invoicing v2 launch planning',
          description: '',
          location: '',
          url: '',
          start: t(-2),
          end: t(30),
          allDay: false,
          startDate: null,
          endDate: null,
          timezone: null,
          status: 'CONFIRMED',
          myPartstat: null,
          organizer: 'mailto:me@example.com',
          attendees: 3,
          recurring: false,
          xprops: {},
        },
      ],
    }),
  )
  d = await startDaemon({
    env: {
      GNOMEOLA_CALENDAR: `file:${calFile}`,
      // ~115 s of meeting in ~5 s
      GNOMEOLA_FAKE_PIPELINE: JSON.stringify({
        scriptFile: FIXTURE,
        speed: 25,
        partialEveryMs: 1500,
        finalizeAfterMs: 40,
      }),
      GNOMEOLA_LIVE_PARTIAL_MS: '200',
      // the meeting runs 25× fast, so its suggestions come 25× faster than any real cadence: a bigger burst
      GNOMEOLA_AGENT_LIMITS: JSON.stringify({
        sweepMs: 100,
        heartbeatTimeoutMs: 4_000,
        suggestions: { burst: 6, perMinute: 2 },
      }),
    },
  })
  await waitFor(
    async () => (await d.client.call('nextMeeting')).current !== null,
    10_000,
    'the calendar file',
  )
}, 60_000)
afterAll(async () => {
  await d?.stop()
  rmSync(box, { recursive: true, force: true })
})

const golden = (name: string) => join(import.meta.dirname, '__golden__', `${name}.json`)
/** Stable across runs: ids become <kind:n> in order of appearance, instants <iso>. */
function stable(out: string): string {
  const seen = new Map<string, string>()
  const counts = new Map<string, number>()
  const id = (v: string) =>
    v.replace(/\b(agd|itm|ctx|sug|ses|mtg|lse|seg)_[0-9A-Za-z_-]{12,}/g, (m, kind: string) => {
      if (!seen.has(m)) {
        const n = (counts.get(kind) ?? 0) + 1
        counts.set(kind, n)
        seen.set(m, `<${kind}:${n}>`)
      }
      return seen.get(m)!
    })
  const value = JSON.parse(out, (_k, v) => {
    if (typeof v !== 'string') return v
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return '<iso>'
    return id(v)
  })
  return `${JSON.stringify(value, null, 2)}\n`
}

const cli = (argv: string[], extra: Record<string, string> = {}) =>
  gnomeola(argv, d.baseUrl, { env: { ...env, ...extra } })

/**
 * A scripted fake agent: `live attach` in the background, reacting to its lines with agent verbs.
 * `react` gets each segment (once per segment id) and returns the CLI calls to make.
 */
class FakeAgent {
  readonly lines: LiveEvent[] = []
  readonly calls: { argv: string[]; r: CliResult }[] = []
  readonly done: Promise<CliResult>
  private buf = ''
  private readonly seen = new Set<string>()
  private readonly pending: Promise<unknown>[] = []
  private readonly ac = new AbortController()
  readonly name: string

  constructor(
    name: string,
    mode: 'observe' | 'suggest' | 'act',
    react: (e: Extract<LiveEvent, { type: 'segment.final' }>) => string[][] = () => [],
    extraArgs: string[] = ['--heartbeat', '1s'],
  ) {
    this.name = name
    this.done = gnomeola(['live', 'attach', '--as', name, '--mode', mode, ...extraArgs], d.baseUrl, {
      env,
      signal: this.ac.signal,
      onStdout: (s) => {
        this.buf += s
        let nl = this.buf.indexOf('\n')
        while (nl !== -1) {
          const e = LiveEvent.parse(JSON.parse(this.buf.slice(0, nl)))
          this.buf = this.buf.slice(nl + 1)
          this.lines.push(e)
          if (e.type === 'segment.final' && !this.seen.has(e.segmentId)) {
            this.seen.add(e.segmentId)
            for (const argv of react(e))
              this.pending.push(cli([...argv, '--as', name]).then((r) => this.calls.push({ argv, r })))
          }
          nl = this.buf.indexOf('\n')
        }
      },
    })
  }

  segments() {
    return this.lines.filter(
      (e): e is Extract<LiveEvent, { type: 'segment.final' }> => e.type === 'segment.final',
    )
  }
  async settled() {
    await Promise.all(this.pending)
  }
  stop() {
    this.ac.abort()
  }
  call(re: RegExp) {
    return this.calls.find((c) => re.test(c.argv.join(' ')))
  }
}

/** The fixture's settlement lines (truth.json: `settledBy`), as a careful agent would recognise them. */
const checkoffs = (e: { segmentId: string; text: string }): string[][] => {
  const out: string[][] = []
  if (/release calendar/.test(e.text))
    out.push([
      'agenda',
      'status',
      'live',
      'Launch date',
      'covered',
      '--segment',
      e.segmentId,
      '--outcome',
      'Tuesday the 14th',
    ])
  if (/own the flag and the kill switch/.test(e.text))
    out.push(['agenda', 'status', 'live', 'Rollout plan', 'covered', '--segment', e.segmentId])
  if (/customer announcement\. Who writes it/.test(e.text))
    out.push(['agenda', 'status', 'live', 'announcement', 'in-progress', '--segment', e.segmentId])
  return out
}

describe('live agents on a replayed meeting', () => {
  let agendaId = ''
  let sessionId = ''
  let watcher: FakeAgent
  let helper: FakeAgent
  let doer: FakeAgent

  it('attach before a recording is a not-found (exit 4); bad flags are usage (exit 2)', async () => {
    const r = await cli(['live', 'attach'])
    expect(r.code).toBe(4)
    expect(r.stderr).toMatch(/no recording is in progress[\s\S]*live wait/)
    expect((await cli(['live', 'attach', '--mode', 'god'])).code).toBe(2)
    expect((await cli(['live', 'nope'])).code).toBe(2)
    expect((await cli(['live', 'wait', '--timeout', '1s'])).code).toBe(4)
  })

  it('live wait returns the recording as it starts; three agents attach (observe, suggest, act)', async () => {
    const plan = await gnomeola(['agenda', 'create', '--meeting', 'next', '--stdin'], d.baseUrl, {
      stdin: PLAN,
      env,
    })
    expect(plan.code, plan.stderr).toBe(0)
    agendaId = JSON.parse(plan.stdout).agenda.id
    const waiting = cli(['live', 'wait', '--meeting', 'next', '--timeout', '20s'])
    await new Promise((r) => setTimeout(r, 300))
    const { current } = await d.client.call('nextMeeting')
    const joined = await d.client.call('joinMeeting', { params: { id: current!.id }, body: {} })
    sessionId = joined.session.id
    const w = await waiting
    expect(w.code, w.stderr).toBe(0)
    expect(JSON.parse(w.stdout).session).toMatchObject({
      sessionId,
      agendaId,
      meeting: { uid: 'invoicing@x' },
    })
    await expect(stable(w.stdout)).toMatchFileSnapshot(golden('live-wait'))

    watcher = new FakeAgent('watcher', 'observe', checkoffs)
    helper = new FakeAgent('helper', 'suggest', (e) => [
      ...checkoffs(e),
      ...(/Top launch risks|over time/.test(e.text)
        ? [['suggest', 'Top launch risks has not come up yet', '--kind', 'missed', '--item', 'risks']]
        : []),
    ])
    doer = new FakeAgent('doer', 'act', checkoffs)
  })

  it('streams the meeting to every agent; each writes within its mode', async () => {
    // the fixture's last line, then everyone's reactions
    await waitFor(
      () => [watcher, helper, doer].every((a) => a.segments().some((s) => /Bye\./.test(s.text))),
      30_000,
      'the whole meeting',
    )
    await Promise.all([watcher, helper, doer].map((a) => a.settled()))

    const first = watcher.lines[0]!
    expect(first).toMatchObject({
      type: 'attached',
      lease: { name: 'watcher', mode: 'observe', sessionId },
      agenda: { agenda: { id: agendaId } },
    })
    const speakers = new Set(watcher.segments().map((s) => s.speaker))
    expect(speakers).toEqual(new Set(['me', 'Priya', 'Tom']))
    expect(watcher.segments().filter((s) => s.revision === 1)).toHaveLength(28) // every utterance once
    expect(watcher.lines.some((e) => e.type === 'partial')).toBe(true)
    expect(watcher.lines.some((e) => e.type === 'agenda.updated')).toBe(true)
    expect(watcher.lines.some((e) => e.type === 'agent.presence' && e.name === 'doer')).toBe(true)
    // the default guard marks nothing (the decisions wave plugs a classifier in)
    expect(watcher.segments().every((s) => s.flags.length === 0)).toBe(true)

    // observe: every write refused (exit 5), nothing changed by it
    expect(watcher.calls.length).toBe(3)
    for (const c of watcher.calls) {
      expect(c.r.code, c.r.stderr).toBe(5)
      expect(c.r.stderr).toMatch(/observe mode/)
    }

    // suggest: the changes wait for the user, as suggestions carrying the proposal
    const sug = helper.call(/Launch date/)!
    expect(sug.r.code, sug.r.stderr).toBe(0)
    const sj = JSON.parse(sug.r.stdout)
    expect(sj.change).toBeNull()
    expect(sj.suggested).toMatchObject({ kind: 'set-status', source: 'agent:helper' })
    // (the item's own status races the act-mode agent's check-off: not part of the golden)
    const racy = { ...sj, item: { ...sj.item, status: '<either>', outcome: '<either>' } }
    await expect(stable(JSON.stringify(racy))).toMatchFileSnapshot(golden('live-status-suggested'))
    const missed = helper.call(/^suggest/)!
    expect(missed.r.code, missed.r.stderr).toBe(0)
    await expect(stable(missed.r.stdout)).toMatchFileSnapshot(golden('agenda-suggest'))
    expect(JSON.parse(missed.r.stdout).suggestion.source).toBe('agent:helper')

    // act: applied as the agent, with the segment as evidence
    const act = doer.call(/Launch date/)!
    expect(act.r.code, act.r.stderr).toBe(0)
    expect(JSON.parse(act.r.stdout).change).toMatchObject({ from: 'open', to: 'covered', by: 'agent:doer' })
    await expect(stable(act.r.stdout)).toMatchFileSnapshot(golden('live-status-applied'))
    const v = await d.client.call('getAgenda', { params: { id: agendaId } })
    const byText = (s: string) => v.items.find((i) => i.text.startsWith(s))!
    expect(byText('Launch date')).toMatchObject({
      status: 'covered',
      changedBy: 'agent:doer',
      outcome: 'Tuesday the 14th',
    })
    expect(byText('Launch date').evidence[0]!.quote).toMatch(/release calendar/)
    expect(byText('Rollout plan')).toMatchObject({ status: 'covered', changedBy: 'agent:doer' })
    expect(byText('Who writes')).toMatchObject({ status: 'in-progress' })
    expect(byText('Top launch risks')).toMatchObject({ status: 'open' })
    // the helper's proposals (set-status for the items the doer already moved are still offered)
    const open = v.suggestions.filter((s) => s.source === 'agent:helper' && s.state === 'open')
    expect(open.map((s) => s.kind).sort()).toEqual(['missed', 'set-status', 'set-status', 'set-status'])
  })

  it('the user accepts a suggestion, and undoes an agent change; then the agent cannot redo it', async () => {
    const v = await d.client.call('getAgenda', { params: { id: agendaId } })
    const risks = v.items.find((i) => i.text.startsWith('Who writes'))!
    // the user moves the announcement item back to open (undo of the doer's in-progress)
    const undo = await cli(['agenda', 'status', agendaId, 'Who writes', 'open'], { GNOMEOLA_LEASE: 'none' })
    expect(undo.code, undo.stderr).toBe(0)
    expect(JSON.parse(undo.stdout).change).toMatchObject({
      by: 'user',
      override: true,
      from: 'in-progress',
      to: 'open',
    })
    const redo = await cli(['agenda', 'status', 'live', 'Who writes', 'in-progress', '--as', 'doer'])
    expect(redo.code).toBe(1)
    expect(redo.stderr).toMatch(/manual wins/)
    // accepting the helper's "covered" proposal for the launch date: already covered, recorded as the user's
    const prop = v.suggestions.find((s) => s.kind === 'set-status' && s.itemId === risks.id)
    if (prop) {
      const acc = await d.client.call('acceptSuggestion', {
        params: { id: agendaId, suggestionId: prop.id },
        body: {},
      })
      expect(acc.suggestion).toMatchObject({ state: 'accepted', resolvedBy: 'user' })
    }
  })

  it('a lease whose heartbeats stop expires; live attach takes a new one and carries on', async () => {
    // heartbeats every 10 min against the daemon's 4 s timeout: the daemon ends the lease as expired,
    // and attach re-grants and resumes from its cursor
    const sleepy = new FakeAgent('sleepy', 'observe', () => [], ['--heartbeat', '600s'])
    await waitFor(() => sleepy.lines.filter((e) => e.type === 'attached').length >= 2, 15_000, 'a re-grant')
    const ended = sleepy.lines.find((e) => e.type === 'lease.ended')
    expect(ended).toMatchObject({ type: 'lease.ended', reason: 'expired' })
    const [a1, a2] = sleepy.lines.filter(
      (e): e is Extract<LiveEvent, { type: 'attached' }> => e.type === 'attached',
    )
    expect(a2!.lease.id).not.toBe(a1!.lease.id)
    expect(a2!.lastSeq).toBeGreaterThanOrEqual(a1!.lastSeq) // resumed from the cursor, not from the start
    // stopped (SIGTERM): the lease is released and the file removed; exit 0
    sleepy.stop()
    const r = await sleepy.done
    expect(r.code, r.stderr).toBe(0)
    expect(existsSync(join(leaseDir, 'lease-sleepy.json'))).toBe(false)
    const all = (
      await d.client.call('listAgentLeases', { params: { id: sessionId }, query: { includeEnded: true } })
    ).leases
    expect(all.filter((l) => l.name === 'sleepy').map((l) => l.endReason)).toEqual(['expired', 'released'])
  })

  it('the window disconnects an agent: its attach ends with exit 7 and its verbs stop working', async () => {
    const victim = new FakeAgent('victim', 'act')
    await waitFor(() => victim.lines.some((e) => e.type === 'attached'), 5_000)
    const lease = (victim.lines[0] as Extract<LiveEvent, { type: 'attached' }>).lease
    await waitFor(
      async () =>
        (await d.client.call('listAgentLeases', { params: { id: sessionId } })).leases.find(
          (l) => l.id === lease.id,
        )?.state === 'connected',
      5_000,
    )
    await d.client.call('releaseAgentLease', { params: { leaseId: lease.id } })
    const r = await victim.done
    expect(r.code).toBe(7)
    expect(r.stderr).toMatch(/the user disconnected this agent/)
    expect(victim.lines.at(-1)).toEqual({ type: 'lease.ended', leaseId: lease.id, reason: 'revoked' })
    expect(existsSync(join(leaseDir, 'lease-victim.json'))).toBe(false)
    const after = await cli(['suggest', 'still here?', '--kind', 'question', '--as', 'victim'])
    expect(after.code).toBe(7)
  })

  it('the leases list the agents and what they did, for the window', async () => {
    const { leases } = await d.client.call('listAgentLeases', { params: { id: sessionId } })
    const doerInfo = leases.find((l) => l.name === 'doer')!
    expect(doerInfo.counts).toMatchObject({ statusChanges: 3 })
    expect(doerInfo.actions.filter((a) => a.outcome === 'applied').length).toBe(3)
    expect(doerInfo.actions.some((a) => a.outcome === 'refused' && /manual wins/.test(a.summary))).toBe(true)
    expect(leases.find((l) => l.name === 'watcher')!.counts.refused).toBe(3)
  })

  it('the meeting ends: every attach prints meeting.ended, exits 0 and removes its lease file', async () => {
    await d.client.call('stopSession', { params: { id: sessionId } })
    for (const a of [watcher, helper, doer]) {
      const r = await a.done
      expect(r.code, `${a.name}: ${r.stderr}`).toBe(0)
      expect(a.lines.at(-1)).toEqual({ type: 'meeting.ended', sessionId })
    }
    expect(readdirSync(leaseDir).filter((n) => n.endsWith('.json'))).toEqual([])
    // no agent verbs without a lease now
    expect((await cli(['suggest', 'late', '--kind', 'question', '--as', 'helper'])).code).toBe(7)
    // the log: gap-free, agenda rules, agent attributions
    const { lastSeq } = await d.client.call('health')
    const log: DurableEvent[] = []
    const ac = new AbortController()
    for await (const msg of d.client.stream('events', {
      query: { since: 0, ephemeral: false },
      signal: ac.signal,
    })) {
      if (!msg.data) continue
      const e = AnyEvent.parse(JSON.parse(msg.data))
      if (isDurable(e)) log.push(e)
      if (log.at(-1)?.seq === lastSeq) break
    }
    ac.abort()
    assertNoViolations(checkEventLog(log), 'event log')
    assertNoViolations(checkAgendaLog(log), 'agenda log')
    assertNoViolations(checkAgentLog(log), 'agent attributions')
  })
})
