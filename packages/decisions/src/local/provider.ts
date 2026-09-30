import type { Usage } from '@gnomeola/protocol'
import {
  choiceAnswer,
  deriveCandidates,
  extractAnswer,
  scoreAnswer,
  softmax,
  stateText,
  yesNoAnswer,
} from '../answers.ts'
import { BaseDecisionProvider, type BaseOptions, type CallResult, ZERO } from '../base.ts'
import type { Answer, DecisionState, Question } from '../types.ts'
import { CachedEmbedder, cosine, type Embedder } from './embedder.ts'
import { BUILTIN_RULES } from './rules.ts'

// The on-device decision provider: works offline, costs nothing, answers in milliseconds — and is
// honest about being a heuristic (`source: 'heuristic'`, uncalibrated).
//
// Per question, in order:
//   1. rules: deterministic checks registered for the question's `tag` (e.g. injection patterns on
//      `guardrail.injection`, agenda cues on `agenda.status` from the task layer). A rule may decline.
//   2. similarity: embed the state and the question's anchors (option descriptions, levels, yes/no
//      criteria, extraction candidates) and turn cosine similarities into a distribution.

export type RuleContext = {
  state: DecisionState
  text: string
  embed: (texts: readonly string[]) => Promise<Float32Array[]>
}

export type LocalRule = {
  /** Questions this rule handles, by tag (exact string or pattern). */
  tag: string | RegExp
  /** Return an answer of the question's kind, or null to fall through. */
  answer(q: Question, ctx: RuleContext): Answer | null | Promise<Answer | null>
}

export type LocalProviderOptions = BaseOptions & {
  embedder: Embedder
  rules?: readonly LocalRule[]
  /** Softmax temperature over cosine similarities (smaller = more peaked). */
  temperature?: number
  /** Similarity above which an extraction candidate counts as the answer. */
  extractThreshold?: number
}

export class LocalDecisionProvider extends BaseDecisionProvider {
  readonly id = 'local' as const
  readonly model: string
  readonly confidence = 'heuristic' as const
  readonly maxQuestionsPerCall = 1_000
  readonly #embedder: Embedder
  readonly #rules: readonly LocalRule[]
  readonly #t: number
  readonly #extractThreshold: number

  constructor(opts: LocalProviderOptions) {
    super({ ...opts, maxRetries: 0 }, 30_000)
    this.#embedder =
      opts.embedder instanceof CachedEmbedder ? opts.embedder : new CachedEmbedder(opts.embedder)
    this.model = opts.embedder.id
    this.#rules = [...(opts.rules ?? []), ...BUILTIN_RULES]
    this.#t = opts.temperature ?? 0.05
    this.#extractThreshold = opts.extractThreshold ?? 0.35
  }

  protected async call(
    state: DecisionState,
    questions: Question[],
    signal: AbortSignal,
  ): Promise<CallResult> {
    const text = stateText(state)
    const embed = (t: readonly string[]) => this.#embedder.embed(t)
    const ctx: RuleContext = { state, text, embed }
    const answers: Record<string, Answer> = {}
    let stateVec: Float32Array | null = null
    for (const q of questions) {
      if (signal.aborted) break
      const rule = await this.#rule(q, ctx)
      if (rule) {
        answers[q.id] = rule
        continue
      }
      stateVec ??= (await embed([text]))[0]!
      answers[q.id] = await this.#similarity(q, state, stateVec)
    }
    return { answers, usage: ZERO, model: this.model }
  }

  async #rule(q: Question, ctx: RuleContext): Promise<Answer | null> {
    if (!q.tag) return null
    for (const r of this.#rules) {
      const hit = typeof r.tag === 'string' ? r.tag === q.tag : r.tag.test(q.tag)
      if (!hit) continue
      const a = await r.answer(q, ctx)
      if (a) return a
    }
    return null
  }

  async #similarity(q: Question, state: DecisionState, s: Float32Array): Promise<Answer> {
    const sims = async (anchors: string[]) => (await this.#embedder.embed(anchors)).map((v) => cosine(s, v))
    switch (q.kind) {
      case 'choice': {
        const keys = Object.keys(q.options)
        const sim = await sims(
          keys.map((k) => `${q.instructions} ${k.replace(/[_-]/g, ' ')}: ${q.options[k] ?? ''}`),
        )
        const p = softmax(sim, this.#t)
        return choiceAnswer(q, Object.fromEntries(keys.map((k, i) => [k, p[i]!])), 'heuristic')
      }
      case 'score':
        return scoreAnswer(
          q,
          softmax(await sims(q.levels.map((l) => `${q.instructions} ${l}`)), this.#t),
          'heuristic',
        )
      case 'yesno': {
        const yes = q.yes ?? q.instructions
        if (q.no) {
          const [sy, sn] = await sims([yes, q.no])
          return yesNoAnswer(sigmoid((sy! - sn!) / this.#t), 'heuristic')
        }
        const [sy] = await sims([yes])
        return yesNoAnswer(sigmoid((sy! - this.#extractThreshold) / this.#t), 'heuristic')
      }
      case 'extract': {
        const cands = q.candidates ?? deriveCandidates(state)
        if (!cands.length) return extractAnswer(q, null, 0.5, 'heuristic')
        const [qv, ...cv] = await this.#embedder.embed([q.instructions, ...cands])
        let best = -1
        let bestSim = -Infinity
        cv.forEach((v, i) => {
          const sim = cosine(qv!, v)
          if (sim > bestSim) {
            bestSim = sim
            best = i
          }
        })
        const p = sigmoid((bestSim - this.#extractThreshold) / this.#t)
        return p >= 0.5
          ? extractAnswer(q, cands[best]!, p, 'heuristic')
          : extractAnswer(q, null, 1 - p, 'heuristic')
      }
    }
  }

  protected price(_usage: Usage): number | null {
    return 0
  }
}

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
