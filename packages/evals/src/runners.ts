import {
  contentWords,
  DEFAULT_THRESHOLDS,
  DEFER_CUE,
  type DecisionProvider,
  type DecisionResult,
  decideInjection,
  decideInterview,
  decideNextPoint,
  decideRelevance,
  decideStatus,
  type Embedder,
  overlap,
  SETTLE_CUE,
  type StatusThresholds,
  statusPolicy,
  type TrackStatus,
} from '@gnomeola/decisions'
import type { EvalMode } from '@gnomeola/testkit/evals'
import type {
  DraftRunner,
  InjectionRunner,
  InterviewRunner,
  NextPointRunner,
  RecapRunner,
  RelevanceRunner,
  RunnerMeta,
  RunUsage,
  StatusRunner,
} from './types.ts'

// Reference pipelines for every behaviour. The decision-based ones are thin: they call the same task
// functions (@gnomeola/decisions tasks) the tracker will, so an eval of them is an eval of the questions
// + the provider. The text ones (drafting, recap) have an LLM runner (llm-runners.ts) and an extractive,
// deterministic runner that is the honest offline floor.

export const usageOf = (r: DecisionResult | null | undefined): RunUsage | undefined =>
  r
    ? {
        usd: r.costUsd,
        inputTokens: r.usage.inputTokens + r.usage.cacheReadTokens,
        outputTokens: r.usage.outputTokens,
        calls: r.calls,
      }
    : undefined

export function metaOf(provider: DecisionProvider, name: string, mode: EvalMode): RunnerMeta {
  return { name, provider: provider.id, model: provider.model, mode }
}

// ------------------------------------------------------------------------------ item status

/**
 * The reference tracker loop: on every closed segment, ask about each open item over the last `window`
 * segments, apply the policy (auto ≥ 0.8 with evidence, suggest 0.5–0.8, forward-only), stop asking
 * about covered items.
 */
export function decisionStatusRunner(
  provider: DecisionProvider,
  opts: { mode: EvalMode; window?: number; thresholds?: StatusThresholds; name?: string },
): StatusRunner {
  const windowSize = opts.window ?? 10
  const thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS
  return {
    ...metaOf(provider, opts.name ?? 'reference-status', opts.mode),
    start(meeting) {
      const current = new Map<string, TrackStatus>(meeting.agenda.map((it) => [it.id, 'not_started']))
      return {
        async onSegment(_u, history) {
          const open = meeting.agenda.filter((it) => current.get(it.id) !== 'covered')
          if (!open.length) return { reports: [] }
          const window = history
            .slice(-windowSize)
            .map((h) => ({ id: `u${h.index}`, speaker: h.speaker, text: h.text }))
          const { decisions, result } = await decideStatus(provider, { items: open, window })
          const reports = decisions.map((d) => {
            const action = statusPolicy(current.get(d.itemId)!, false, d, thresholds)
            if (action.kind === 'auto-covered') current.set(d.itemId, 'covered')
            else if (action.kind === 'in-progress') current.set(d.itemId, 'in_progress')
            return {
              itemId: d.itemId,
              pCovered: d.pCovered,
              action: action.kind,
              evidenceIndex: d.evidence ? Number(d.evidence.lineId.slice(1)) : null,
              answer: d.answer,
            }
          })
          return { reports, usage: usageOf(result) }
        },
      }
    },
  }
}

// ------------------------------------------------------------------------------ text-only decisions

export function decisionRelevanceRunner(provider: DecisionProvider, mode: EvalMode): RelevanceRunner {
  return {
    ...metaOf(provider, 'reference-relevance', mode),
    async run(c) {
      const { decision, result } = await decideRelevance(provider, {
        agenda: c.agenda,
        recent: c.recent,
        segment: c.segment,
      })
      return { relevant: decision.relevant, p: decision.p, itemIds: decision.itemIds, usage: usageOf(result) }
    },
  }
}

export function decisionInjectionRunner(provider: DecisionProvider, mode: EvalMode): InjectionRunner {
  return {
    ...metaOf(provider, 'reference-guardrail', mode),
    async run(c) {
      const { decision, result } = await decideInjection(provider, { speaker: c.speaker, text: c.text })
      return { injection: decision.injection, p: decision.p, usage: usageOf(result) }
    },
  }
}

