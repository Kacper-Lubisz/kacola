import type { DecisionProvider, DecisionResult, TranscriptLine } from '@kacola/decisions'
import { bridgeLine, LlmError, type LlmProvider } from '@kacola/llm'
import {
  type Agenda,
  type DurableEvent,
  type Evidence,
  ME,
  type RecapState,
  type Segment,
  type Session,
  type TrackerStatus,
} from '@kacola/protocol'
import { type AgendaStore, type Store, StoreError } from '@kacola/store'
import type { EventBus } from '../bus.ts'
import type { Logger } from '../logger.ts'
import { contextTerms, findPastContext } from './past-context.ts'
import { type DecisionSpeechGuard, decisionSpeechGuard } from './speech-guard.ts'
import {
  type AggregateOptions,
  type AggregateState,
  aggregate,
  correctedAnswer,
  type GateResult,
  gateSegment,
  INTERVIEW_KINDS,
  type ItemVerdict,
  isOpen,
  type LiveItem,
  nextPointTemplate,
  notCoveredText,
  rankNextPoint,
  statusRound,
  toLiveItem,
  trivialLine,
} from './tracker-logic.ts'

// Agendas wave 2 — the live tracker. While a recording linked to an agenda runs, it follows the transcript
// and keeps the agenda current:
//
//   each closed segment   → injection guard + relevance pre-check (one decision call each; none for filler)
//                           → relevant: one batched status round over the open items (tracker-logic.ts)
//                           → the policy: covered ≥ 0.8 with evidence = auto check-off (marked auto,
//                             undoable), 0.5–0.8 = a "looks covered?" suggestion, else in-progress;
//                             forward-only and manual-wins are the store's rules (a 409 = stay quiet);
//                             on what the user asks (info-to-get, question), evidence in their own line
//                             (`me`, the mic track) counts one step less (tracker-logic.ts ownerDemoted)
//   every 30 s            → a status round if something was said since the last one (catches what the
//                           per-segment gate missed), and the timers below
//   after a round         → the next talking point (one suggestion, replaced when the ranking changes,
//                           at most once a minute), the T-5 min "not covered yet" nudge (once), and a
//                           context card from past meetings (at most every 3 min)
//
// It never blocks capture: store commits only enqueue; one serial worker per recording does the calls,
// and when it falls behind the oldest segment triggers are dropped (counted in the status — the next
// round still reads their text). A failing provider (quota, auth, network, …) degrades to the on-device
// provider for a while, and says so (`agenda.tracker` events, GET /agendas/:id/tracker).

export type TrackerOptions = {
  /** 0 = no heartbeat (the eval drives rounds itself). */
  heartbeatMs?: number
  /**
   * Transcript lines per status round (the gate, next point and bridge line read the last few of them).
   * 30: an answer given over several turns stays in view until it adds up (10 kept diffuse answers under
   * the check-off threshold and let P fall as the talk moved on; see docs/decisions.md, "Cadence").
   */
  window?: number
  /**
   * The status round's window on the on-device provider: its rules take the latest question → answer pair
   * in view, so a longer window gives them more wrong pairs to pick (measured), not more evidence.
   */
  localWindow?: number
  /** Pending segment triggers per recording before the oldest is dropped. */
  queueMax?: number
  nextPointEveryMs?: number
  nudgeBeforeEndMin?: number
  contextEveryMs?: number
  /** How long to stay on the on-device provider after the selected one failed. */
  degradeForMs?: number
  suggestionTtlSec?: number
  bridgeTimeoutMs?: number
  /** Run the injection guard on every segment (default on). */
  guard?: boolean
  /** Least time between two `agenda.tracker` events for one recording (state changes always go out). */
  statusEveryMs?: number
  /**
   * The relevance pre-check before a segment's status round (one call). false = every non-trivial closed
   * segment gets a status round directly: more rounds, no better recall on the real interview, and a
   * slower, costlier segment (status calls are the heavy ones), so on by default.
   */
  gate?: boolean
  /**
   * Tell the status question that `me` (the mic track) is the agenda's owner: for things they want to find
   * out, their own question raises the item and another speaker's answer covers it.
   */
  owner?: boolean
  /** Sustained-evidence check-off across rounds (tracker-logic.ts `aggregate`); null = off. */
  aggregate?: AggregateOptions | null
  /**
   * Re-judge a segment still being spoken once its text has grown by this many words, and when it goes
   * final (0 = only its first publication triggers a round; see #maybeRecheck).
   */
  recheckWords?: number
}

