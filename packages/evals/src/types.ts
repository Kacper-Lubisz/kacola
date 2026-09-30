import type { TrackStatus } from '@gnomeola/decisions'
import type {
  AgendaDraftingCase,
  AgendaItemInput,
  EvalMode,
  InjectionCase,
  InterviewExtractionCase,
  NextPointCase,
  RecapCase,
  RelevanceCase,
} from '@gnomeola/testkit/evals'

// The runner hooks: what a pipeline under evaluation implements. The reference pipelines in runners.ts
// implement them over a DecisionProvider (or an LLM); the tracker wave plugs its real pipeline in by
// implementing the same interfaces and handing them to the suites.

export type RunnerMeta = {
  /** Shown in scorecards, e.g. `reference-status`, `tracker`. */
  name: string
  provider: string
  model: string
  mode: EvalMode
}

/** What one runner call cost (sum of its decision/LLM calls). */
export type RunUsage = { usd: number | null; inputTokens: number; outputTokens: number; calls: number }

// ------------------------------------------------------------------------------ item status (live replay)

/** One closed segment, as the tracker sees it during a meeting: times on the session timeline. */
export type ReplayUtterance = {
  /** Index into the fixture's utterances (evidence points back to it). */
  index: number
  speaker: string
  text: string
  startMs: number
  endMs: number
}

export type StatusAction = 'auto-covered' | 'suggest-covered' | 'in-progress' | 'none'

export type StatusReport = {
  itemId: string
  /** P(covered) as the pipeline saw it on this segment (calibration probe). */
  pCovered: number
  /** What the pipeline did about it. */
  action: StatusAction
  evidenceIndex: number | null
  /** info-to-get: the answer heard so far. */
  answer?: string | null
}

export type StatusMeeting = {
  id: string
  agenda: AgendaItemInput[]
  durationMs: number
  scheduledEndMs: number
}

export interface StatusSession {
  /** Called for every closed segment in time order; `history` is everything so far, this one included. */
  onSegment(
    u: ReplayUtterance,
    history: readonly ReplayUtterance[],
  ): Promise<{ reports: StatusReport[]; usage?: RunUsage }>
}

export interface StatusRunner extends RunnerMeta {
  start(meeting: StatusMeeting): StatusSession
}

// ------------------------------------------------------------------------------ text-only behaviours

type Out<T> = Promise<T & { usage?: RunUsage }>

export interface RelevanceRunner extends RunnerMeta {
  run(c: RelevanceCase): Out<{ relevant: boolean; p: number; itemIds: string[] }>
}
export interface InjectionRunner extends RunnerMeta {
  run(c: InjectionCase): Out<{ injection: boolean; p: number }>
}
export interface NextPointRunner extends RunnerMeta {
  run(c: NextPointCase): Out<{ ranked: string[] }>
}
export interface InterviewRunner extends RunnerMeta {
  run(c: InterviewExtractionCase): Out<{ answered: boolean; p: number; answer: string | null }>
}
export interface DraftRunner extends RunnerMeta {
  run(c: AgendaDraftingCase): Out<{ items: { text: string; kind?: string }[] }>
}
export interface RecapRunner extends RunnerMeta {
  run(c: RecapCase): Out<{ text: string; status?: TrackStatus | 'parked' }>
}