export function decisionNextPointRunner(provider: DecisionProvider, mode: EvalMode): NextPointRunner {
  return {
    ...metaOf(provider, 'reference-next-point', mode),
    async run(c) {
      const { decision, result } = await decideNextPoint(provider, {
        agenda: c.agenda,
        elapsedMin: c.elapsedMin,
        remainingMin: c.remainingMin,
        recent: c.recent,
      })
      return { ranked: decision.ranked, usage: usageOf(result) }
    },
  }
}

export function decisionInterviewRunner(provider: DecisionProvider, mode: EvalMode): InterviewRunner {
  return {
    ...metaOf(provider, 'reference-interview', mode),
    async run(c) {
      const { decision, result } = await decideInterview(provider, { item: c.item, transcript: c.transcript })
      return { answered: decision.answered, p: decision.p, answer: decision.answer, usage: usageOf(result) }
    },
  }
}

// ------------------------------------------------------------------------------ extractive text runners (offline floor)

const KIND_CUES: [RegExp, string][] = [
  [
    /\b(find out|ask|learn|understand|what is|how (much|many)|salary|pay|range|team size|policy)\b/i,
    'info-to-get',
  ],
  [/\b(decide|agree|choose|pick|approve|sign off|get .* approved|book)\b/i, 'decision'],
  [/\b(must|need to|blocker|deadline|promotion|urgent)\b/i, 'must-cover'],
]

/**
 * One item per goal, kind from cue words; open items the context explicitly carries over are added. Uses
 * nothing else from the context — so it never leaks what the user kept private, and never adds insight.
 */
export function extractiveDraftRunner(): DraftRunner {
  return {
    name: 'extractive-draft',
    provider: 'none',
    model: 'rules',
    mode: 'offline',
    async run(c) {
      const items = c.goals.map((g) => {
        const text = g.replace(/^(i want to|i'd like to|we need to|to)\s+/i, '').replace(/[.!]+$/, '')
        const kind = KIND_CUES.find(([re]) => re.test(g))?.[1] ?? 'topic'
        return { text: text.charAt(0).toUpperCase() + text.slice(1), kind }
      })
      for (const s of (c.context ?? '').split(/(?<=[.!?])\s+|\n+/))
        if (/\b(carried over|carry over|open item|still open|follow up from last)\b/i.test(s))
          items.push({ text: s.replace(/^(open items?|carried over)\s*:\s*/i, '').trim(), kind: 'topic' })
      return { items: items.slice(0, c.expected.maxItems) }
    },
  }
}

/**
 * Extractive recap: the transcript lines about the item (lexical overlap or embedding similarity), status
 * from settle / defer cues, outcome = the settling line, actions = "I'll / I will" lines by their speaker.
 */
export function extractiveRecapRunner(embedder: Embedder): RecapRunner {
  return {
    name: 'extractive-recap',
    provider: 'local',
    model: embedder.id,
    mode: 'offline',
    async run(c) {
      const iw = contentWords(c.item.text)
      const [iv, ...lv] = await embedder.embed([c.item.text, ...c.transcript.map((t) => t.text)])
      const rel = c.transcript
        .map((t, i) => {
          let sim = 0
          for (let d = 0; d < iv!.length; d++) sim += iv![d]! * lv[i]![d]!
          return { t, i, on: overlap(iw, contentWords(t.text)) >= 1 || sim >= 0.45 }
        })
        .filter((x) => x.on)
      const first = rel[0]?.i ?? 0
      const after = c.transcript.slice(first)
      const settle = [...after].reverse().find((t) => SETTLE_CUE.test(t.text))
      const defer = [...after].reverse().find((t) => DEFER_CUE.test(t.text))
      const parked = after.some((t) => /\b(park|parked|table (it|this))\b/i.test(t.text))
      const status = parked
        ? 'parked'
        : settle && !(defer && after.indexOf(defer) > after.indexOf(settle))
          ? 'covered'
          : rel.length
            ? 'in_progress'
            : 'not_started'
      const outcome = status === 'covered' ? settle!.text : (rel.at(-1)?.t.text ?? 'Not discussed.')
      const actions = after
        .filter((t) => /\b(i'?ll|i will|i can take|i'm going to)\b/i.test(t.text))
        .map((t) => `- ${t.speaker}: ${t.text}`)
      const text = [
        `Status: ${status}`,
        `Outcome: ${outcome}`,
        ...(actions.length ? ['Actions:', ...actions] : []),
      ].join('\n')
      return { text, status: status as TrackStatus | 'parked' }
    },
  }
}