const DEFAULTS: Required<TrackerOptions> = {
  heartbeatMs: 30_000,
  window: 30,
  localWindow: 10,
  queueMax: 8,
  nextPointEveryMs: 60_000,
  nudgeBeforeEndMin: 5,
  contextEveryMs: 180_000,
  degradeForMs: 300_000,
  suggestionTtlSec: 600,
  bridgeTimeoutMs: 8_000,
  guard: true,
  statusEveryMs: 2_000,
  gate: true,
  owner: true,
  aggregate: null,
  recheckWords: 12,
}

export type TrackerDecisions = {
  /** The provider the settings select, or null when it cannot run (a keyed provider without its key). */
  provider(): Promise<DecisionProvider | null>
  /** The on-device provider (always available). */
  localProvider(): Promise<DecisionProvider>
  /** The selected provider's name, for the status. */
  selected(): string
  /**
   * Whether the selected provider runs on this computer (local, or Ollama on a loopback address). Absent =
   * only the `local` provider counts as on-device. A private meeting's words never go to one that is not.
   */
  onDevice?(): boolean
}

/** What a round did, for observers (the eval runner). */
export type RoundObservation = {
  sessionId: string
  agendaId: string
  trigger: 'segment' | 'heartbeat'
  segmentId: string | null
  verdicts: ItemVerdict[]
}

export type TrackerDeps = {
  store: Store
  agendas: AgendaStore
  bus?: EventBus | null
  logger: Logger
  decisions: TrackerDecisions
  /**
   * The text LLM for next-point bridge lines of this session; null (or absent) = the template line. The
   * daemon answers null for a private session unless the provider is on-device.
   */
  llm?: (sessionId: string) => Promise<LlmProvider | null>
  now?: () => number
  options?: TrackerOptions
  observe?: {
    decision?(sessionId: string, r: DecisionResult): void
    round?(o: RoundObservation): void
  }
}

type TimedLine = TranscriptLine & { startMs: number; endMs: number }

type Task = { kind: 'segment'; segmentId: string } | { kind: 'heartbeat' } | { kind: 'after' }

type Live = {
  sessionId: string
  agendaId: string
  session: Session
  lines: TimedLine[]
  flagged: Set<string>
  tasks: Task[]
  running: Promise<void> | null
  /** Lines arrived since the last status round. */
  dirty: boolean
  heartbeat: NodeJS.Timeout | null
  status: TrackerStatus
  lastEmit: number
  next: { id: string; itemId: string; at: number } | null
  lastRankAt: number
  dismissed: Map<string, number>
  nudged: boolean
  lastContextAt: number
  contextSkip: Set<string>
  lastDiscussed: Map<string, number>
  /** Sustained-evidence runs per item (`aggregate` option). */
  runs: AggregateState
  /** Segment id → the text its last segment round judged (re-checks). */
  judged: Map<string, string>
  ended: boolean
}

const ENDED = new Set(['stopped', 'recovered', 'failed'])

export class AgendaTracker {
  readonly guard: DecisionSpeechGuard
  readonly #d: TrackerDeps
  readonly #o: Required<TrackerOptions>
  readonly #now: () => number
  readonly #live = new Map<string, Live>()
  /** Latest status per agenda, kept after the recording ends (the read route). */
  readonly #statuses = new Map<string, TrackerStatus>()
  #unsubscribe: (() => void) | null = null
  /** Until when the selected provider is skipped for the on-device one (it failed). Provider-wide. */
  #degradedUntil = 0
  #degradedWhy: string | null = null

  constructor(d: TrackerDeps) {
    this.#d = d
    this.#o = { ...DEFAULTS, ...d.options }
    this.#now = d.now ?? Date.now
    this.guard = decisionSpeechGuard({
      provider: async (sessionId) => {
        const p = this.#now() >= this.#degradedUntil ? await this.#d.decisions.provider() : null
        return p && this.#mayUse(sessionId, p) ? p : this.#d.decisions.localProvider()
      },
      fallback: () => this.#d.decisions.localProvider(),
      onError: (err) => {
        if (err instanceof LlmError && err.code !== 'aborted') this.#degrade(err)
        this.#d.logger.warn('speech guard: provider failed, used on-device', { err: String(err) })
      },
      onResult: (sessionId, r) => {
        const live = this.#live.get(sessionId)
        if (live) this.#count(live, r)
      },
    })
  }

