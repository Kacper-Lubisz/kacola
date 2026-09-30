// End to end: the real daemon, a pipeline replaying the manager-1on1 agenda fixture (its ground-truth
// utterances, 10× speed), the on-device decision provider, a calendar meeting ending soon, an earlier
// recording that mentions Priya — and a scripted text LLM for bridge lines and the recap. The agenda gets
// items checked with evidence from this recording, next-point / looks-covered / not-covered suggestions,
// a context card, and a recap per item when the recording stops; the log keeps every invariant.
// Plus the recap's failure modes (no LLM, refusal, errors) through the hook itself.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AGENDA_RECAP_SYSTEM_PROMPT, BRIDGE_SYSTEM_PROMPT, LlmError, type LlmProvider } from '@gnomeola/llm'
import { type AnyEvent, createClient, type TrackerStatus } from '@gnomeola/protocol'
import { AgendaStore, Store } from '@gnomeola/store'
import { waitFor } from '@gnomeola/testkit/daemon'
import { loadAgendaFixture } from '@gnomeola/testkit/fixtures'
import { assertNoViolations, checkAgendaLog, checkEventLog } from '@gnomeola/testkit/invariants'
import { describe, expect, it } from 'vitest'
import { agendaRecapHook } from '../src/agendas/recap.ts'
import { ManualCalendarProvider } from '../src/calendar/providers.ts'
import { createDaemon } from '../src/daemon.ts'
import { ScriptedPipeline } from '../src/fakes/scripted-pipeline.ts'
import { MemoryKeyring } from '../src/keyring.ts'
import { Logger } from '../src/logger.ts'
import { at, occ } from './calendar-helpers.ts'

type Reply = string | 'refuse' | 'throw'

/** A text LLM that answers recaps and bridge lines from a script, recording what it was asked. */
function scriptedLlm(
  recap: (item: string) => Reply = (item) =>
    `Status: covered\nOutcome: Settled: ${item}.\nDecisions:\n- go ahead with ${item}\nActions:\n- Sam: follow up on ${item}`,
) {
  const asked: { system: string; tail: string }[] = []
  const llm: LlmProvider = {
    id: 'scripted',
    model: 'scripted-1',
    minCacheTokens: Number.POSITIVE_INFINITY,
    async *stream(prompt) {
      const tail = prompt.blocks.at(-1)!.text
      asked.push({ system: prompt.system, tail })
      const usage = { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 }
      if (prompt.system === BRIDGE_SYSTEM_PROMPT) {
        yield { type: 'delta', text: 'Shall we move on to the next point?' }
        yield {
          type: 'done',
          stopReason: 'end_turn',
          model: 'scripted-1',
          usage,
          refusal: null,
          fallback: null,
        }
        return
      }
      expect(prompt.system).toBe(AGENDA_RECAP_SYSTEM_PROMPT)
      const item = /<item kind="[^"]*">([^<]*)<\/item>/.exec(tail)![1]!
      const r = recap(item)
      if (r === 'throw') throw new LlmError('overloaded', 'simulated overload')
      if (r === 'refuse') {
        yield {
          type: 'done',
          stopReason: 'refusal',
          model: 'scripted-1',
          usage,
          refusal: { category: null, explanation: null },
          fallback: null,
        }
        return
      }
      yield { type: 'delta', text: r }
      yield {
        type: 'done',
        stopReason: 'end_turn',
        model: 'scripted-1',
        usage,
        refusal: null,
        fallback: null,
      }
    },
  }
  return { llm, asked }
}

