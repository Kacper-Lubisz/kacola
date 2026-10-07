import type { AgendaItemInput, DecisionProvider, DecisionResult } from '@kacola/decisions'
import { estimateCostUsd, type LlmProvider, recapItem } from '@kacola/llm'
import type { AgendaItemStatus, Segment, Session } from '@kacola/protocol'
import { AgendaStore, Store } from '@kacola/store'
import { Logger } from '../logger.ts'
import { decisionSpeechGuard } from './speech-guard.ts'
import { AgendaTracker, type RoundObservation, type TrackerOptions } from './tracker.ts'
import { gateSegment, type LiveItem, rankNextPoint, statusRound } from './tracker-logic.ts'

// Agendas wave 2 — the eval runners over the REAL tracker code path (the hooks of @kacola/evals, typed
// structurally here so the daemon does not depend on the eval package):
//
//   trackerStatusRunner   drives an AgendaTracker over an in-memory store: each fixture utterance becomes a
//                         closed segment committed to the store, exactly as the pipeline commits them; the
//                         tracker's clock is the fixture's timeline (session start + the segment's end);
//                         the heartbeat fires every 30 s of fixture time. What the tracker did in each round
//                         (the verdicts it applied) is the report.
//   tracker*Runner        the relevance gate, the speech guard, the next-point ranking and the interview
//                         path, each exactly as the tracker calls it.

type Mode = 'offline' | 'fake' | 'live'
type Usage = { usd: number | null; inputTokens: number; outputTokens: number; calls: number }
type Turn = { speaker: string; text: string }
type Meta = { name: string; provider: string; model: string; mode: Mode }

const quiet = () => new Logger({ minLevel: 'error' })

function usageOf(rs: readonly DecisionResult[]): Usage | undefined {
  if (!rs.length) return undefined
  const u: Usage = { usd: 0, inputTokens: 0, outputTokens: 0, calls: 0 }
  for (const r of rs) {
    u.usd = u.usd === null || r.costUsd === null ? null : u.usd + r.costUsd
    u.inputTokens += r.usage.inputTokens + r.usage.cacheReadTokens
    u.outputTokens += r.usage.outputTokens
    u.calls += r.calls
  }
  return u
}

const meta = (p: DecisionProvider, name: string, mode: Mode): Meta => ({
  name,
  provider: p.id,
  model: p.model,
  mode,
})

export type StatusReportOut = {
  itemId: string
  pCovered: number
  action: 'auto-covered' | 'suggest-covered' | 'in-progress' | 'none'
  evidenceIndex: number | null
  answer?: string | null
}