  start(): void {
    this.#unsubscribe ??= this.#d.store.onCommit((e) => this.#onEvent(e))
    // recordings already under way (a daemon restart mid-meeting keeps them recovered, not recording,
    // but a tracker started after the service is still correct)
    for (const s of this.#d.store.sessionsWithStatus(['recording', 'paused'])) this.#maybeBegin(s.id)
  }

  stop(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = null
    for (const live of this.#live.values()) this.#end(live)
  }

  /** The tracker's status for an agenda (the latest recording), or null when it never ran. */
  status(agendaId: string): TrackerStatus | null {
    return this.#statuses.get(agendaId) ?? null
  }

  /** Resolves when the recording's queued work is done (tests, the eval, and the recap before it reads). */
  async idle(sessionId: string): Promise<void> {
    for (;;) {
      const live = this.#live.get(sessionId)
      if (!live?.running) return
      await live.running
    }
  }

  /** Run a heartbeat now (the eval replays fixture time; the timer does this live). */
  heartbeat(sessionId: string): void {
    const live = this.#live.get(sessionId)
    if (live) this.#push(live, { kind: 'heartbeat' })
  }

  /** The recap wave's status slot (recap.ts). */
  setRecap(agendaId: string, recap: { state: RecapState; detail?: string | null; items?: number }): void {
    const s = this.#statuses.get(agendaId)
    if (!s) return
    s.recap = { state: recap.state, detail: recap.detail ?? null, items: recap.items ?? s.recap.items }
    this.#emit(s, true)
  }

  // ------------------------------------------------------------------------------ lifecycle

  #onEvent(e: DurableEvent): void {
    const d = e.data
    try {
      if (d.type === 'segment.upserted') {
        const live = e.sessionId ? this.#live.get(e.sessionId) : undefined
        if (live && !live.ended) this.#onSegment(live, d.segment)
      } else if (d.type === 'agenda.upserted') {
        if (d.agenda.sessionId) this.#maybeBegin(d.agenda.sessionId)
      } else if (d.type === 'session.upserted') {
        if (d.session.status === 'recording' || d.session.status === 'paused') this.#maybeBegin(d.session.id)
        else if (ENDED.has(d.session.status)) {
          const live = this.#live.get(d.session.id)
          if (live) this.#end(live)
        }
      } else if (d.type === 'session.deleted') {
        const live = this.#live.get(d.sessionId)
        if (live) this.#end(live)
      }
    } catch (err) {
      this.#d.logger.warn('tracker: event handling failed', { type: d.type, err: String(err) })
    }
  }

  #maybeBegin(sessionId: string): void {
    if (this.#live.has(sessionId)) return
    const session = this.#d.store.getSession(sessionId)
    if (!session || (session.status !== 'recording' && session.status !== 'paused')) return
    const agenda = this.#d.agendas.bySession(sessionId)[0]
    if (!agenda) return
    const status: TrackerStatus = {
      sessionId,
      agendaId: agenda.id,
      state: 'running',
      selected: this.#d.decisions.selected(),
      provider: this.#d.decisions.selected(),
      model: '',
      detail: null,
      segments: 0,
      relevant: 0,
      rounds: 0,
      decisionCalls: 0,
      dropped: 0,
      errors: 0,
      costUsd: 0,
      lastRoundAt: null,
      recap: { state: 'pending', detail: null, items: 0 },
    }
    const live: Live = {
      sessionId,
      agendaId: agenda.id,
      session,
      lines: [],
      flagged: new Set(),
      tasks: [],
      running: null,
      dirty: false,
      heartbeat: null,
      status,
      lastEmit: 0,
      next: null,
      lastRankAt: Number.NEGATIVE_INFINITY,
      dismissed: new Map(),
      nudged: false,
      lastContextAt: Number.NEGATIVE_INFINITY,
      contextSkip: new Set(),
      lastDiscussed: new Map(),
      runs: new Map(),
      judged: new Map(),
      ended: false,
    }
    this.#live.set(sessionId, live)
    this.#statuses.set(agenda.id, status)
    // segments that closed before the agenda was linked
    for (const s of this.#d.store.segments(sessionId)) this.#addLine(live, s)
    if (this.#o.heartbeatMs > 0) {
      live.heartbeat = setInterval(() => this.#push(live, { kind: 'heartbeat' }), this.#o.heartbeatMs)
      live.heartbeat.unref()
    }
    this.#d.logger.info('tracker following recording', { sessionId, agendaId: agenda.id })
    this.#emit(status, true)
    // a first next talking point before anyone speaks
    this.#push(live, { kind: 'after' })
  }

  #end(live: Live): void {
    if (live.ended) return
    live.ended = true
    if (live.heartbeat) clearInterval(live.heartbeat)
    live.status.state = 'stopped'
    this.#emit(live.status, true)
    // queued work finishes (the recording's last segments); then the entry goes
    void this.idle(live.sessionId).then(() => {
      if (this.#live.get(live.sessionId) === live) this.#live.delete(live.sessionId)
    })
  }

  /** 'new' line, 'changed' (text or speaker revised), or null (nothing to do). */
  #addLine(live: Live, s: Segment): 'new' | 'changed' | null {
    const text = s.text.replace(/\s+/g, ' ').trim()
    const i = live.lines.findIndex((l) => l.id === s.id)
    if (i >= 0) {
      if (live.lines[i]!.text === text && live.lines[i]!.speaker === s.speaker) return null
      // a flagged line stays flagged until its new text has been judged (the re-check below)
      live.lines[i] = { ...live.lines[i]!, text, speaker: s.speaker }
      live.dirty = true
      return 'changed'
    }
    if (!text) return null
    const line = { id: s.id, speaker: s.speaker, text, startMs: s.startMs, endMs: s.endMs }
    let at = live.lines.length
    while (at > 0 && live.lines[at - 1]!.endMs > line.endMs) at--
    live.lines.splice(at, 0, line)
    if (live.lines.length > 400) live.lines.splice(0, live.lines.length - 400)
    live.dirty = true
    return 'new'
  }

  #onSegment(live: Live, s: Segment): void {
    const r = this.#addLine(live, s)
    if (r === 'new') {
      live.status.segments++
      this.#push(live, { kind: 'segment', segmentId: s.id })
    } else if (r === 'changed' || s.quality === 'final') this.#maybeRecheck(live, s)
  }

  /**
   * The pipeline publishes a segment while it is spoken (its first committed words, then more, then the
   * final text): the first publication triggers the segment's round, often on a few words. Its text is
   * judged again — guard, gate, round — once it has grown by `recheckWords` words, and when it goes final
   * with text not judged yet, so a long answer is decided while and when it is given, not at the next
   * heartbeat, and no words reach a round unguarded for longer than that.
   */
  #maybeRecheck(live: Live, s: Segment): void {
    if (this.#o.recheckWords <= 0) return
    const line = live.lines.find((l) => l.id === s.id)
    const judged = live.judged.get(s.id)
    if (!line || judged === undefined || judged === line.text) return
    if (s.quality !== 'final' && wordCount(line.text) - wordCount(judged) < this.#o.recheckWords) return
    this.#push(live, { kind: 'segment', segmentId: s.id })
  }

  // ------------------------------------------------------------------------------ the worker

  #push(live: Live, t: Task): void {
    if (live.ended && t.kind !== 'segment') return
    if (t.kind !== 'segment' && live.tasks.some((x) => x.kind === t.kind)) return
    // a segment already waiting reads its latest text when it runs
    if (t.kind === 'segment' && live.tasks.some((x) => x.kind === 'segment' && x.segmentId === t.segmentId))
      return
    live.tasks.push(t)
    const segs = live.tasks.filter((x) => x.kind === 'segment')
    if (segs.length > this.#o.queueMax) {
      live.tasks.splice(live.tasks.indexOf(segs[0]!), 1)
      live.status.dropped++
    }
    this.#kick(live)
  }

  #kick(live: Live): void {
    live.running ??= this.#work(live).finally(() => {
      live.running = null
      // a task pushed while the worker was finishing
      if (live.tasks.length) this.#kick(live)
    })
  }

  async #work(live: Live): Promise<void> {
    while (live.tasks.length) {
      const t = live.tasks.shift()!
      try {
        if (t.kind === 'segment') await this.#segmentTask(live, t.segmentId)
        else if (t.kind === 'heartbeat') await this.#heartbeatTask(live)
        else await this.#after(live)
      } catch (err) {
        live.status.errors++
        this.#d.logger.warn('tracker round failed', { sessionId: live.sessionId, err: String(err) })
      }
      this.#emit(live.status, false)
    }
  }

  // ------------------------------------------------------------------------------ providers

  /** Private means never sent to the cloud: a private session's lines only go to an on-device provider. */
  #mayUse(sessionId: string, p: DecisionProvider): boolean {
    if (p.id === 'local' || this.#d.decisions.onDevice?.()) return true
    return !this.#d.store.getSession(sessionId)?.private
  }

  async #provider(live: Live): Promise<{ p: DecisionProvider; primary: boolean }> {
    if (this.#now() < this.#degradedUntil) {
      this.#setState(live, 'degraded', this.#degradedWhy)
      return { p: await this.#d.decisions.localProvider(), primary: false }
    }
    const p = await this.#d.decisions.provider()
    if (!p) {
      this.#setState(
        live,
        'degraded',
        `${this.#d.decisions.selected()} cannot run (no key): using on-device decisions`,
      )
      return { p: await this.#d.decisions.localProvider(), primary: false }
    }
    // a private meeting stays on this computer: on-device decisions, and not a degradation
    if (!this.#mayUse(live.sessionId, p))
      return { p: await this.#d.decisions.localProvider(), primary: false }
    return { p, primary: p.id !== 'local' }
  }

  /** Run `fn` on the selected provider; on a provider error, degrade to on-device and run it there. */
  async #decide<T>(live: Live, fn: (p: DecisionProvider) => Promise<T>): Promise<T> {
    const { p, primary } = await this.#provider(live)
    try {
      const out = await fn(p)
      this.#noteProvider(live, p)
      if (primary && live.status.state === 'degraded') this.#setState(live, 'running', null)
      return out
    } catch (err) {
      if (!primary || !(err instanceof LlmError) || err.code === 'aborted') throw err
      live.status.errors++
      this.#degrade(err, p.id)
      this.#setState(live, 'degraded', this.#degradedWhy)
      this.#d.logger.warn('tracker: decisions provider failed, degrading to on-device', {
        provider: p.id,
        code: err.code,
      })
      const local = await this.#d.decisions.localProvider()
      const out = await fn(local)
      this.#noteProvider(live, local)
      return out
    }
  }

  #degrade(err: LlmError, provider = this.#d.decisions.selected()): void {
    this.#degradedUntil = this.#now() + this.#o.degradeForMs
    this.#degradedWhy = `${provider} failed (${err.code}: ${err.message.slice(0, 160)}): using on-device decisions`
  }

  #noteProvider(live: Live, p: DecisionProvider): void {
    live.status.provider = p.id
    live.status.model = p.model
  }

  #count(live: Live, r: DecisionResult | null | undefined): void {
    if (!r) return
    live.status.decisionCalls += r.calls
    live.status.costUsd =
      live.status.costUsd === null || r.costUsd === null ? null : live.status.costUsd + r.costUsd
    this.#d.observe?.decision?.(live.sessionId, r)
  }

  #setState(live: Live, state: TrackerStatus['state'], detail: string | null): void {
    if (live.ended) return
    const changed = live.status.state !== state || live.status.detail !== detail
    live.status.state = state
    live.status.detail = detail
    if (changed) this.#emit(live.status, true)
  }

  #emit(s: TrackerStatus, force: boolean): void {
    const live = this.#live.get(s.sessionId)
    const now = this.#now()
    if (!force && live && now - live.lastEmit < this.#o.statusEveryMs) return
    if (live) live.lastEmit = now
    this.#d.bus?.ephemeral(s.sessionId, { type: 'agenda.tracker', status: structuredClone(s) })
  }

  // ------------------------------------------------------------------------------ rounds

  #items(live: Live): LiveItem[] {
    const history = this.#d.agendas.history(live.agendaId)
    const lastBy = new Map<string, { by: string; override: boolean }>()
    for (const c of history) lastBy.set(c.itemId, { by: c.by, override: c.override })
    return this.#d.agendas.items(live.agendaId).map((it) => {
      const last = lastBy.get(it.id)
      return toLiveItem(it, last?.by === 'user' && last.override)
    })
  }

  #window(live: Live, upTo?: string): TimedLine[] {
    let lines = live.lines.filter((l) => !live.flagged.has(l.id))
    if (upTo) {
      const i = lines.findIndex((l) => l.id === upTo)
      if (i >= 0) lines = lines.slice(0, i + 1)
    }
    return lines.slice(-this.#o.window)
  }

  async #segmentTask(live: Live, segmentId: string): Promise<void> {
    const line = live.lines.find((l) => l.id === segmentId)
    if (!line || !this.#d.agendas.get(live.agendaId)) return
    live.judged.set(segmentId, line.text)
    const items = this.#items(live)
    const asked = items.filter(
      (it) =>
        isOpen(it.status) ||
        (it.kind === 'info-to-get' && it.status === 'covered' && it.changedBy === 'tracker'),
    )
    const recent = this.#window(live, segmentId)
      .filter((l) => l.id !== segmentId)
      .slice(-4)
    const [guard, gate] = await Promise.all([
      this.#o.guard && !trivialLine(line.text)
        ? this.guard.judge({
            sessionId: live.sessionId,
            segmentId,
            speaker: line.speaker,
            text: line.text,
            kind: 'segment',
          })
        : null,
      this.#o.gate
        ? this.#decide(live, (p) => gateSegment(p, { items: asked, recent, segment: line }))
        : ungated(line.text, asked),
    ])
    this.#count(live, gate.result)
    // judged clean (its latest text): a flag from an earlier revision no longer holds
    if (guard && !guard.flags.includes('injection')) live.flagged.delete(segmentId)
    if (guard?.flags.includes('injection')) {
      live.flagged.add(segmentId)
      this.#d.logger.info('tracker: segment flagged as an injection attempt', {
        sessionId: live.sessionId,
        segmentId,
      })
      return
    }
    for (const id of gate.itemIds) live.lastDiscussed.set(id, this.#now())
    if (!gate.relevant) return
    live.status.relevant++
    await this.#round(live, 'segment', segmentId, gate.itemIds)
    await this.#after(live)
  }

  async #heartbeatTask(live: Live): Promise<void> {
    if (
      live.dirty &&
      this.#window(live).some((l) => !trivialLine(l.text)) &&
      this.#d.agendas.get(live.agendaId)
    )
      await this.#round(live, 'heartbeat', null, [])
    await this.#after(live)
  }

  async #round(live: Live, trigger: 'segment' | 'heartbeat', segmentId: string | null, focus: string[]) {
    const items = this.#items(live)
    const window = this.#window(live)
    live.dirty = false
    const round = await this.#decide(live, (p) =>
      statusRound(p, {
        items,
        window: p.id === 'local' ? window.slice(-this.#o.localWindow) : window,
        focus,
        ...(this.#o.owner ? { owner: ME } : {}),
      }),
    )
    const { results } = round
    const verdicts = this.#o.aggregate
      ? aggregate(live.runs, round.verdicts, this.#o.aggregate, {
          items: new Map(items.map((it) => [it.id, it])),
          speakerOf: new Map(window.map((l) => [l.id, l.speaker])),
        })
      : round.verdicts
    for (const r of results) this.#count(live, r)
    live.status.rounds++
    live.status.lastRoundAt = new Date(this.#now()).toISOString()
    const byId = new Map(items.map((it) => [it.id, it]))
    for (const v of verdicts) {
      const item = byId.get(v.itemId)
      if (!item) continue
      if (v.evidence || v.action.kind !== 'none') live.lastDiscussed.set(v.itemId, this.#now())
      try {
        this.#apply(live, item, v)
      } catch (err) {
        if (err instanceof StoreError && (err.code === 'conflict' || err.code === 'not_found')) continue
        throw err
      }
    }
    this.#d.observe?.round?.({
      sessionId: live.sessionId,
      agendaId: live.agendaId,
      trigger,
      segmentId,
      verdicts,
    })
  }

  #evidence(v: ItemVerdict): Evidence[] {
    return v.evidence
      ? [
          {
            segmentId: v.evidence.lineId,
            quote: v.evidence.quote.slice(0, 500),
            confidence: round2(v.evidence.confidence),
          },
        ]
      : []
  }

  #apply(live: Live, item: LiveItem, v: ItemVerdict): void {
    const store = this.#d.agendas
    const interview = INTERVIEW_KINDS.has(item.kind)
    switch (v.action.kind) {
      case 'auto-covered': {
        store.setStatus(live.agendaId, item.id, {
          status: 'covered',
          by: 'tracker',
          auto: true,
          confidence: round2(v.pCovered),
          evidence: this.#evidence(v),
          ...(interview && (v.answer || v.evidence)
            ? {
                outcome: (item.kind === 'info-to-get' && v.answer ? v.answer : v.evidence!.quote).slice(
                  0,
                  4000,
                ),
              }
            : {}),
        })
        for (const s of store.suggestions(live.agendaId))
          if (
            s.itemId === item.id &&
            s.state === 'open' &&
            s.source === 'tracker' &&
            s.kind === 'looks-covered'
          )
            store.resolveSuggestion(live.agendaId, s.id, 'dismiss', 'tracker')
        return
      }
      case 'suggest-covered': {
        const open = store
          .suggestions(live.agendaId)
          .some(
            (s) =>
              s.itemId === item.id &&
              s.kind === 'looks-covered' &&
              s.state === 'open' &&
              !this.#expired(s.expiresAt),
          )
        if (open) return
        const heard = v.answer ?? v.evidence?.quote
        store.addSuggestion(live.agendaId, {
          kind: 'looks-covered',
          text: `Looks covered: ${item.text}${heard ? ` — “${heard.slice(0, 200)}”` : ''}`,
          itemId: item.id,
          source: 'tracker',
          ttlSec: this.#o.suggestionTtlSec,
        })
        return
      }
      case 'in-progress':
        store.setStatus(live.agendaId, item.id, {
          status: 'in-progress',
          by: 'tracker',
          confidence: round2(Math.max(v.status.pInProgress, v.pCovered)),
          evidence: this.#evidence(v),
        })
        return
      case 'none': {
        const answer = correctedAnswer(item, v)
        if (answer && item.status === 'covered' && item.changedBy === 'tracker')
          store.setStatus(live.agendaId, item.id, {
            status: 'covered',
            by: 'tracker',
            outcome: answer,
            evidence: this.#evidence(v),
          })
      }
    }
  }

  #expired(expiresAt: string | null): boolean {
    return expiresAt !== null && Date.parse(expiresAt) <= this.#now()
  }

  // ------------------------------------------------------------------------------ after a round

  #times(live: Live): { elapsedMin: number; remainingMin: number | null } {
    const agenda: Agenda | null = this.#d.agendas.get(live.agendaId)
    const start = Date.parse(live.session.startedAt ?? live.session.createdAt)
    const end = agenda?.meeting?.end ?? live.session.meeting?.end ?? null
    const now = this.#now()
    return {
      elapsedMin: Math.max(0, (now - start) / 60_000),
      remainingMin: end ? (Date.parse(end) - now) / 60_000 : null,
    }
  }

  async #after(live: Live): Promise<void> {
    if (!this.#d.agendas.get(live.agendaId)) return
    for (const step of [() => this.#nextPoint(live), () => this.#nudge(live), () => this.#context(live)]) {
      try {
        await step()
      } catch (err) {
        if (err instanceof StoreError && (err.code === 'conflict' || err.code === 'not_found')) continue
        live.status.errors++
        this.#d.logger.warn('tracker follow-up failed', { sessionId: live.sessionId, err: String(err) })
      }
    }
  }

  async #nextPoint(live: Live): Promise<void> {
    const store = this.#d.agendas
    const now = this.#now()
    const items = this.#items(live)
    const byId = new Map(items.map((it) => [it.id, it]))
    const cur = live.next ? store.suggestion(live.agendaId, live.next.id) : null
    if (cur && cur.state === 'dismissed' && cur.resolvedBy !== 'tracker' && live.next)
      live.dismissed.set(live.next.itemId, now)
    const curItem = live.next ? byId.get(live.next.itemId) : undefined
    const curValid =
      cur?.state === 'open' &&
      !this.#expired(cur.expiresAt) &&
      !!curItem &&
      isOpen(curItem.status) &&
      !curItem.manual
    const open = items.filter((it) => isOpen(it.status) && !it.manual)
    const retire = () => {
      if (cur?.state === 'open') store.resolveSuggestion(live.agendaId, cur.id, 'dismiss', 'tracker')
      live.next = null
    }
    if (!open.length) return retire()
    // a card on screen is re-ranked once a period; without one (its item was covered, it was dismissed
    // or expired) as soon as a short gap has passed
    if (
      now - live.lastRankAt <
      (curValid ? this.#o.nextPointEveryMs : Math.min(10_000, this.#o.nextPointEveryMs))
    )
      return
    const exclude = new Set<string>()
    for (const [id, at] of live.lastDiscussed) if (now - at < 90_000) exclude.add(id)
    for (const [id, at] of live.dismissed) if (now - at < 300_000) exclude.add(id)
    if (open.every((it) => exclude.has(it.id))) for (const id of live.lastDiscussed.keys()) exclude.delete(id)
    const { elapsedMin, remainingMin } = this.#times(live)
    const lastDiscussedMinAgo = new Map([...live.lastDiscussed].map(([id, at]) => [id, (now - at) / 60_000]))
    const recent = this.#window(live).slice(-6)
    const { decision, result } = await this.#decide(live, (p) =>
      rankNextPoint(p, { items, elapsedMin, remainingMin, recent, lastDiscussedMinAgo, exclude }),
    )
    this.#count(live, result)
    live.lastRankAt = now
    const top = decision.ranked.find((id) => !exclude.has(id)) ?? decision.ranked[0]
    const item = top ? byId.get(top) : undefined
    if (!item) return retire()
    if (curValid && live.next?.itemId === item.id) return
    const text = (await this.#bridge(live, item, remainingMin)) ?? nextPointTemplate(item, remainingMin)
    if (cur?.state === 'open') store.resolveSuggestion(live.agendaId, cur.id, 'dismiss', 'tracker')
    const sug = store.addSuggestion(live.agendaId, {
      kind: 'next-point',
      text,
      itemId: item.id,
      source: 'tracker',
      ttlSec: this.#o.suggestionTtlSec,
    })
    live.next = { id: sug.id, itemId: item.id, at: now }
  }

  async #bridge(live: Live, item: LiveItem, remainingMin: number | null): Promise<string | null> {
    const llm = await this.#d.llm?.(live.sessionId).catch(() => null)
    if (!llm) return null
    try {
      const r = await bridgeLine({
        provider: llm,
        next: { text: item.text, kind: item.kind },
        recent: this.#window(live).slice(-4),
        remainingMin,
        signal: AbortSignal.timeout(this.#o.bridgeTimeoutMs),
      })
      return r.text
    } catch (err) {
      this.#d.logger.warn('tracker: bridge line failed, using the template', { err: String(err) })
      return null
    }
  }

  async #nudge(live: Live): Promise<void> {
    if (live.nudged) return
    const { remainingMin } = this.#times(live)
    if (remainingMin === null || remainingMin > this.#o.nudgeBeforeEndMin) return
    live.nudged = true
    const text = notCoveredText(this.#items(live), remainingMin)
    if (!text) return
    this.#d.agendas.addSuggestion(live.agendaId, {
      kind: 'missed',
      text,
      source: 'tracker',
      ttlSec: Math.max(60, Math.round(this.#o.nudgeBeforeEndMin * 60 + 120)),
    })
  }

  async #context(live: Live): Promise<void> {
    const now = this.#now()
    if (now - live.lastContextAt < this.#o.contextEveryMs) return
    const recent = this.#window(live).slice(-8)
    if (!recent.length) return
    const terms = contextTerms(recent)
    if (!terms.length) return
    const people = new Set(live.lines.map((l) => l.speaker).filter((s) => s !== 'me' && s !== 'them'))
    const found = findPastContext(this.#d.store, {
      sessionId: live.sessionId,
      terms,
      people,
      skip: live.contextSkip,
      before: new Date(live.session.startedAt ?? live.session.createdAt),
    })
    if (!found) return
    live.contextSkip.add(found.term.toLowerCase())
    live.lastContextAt = now
    this.#d.agendas.addContext(live.agendaId, {
      title: found.title,
      body: found.body,
      source: { kind: 'session', ref: found.sessionId },
      visibility: 'private',
      by: 'tracker',
    })
  }
}

/** Without the relevance pre-check: every non-trivial segment is worth a round (no call, no item hint). */
function ungated(text: string, items: readonly LiveItem[]): GateResult {
  return { relevant: items.length > 0 && !trivialLine(text), p: 1, itemIds: [], result: null }
}

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

const round2 = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 100) / 100