describe('the tracker in the real daemon, replaying an agenda fixture', () => {
  it('checks items off with evidence, suggests, adds context, and writes the recap when the recording stops', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gnomeola-tracker-'))
    const fx = loadAgendaFixture('manager-1on1')
    const truth = fx.truth
    const cal = new ManualCalendarProvider()
    const { llm, asked } = scriptedLlm()
    const daemon = await createDaemon({
      dataDir: dir,
      port: 0,
      pipeline: new ScriptedPipeline(truth.utterances, { speed: 10 }),
      keyring: new MemoryKeyring(),
      env: {},
      calendar: cal,
      agendaLlm: async () => llm,
      tracker: { heartbeatMs: 1_000, nextPointEveryMs: 2_000, contextEveryMs: 60_000 },
    })
    const events: AnyEvent[] = []
    daemon.bus.subscribe((e) => events.push(e))
    try {
      const c = createClient({ baseUrl: daemon.url, timeoutMs: 10_000 })
      // an earlier meeting that mentions Priya (context from past meetings)
      const old = daemon.store.createSession({ title: 'Team planning' })
      daemon.store.upsertSegment({
        id: 'old-1',
        sessionId: old.id,
        track: 'system',
        speaker: 'Dana',
        startMs: 0,
        endMs: 3000,
        text: 'Priya asked to take over an ops job next quarter.',
        quality: 'final',
        confidence: null,
      })
      daemon.store.updateSession(old.id, (s) => ({
        ...s,
        status: 'stopped',
        startedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      }))
      const now = Date.now()
      // the meeting ends in 4 min: inside the T-5 window from the start
      cal.push({
        calendars: [{ id: 'cal-work', name: 'Work' }],
        occurrences: [
          occ({ uid: 'one-on-one@x', summary: '1:1 Dana / Sam', start: at(now, -1), end: at(now, 4) }),
        ],
      })
      cal.state('ok')
      const { meetings } = await c.call('listMeetings', { query: { from: at(now, -60), to: at(now, 60) } })
      const agenda = await c.call('createAgenda', {
        body: {
          meetingId: meetings[0]!.id,
          items: truth.agenda!.items.map((it) => ({ text: it.text, kind: it.kind })),
        },
      })
      const byText = new Map(truth.agenda!.items.map((it) => [it.text, it]))
      const { session } = await c.call('joinMeeting', { params: { id: meetings[0]!.id }, body: {} })
      await waitFor(
        async () =>
          (await c.call('getAgenda', { params: { id: agenda.agenda.id } })).agenda.sessionId === session.id,
        5_000,
        'agenda linked',
      )
      await waitFor(
        async () =>
          (await c.call('getAgendaTracker', { params: { id: agenda.agenda.id } })).tracker?.state ===
          'running',
        5_000,
        'tracker running',
      )
      // the whole meeting is replayed (137 s at 10× ≈ 14 s)
      await waitFor(
        async () => daemon.store.segments(session.id).length === truth.utterances.length,
        30_000,
        'every utterance closed',
      )
      await daemon.tracker!.idle(session.id)
      const live = await c.call('getAgenda', { params: { id: agenda.agenda.id } })
      await c.call('stopSession', { params: { id: session.id } })
      await waitFor(
        async () =>
          (await c.call('getAgendaTracker', { params: { id: agenda.agenda.id } })).tracker?.recap.state ===
          'done',
        20_000,
        'the recap',
      )

      // --- during the meeting: checked items carry evidence from THIS recording, by the tracker
      const segIds = new Set(daemon.store.segments(session.id).map((s) => s.id))
      const checked = live.items.filter((i) => i.status === 'covered' && i.changedBy === 'tracker')
      expect(checked.length).toBeGreaterThan(0)
      for (const i of checked) {
        expect(i.evidence.length).toBeGreaterThan(0)
        expect(i.evidence.every((e) => e.segmentId && segIds.has(e.segmentId))).toBe(true)
      }
      const history = (await c.call('getAgendaHistory', { params: { id: agenda.agenda.id } })).changes
      expect(history.some((h) => h.by === 'tracker' && h.auto && h.to === 'covered')).toBe(true)
      // what the eval grades, in the real daemon: how many auto check-offs were right
      const right = checked.filter((i) => byText.get(i.text)?.expected.status === 'covered')
      console.log(
        `[tracker e2e] auto-covered ${checked.length}/${live.items.length} items, ${right.length} correct: ${checked.map((i) => i.text).join(' | ')}`,
      )

      // --- suggestions: one next talking point at a time (the LLM's bridge line), and the T-5 nudge
      const sugs = live.suggestions
      const nextPoints = sugs.filter((s) => s.kind === 'next-point')
      expect(nextPoints.length).toBeGreaterThan(0)
      expect(nextPoints.filter((s) => s.state === 'open').length).toBeLessThanOrEqual(1)
      expect(
        nextPoints.every((s) => s.source === 'tracker' && s.text === 'Shall we move on to the next point?'),
      ).toBe(true)
      expect(nextPoints.filter((s) => s.state === 'dismissed').every((s) => s.resolvedBy === 'tracker')).toBe(
        true,
      )
      const missed = sugs.filter((s) => s.kind === 'missed')
      expect(missed).toHaveLength(1)
      expect(missed[0]!.text).toMatch(/^Not covered yet, \d+ min left: /)

      // --- context from the earlier meeting
      expect(
        live.context.some(
          (card) =>
            card.createdBy === 'tracker' && card.source.ref === old.id && card.visibility === 'private',
        ),
      ).toBe(true)

      // --- the recap: one LLM call per item (transcript as the stable prefix), stored as outcomes
      const after = await c.call('getAgenda', { params: { id: agenda.agenda.id } })
      const recapCalls = asked.filter((a) => a.system === AGENDA_RECAP_SYSTEM_PROMPT)
      expect(recapCalls).toHaveLength(after.items.length)
      for (const i of after.items) {
        expect(i.outcome).toContain(`Settled: ${i.text}.`)
        expect(i.outcome).toContain(`- Sam: follow up on ${i.text}`)
        expect(i.changedBy).toBe('tracker')
      }
      // the recap says "covered" for items still open → looks-covered suggestions, never a status move
      const stillOpen = live.items.filter((i) => i.status === 'open' || i.status === 'in-progress')
      for (const i of stillOpen)
        expect(
          after.suggestions.some(
            (s) => s.kind === 'looks-covered' && s.itemId === i.id && s.text.startsWith('Recap:'),
          ),
        ).toBe(true)
      expect(after.items.map((i) => i.status)).toEqual(live.items.map((i) => i.status))

      const st = (await c.call('getAgendaTracker', { params: { id: agenda.agenda.id } })).tracker!
      expect(st).toMatchObject({
        state: 'stopped',
        provider: 'local',
        errors: 0,
        dropped: 0,
        recap: { state: 'done', items: after.items.length },
      })
      expect(st.segments).toBe(truth.utterances.length)
      expect(st.relevant).toBeGreaterThan(0)
      expect(st.relevant).toBeLessThan(st.segments)
      const statusEvents = events.flatMap((e) =>
        e.data.type === 'agenda.tracker' ? [e.data.status as TrackerStatus] : [],
      )
      expect(statusEvents.at(-1)).toMatchObject({ state: 'stopped', recap: { state: 'done' } })
      console.log(
        `[tracker e2e] ${st.segments} segments, ${st.relevant} relevant, ${st.rounds} rounds, ${st.decisionCalls} decision calls, ${nextPoints.length} next-point cards`,
      )

      const log = daemon.store.eventsAfter(0)
      assertNoViolations(checkEventLog(log))
      assertNoViolations(checkAgendaLog(log))
      const copy = Store.open(':memory:')
      copy.replay(log)
      expect(copy.dump()).toBe(daemon.store.dump())
      copy.close()
    } finally {
      await daemon.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('the recap hook', () => {
  function rig(llm: LlmProvider | null) {
    const store = Store.open(':memory:')
    const agendas = new AgendaStore(store)
    const session = store.createSession({ title: 's' })
    store.upsertSegment({
      id: 's1',
      sessionId: session.id,
      track: 'system',
      speaker: 'Ana',
      startMs: 0,
      endMs: 1000,
      text: 'We agreed the budget.',
      quality: 'final',
      confidence: null,
    })
    const view = agendas.create({
      title: 'a',
      items: [{ text: 'Budget' }, { text: 'Hiring' }, { text: 'Offsite' }],
    })
    const hook = agendaRecapHook({
      store,
      agendas,
      tracker: null,
      logger: new Logger({ minLevel: 'error' }),
      llm: async () => ({ provider: llm, reason: llm ? null : 'the LLM is switched off in settings' }),
    })
    return {
      store,
      agendas,
      view,
      run: () => hook({ agenda: agendas.view(view.agenda.id)!, session: store.getSession(session.id)! }),
    }
  }

  it('no LLM: nothing is written', async () => {
    const r = rig(null)
    await r.run()
    expect(r.agendas.items(r.view.agenda.id).every((i) => i.outcome === null)).toBe(true)
  })

  it("a refusal or a failure leaves that item as it was; the user's own outcome is never replaced", async () => {
    const { llm, asked } = scriptedLlm((item) =>
      item === 'Hiring' ? 'refuse' : item === 'Offsite' ? 'throw' : `Status: covered\nOutcome: ok ${item}`,
    )
    const r = rig(llm)
    const budget = r.agendas.items(r.view.agenda.id)[0]!
    await r.run()
    const [b, h, o] = r.agendas.items(r.view.agenda.id)
    expect(b!.outcome).toBe('ok Budget')
    expect(h!.outcome).toBeNull()
    expect(o!.outcome).toBeNull()
    expect(asked).toHaveLength(3)
    // the user edits the outcome; a second recap leaves it alone
    r.agendas.updateItem(r.view.agenda.id, budget.id, { outcome: 'my words' }, 'user')
    await r.run()
    expect(r.agendas.items(r.view.agenda.id)[0]!.outcome).toBe('my words')
  })
})