export function trackerStatusRunner(
  provider: DecisionProvider,
  o: { mode: Mode; name?: string; heartbeatMs?: number; options?: TrackerOptions },
) {
  const beatMs = o.heartbeatMs ?? o.options?.heartbeatMs ?? 30_000
  return {
    ...meta(provider, o.name ?? 'tracker', o.mode),
    start(meeting: { id: string; agenda: AgendaItemInput[]; durationMs: number; scheduledEndMs: number }) {
      const t0 = Date.parse('2026-01-05T10:00:00.000Z')
      let now = t0
      const clock = () => new Date(now)
      const store = Store.open(':memory:', { now: clock })
      const agendas = new AgendaStore(store).withClock(clock)
      const results: DecisionResult[] = []
      const rounds: RoundObservation[] = []
      // the tracker survives provider errors (it degrades); an eval must not: the first error is re-thrown
      // from onSegment, so a live run without quota is skipped with the reason instead of scoring nothing
      let failure: unknown = null
      const watched: DecisionProvider = {
        id: provider.id,
        model: provider.model,
        confidence: provider.confidence,
        maxQuestionsPerCall: provider.maxQuestionsPerCall,
        async decide(req, opts) {
          try {
            return await provider.decide(req, opts)
          } catch (err) {
            failure ??= err
            throw err
          }
        },
      }
      const settle = async () => {
        await tracker.idle(session.id)
        if (failure) throw failure
      }
      const tracker = new AgendaTracker({
        store,
        agendas,
        logger: quiet(),
        decisions: {
          provider: async () => watched,
          localProvider: async () => watched,
          selected: () => provider.id,
        },
        now: () => now,
        options: { ...o.options, heartbeatMs: 0 },
        observe: { decision: (_s, r) => results.push(r), round: (r) => rounds.push(r) },
      })
      tracker.start()
      const session = store.createSession({ title: meeting.id })
      store.updateSession(session.id, (s) => ({
        ...s,
        status: 'recording',
        startedAt: clock().toISOString(),
      }))
      const view = agendas.create({
        title: meeting.id,
        meeting: {
          eventUid: `${meeting.id}@eval`,
          start: new Date(t0).toISOString(),
          end: new Date(t0 + meeting.scheduledEndMs).toISOString(),
          recurrenceId: null,
          meetingId: null,
          title: meeting.id,
          calendar: null,
          recurring: false,
        },
        items: meeting.agenda.map((it) => ({
          text: it.text,
          kind: it.kind,
          ...(it.owner ? { owner: it.owner } : {}),
          ...(it.timeboxMin ? { timeboxMin: Math.max(1, Math.round(it.timeboxMin)) } : {}),
        })),
      })
      const toFixture = new Map(view.items.map((it, i) => [it.id, meeting.agenda[i]!.id]))
      agendas.attachSession(view.agenda.id, session.id)
      let nextBeat = beatMs
      return {
        async onSegment(u: {
          index: number
          speaker: string
          text: string
          startMs: number
          endMs: number
          quality?: 'live' | 'final'
        }) {
          results.length = 0
          rounds.length = 0
          await settle()
          while (beatMs > 0 && u.endMs >= nextBeat) {
            now = t0 + nextBeat
            tracker.heartbeat(session.id)
            await settle()
            nextBeat += beatMs
          }
          now = t0 + u.endMs
          store.upsertSegment({
            id: `u${u.index}`,
            sessionId: session.id,
            // the user's own voice is the mic track, labelled `me`, exactly as the pipeline commits it
            track: u.speaker === 'me' ? 'mic' : 'system',
            speaker: u.speaker,
            startMs: u.startMs,
            endMs: u.endMs,
            text: u.text,
            quality: u.quality ?? 'final',
            confidence: null,
          })
          await settle()
          // the latest verdict per item across this step's rounds (a heartbeat round, then the segment's)
          const byItem = new Map<string, StatusReportOut>()
          for (const r of rounds)
            for (const v of r.verdicts) {
              const id = toFixture.get(v.itemId)
              if (!id) continue
              const prev = byItem.get(id)
              byItem.set(id, {
                itemId: id,
                pCovered: v.pCovered,
                // an auto check-off earlier in the step is not undone by a later "none"
                action: prev?.action === 'auto-covered' ? 'auto-covered' : v.action.kind,
                evidenceIndex: v.evidence
                  ? Number(v.evidence.lineId.slice(1))
                  : (prev?.evidenceIndex ?? null),
                answer: v.answer ?? prev?.answer ?? null,
              })
            }
          return { reports: [...byItem.values()], usage: usageOf(results) }
        },
      }
    },
  }
}

export function trackerRelevanceRunner(provider: DecisionProvider, mode: Mode) {
  return {
    ...meta(provider, 'tracker-gate', mode),
    async run(c: { agenda: AgendaItemInput[]; recent: Turn[]; segment: Turn }) {
      const g = await gateSegment(provider, { items: c.agenda, recent: c.recent, segment: c.segment })
      return { relevant: g.relevant, p: g.p, itemIds: g.itemIds, usage: usageOf(g.result ? [g.result] : []) }
    },
  }
}

export function trackerInjectionRunner(provider: DecisionProvider, mode: Mode) {
  const results: DecisionResult[] = []
  const guard = decisionSpeechGuard({ provider: async () => provider, onResult: (_s, r) => results.push(r) })
  let n = 0
  return {
    ...meta(provider, 'tracker-guard', mode),
    async run(c: { speaker: string; text: string }) {
      results.length = 0
      const v = await guard.judge({
        sessionId: 'eval',
        segmentId: `g${n++}`,
        speaker: c.speaker,
        text: c.text,
        kind: 'segment',
      })
      return { injection: v.flags.includes('injection'), p: v.p, usage: usageOf(results) }
    },
  }
}

const live = (it: AgendaItemInput, status: AgendaItemStatus): LiveItem => ({
  ...it,
  status,
  manual: false,
  changedBy: 'user',
  outcome: null,
})

export function trackerNextPointRunner(provider: DecisionProvider, mode: Mode) {
  return {
    ...meta(provider, 'tracker-next-point', mode),
    async run(c: {
      agenda: (AgendaItemInput & { status: AgendaItemStatus; lastDiscussedMinAgo?: number })[]
      elapsedMin: number
      remainingMin: number
      recent: Turn[]
    }) {
      const lastDiscussedMinAgo = new Map(
        c.agenda
          .filter((it) => it.lastDiscussedMinAgo !== undefined)
          .map((it) => [it.id, it.lastDiscussedMinAgo!]),
      )
      const { decision, result } = await rankNextPoint(provider, {
        items: c.agenda.map(({ status, lastDiscussedMinAgo: _l, ...it }) => live(it, status)),
        elapsedMin: c.elapsedMin,
        remainingMin: c.remainingMin,
        recent: c.recent,
        lastDiscussedMinAgo,
      })
      return { ranked: decision.ranked, usage: usageOf(result ? [result] : []) }
    },
  }
}

export function trackerInterviewRunner(provider: DecisionProvider, mode: Mode) {
  return {
    ...meta(provider, 'tracker-interview', mode),
    async run(c: { item: AgendaItemInput; transcript: Turn[] }) {
      const window = c.transcript.map((t, i) => ({ id: `t${i}`, speaker: t.speaker, text: t.text }))
      const { verdicts, results } = await statusRound(provider, { items: [live(c.item, 'open')], window })
      const v = verdicts[0]
      const answered = !!v?.interview?.answered
      return {
        answered,
        p: v?.interview ? v.interview.p : 0,
        answer: answered ? (v?.answer ?? null) : null,
        usage: usageOf(results),
      }
    },
  }
}

/**
 * The recap as the daemon writes it (recap.ts → @kacola/llm recapItem: the transcript as the cached
 * prefix, the item as the tail), on a RecapCase: its turns become one recording's segments.
 */
export function trackerRecapRunner(llm: LlmProvider) {
  return {
    name: 'tracker-recap',
    provider: llm.id,
    model: llm.model,
    mode: 'live' as Mode,
    async run(c: { id: string; item: AgendaItemInput; transcript: Turn[] }) {
      const at = '2026-01-05T10:00:00.000Z'
      const session: Session = {
        id: `ses_${c.id}`,
        title: c.id,
        createdAt: at,
        startedAt: at,
        endedAt: at,
        status: 'stopped',
        private: false,
        durationMs: c.transcript.length * 5_000,
        tracks: [],
        error: null,
      }
      const segments: Segment[] = c.transcript.map((t, i) => ({
        id: `s${i}`,
        sessionId: session.id,
        track: t.speaker === 'me' ? 'mic' : 'system',
        speaker: t.speaker,
        startMs: i * 5_000,
        endMs: i * 5_000 + 4_500,
        text: t.text,
        quality: 'final',
        revision: 1,
        confidence: null,
      }))
      const r = await recapItem({ provider: llm, transcript: { session, segments }, item: c.item })
      return {
        text: r.text,
        ...(r.status ? { status: r.status } : {}),
        usage: {
          usd: estimateCostUsd(r.usage, r.model),
          inputTokens: r.usage.inputTokens + r.usage.cacheReadTokens + r.usage.cacheWriteTokens,
          outputTokens: r.usage.outputTokens,
          calls: 1,
        },
      }
    },
  }
}
