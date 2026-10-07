import { LlmError } from '@kacola/llm'
import type { Usage } from '@kacola/protocol'
import { describe, expect, it } from 'vitest'
import {
  choiceAnswer,
  deriveCandidates,
  normalize,
  peakConfidence,
  scoreAnswer,
  validateQuestions,
  yesNoAnswer,
} from '../src/answers.ts'
import { BaseDecisionProvider, type CallResult } from '../src/base.ts'
import type { Answer, DecisionState, Question } from '../src/types.ts'

// The shared machinery every provider runs through: validation, batching, per-attempt timeouts,
// cancellation, retries, answer checks and usage/cost accounting.

type Script = (qs: Question[], attempt: number, signal: AbortSignal) => Promise<Record<string, Answer>>

class Stub extends BaseDecisionProvider {
  readonly id = 'local' as const
  readonly model = 'stub-1'
  readonly confidence = 'heuristic' as const
  readonly maxQuestionsPerCall: number
  calls: Question[][] = []
  inFlight = 0
  maxInFlight = 0
  attempts = 0
  readonly #script: Script
  constructor(
    script: Script,
    opts: ConstructorParameters<typeof BaseDecisionProvider>[0] & { perCall?: number } = {},
  ) {
    super({ retryDelayMs: () => 1, ...opts })
    this.maxQuestionsPerCall = opts.perCall ?? 100
    this.#script = script
  }
  protected async call(_s: DecisionState, qs: Question[], signal: AbortSignal): Promise<CallResult> {
    this.calls.push(qs)
    this.inFlight++
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight)
    try {
      const answers = await this.#script(qs, this.attempts++, signal)
      return {
        answers,
        usage: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 5, cacheWriteTokens: 0 },
        model: 'stub-1.2',
      }
    } finally {
      this.inFlight--
    }
  }
  protected price(u: Usage) {
    return u.inputTokens * 1e-6
  }
}

const yes = (id: string): Question => ({ id, kind: 'yesno', instructions: `is ${id}?` })
const allYes = async (qs: Question[]) =>
  Object.fromEntries(qs.map((q) => [q.id, yesNoAnswer(0.9, 'heuristic')]))

describe('answers', () => {
  it('confidence is TypeSafe’s (n·max − 1)/(n − 1): the docs’ worked example gives 0.81 for 0.88/0.12/0', () => {
    // docs.typesafe.ai/api.md, Choice answer example: probabilities 0.88/0.12/0.0 → confidence 0.81 (rounded)
    expect(peakConfidence([0.88, 0.12, 0])).toBeCloseTo(0.82, 2)
    expect(peakConfidence([1, 0, 0])).toBe(1)
    expect(peakConfidence([1 / 3, 1 / 3, 1 / 3])).toBeCloseTo(0, 9)
    expect(peakConfidence([0.5, 0.5])).toBe(0)
  })

  it('normalises weights, uniform when nothing is positive', () => {
    expect(normalize([2, 2])).toEqual([0.5, 0.5])
    expect(normalize([0, Number.NaN, -1])).toEqual([1 / 3, 1 / 3, 1 / 3])
  })

  it('choice picks the argmax; score is the probability-weighted level scaled to 0..1', () => {
    const c = choiceAnswer(
      { id: 'c', kind: 'choice', instructions: 'x', options: { a: null, b: null, c: null } },
      { a: 1, b: 3, c: 0 },
      'heuristic',
    )
    expect(c).toMatchObject({ choice: 'b', probabilities: { a: 0.25, b: 0.75, c: 0 } })
    // docs.typesafe.ai/primitives/score.md: 0×0 + 1×0.57 + 2×0.43 = 1.43
    const s = scoreAnswer(
      { id: 's', kind: 'score', instructions: 'x', levels: ['a', 'b', 'c'] },
      [0, 0.57, 0.43],
      'calibrated',
    )
    expect(s.level).toBeCloseTo(1.43, 6)
    expect(s.score).toBeCloseTo(0.715, 6)
    expect(yesNoAnswer(0.2, 'calibrated')).toMatchObject({ p: 0.2, confidence: 0.6 })
  })

  it('rejects questions that cannot be sent anywhere, as non-retryable bad_request', () => {
    const bad: Question[][] = [
      [],
      [yes('a'), yes('a')],
      [{ id: 'has space', kind: 'yesno', instructions: 'x' }],
      [{ id: 'c', kind: 'choice', instructions: 'x', options: { only: null } }],
      [{ id: 's', kind: 'score', instructions: 'x', levels: Array.from({ length: 11 }, (_, i) => `l${i}`) }],
      [
        {
          id: 'e',
          kind: 'extract',
          instructions: 'x',
          candidates: Array.from({ length: 255 }, (_, i) => `c${i}`),
        },
      ],
      [{ id: 'n', kind: 'yesno', instructions: '  ' }],
    ]
    for (const qs of bad) {
      let err: unknown
      try {
        validateQuestions(qs)
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(LlmError)
      expect(err).toMatchObject({ code: 'bad_request', retryable: false })
    }
  })

  it('derives extraction candidates from sentences and lines of any state shape, deduplicated', () => {
    expect(deriveCandidates('We pay 120k. We pay 120k.\nRemote is fine!')).toEqual([
      'We pay 120k.',
      'Remote is fine!',
    ])
    expect(deriveCandidates({ turns: [{ speaker: 'Ana', text: 'Hi there. Team of six.' }] })).toEqual([
      'Hi there.',
      'Team of six.',
    ])
  })
})

describe('BaseDecisionProvider', () => {
  it('splits into batches, runs them concurrently (bounded), and merges answers + usage + cost', async () => {
    const p = new Stub(
      async (qs) => {
        await new Promise((r) => setTimeout(r, 5))
        return allYes(qs)
      },
      { perCall: 3, concurrency: 2 },
    )
    const qs = Array.from({ length: 8 }, (_, i) => yes(`q${i}`))
    const r = await p.decide({ state: 's', questions: qs })
    expect(p.calls.map((c) => c.length)).toEqual([3, 3, 2])
    expect(p.maxInFlight).toBe(2)
    expect(Object.keys(r.answers)).toEqual(qs.map((q) => q.id))
    expect(r.usage).toEqual({ inputTokens: 300, outputTokens: 30, cacheReadTokens: 15, cacheWriteTokens: 0 })
    expect(r.costUsd).toBeCloseTo(0.0003, 9)
    expect(r).toMatchObject({ provider: 'local', model: 'stub-1.2', calls: 3, retries: 0 })
  })

  it('retries retryable failures (honouring retry-after), then succeeds', async () => {
    const delays: number[] = []
    const p = new Stub(
      async (qs, attempt) => {
        if (attempt === 0) throw new LlmError('rate_limited', '429', { retryAfterMs: 30 })
        if (attempt === 1) throw new LlmError('server', '500')
        return allYes(qs)
      },
      { retryDelayMs: (n) => (delays.push(n), 1) },
    )
    const t0 = performance.now()
    const r = await p.decide({ state: 's', questions: [yes('a')] })
    expect(r).toMatchObject({ calls: 3, retries: 2 })
    expect(performance.now() - t0).toBeGreaterThanOrEqual(29)
    expect(delays).toEqual([0, 1])
  })

  it('gives up after maxRetries, and never retries non-retryable errors', async () => {
    const flaky = new Stub(
      async () => {
        throw new LlmError('overloaded', '529')
      },
      { maxRetries: 2 },
    )
    await expect(flaky.decide({ state: 's', questions: [yes('a')] })).rejects.toMatchObject({
      code: 'overloaded',
    })
    expect(flaky.attempts).toBe(3)
    for (const code of ['auth', 'bad_request', 'quota', 'permission'] as const) {
      const p = new Stub(async () => {
        throw new LlmError(code, code)
      })
      await expect(p.decide({ state: 's', questions: [yes('a')] })).rejects.toMatchObject({ code })
      expect(p.attempts).toBe(1)
    }
  })

  it('times out per attempt (as `timeout`, retried), even when the call ignores its signal', async () => {
    const p = new Stub(() => new Promise(() => {}), { timeoutMs: 20, maxRetries: 1 })
    const t0 = performance.now()
    await expect(p.decide({ state: 's', questions: [yes('a')] })).rejects.toMatchObject({
      code: 'timeout',
      retryable: true,
    })
    expect(p.attempts).toBe(2)
    expect(performance.now() - t0).toBeLessThan(500)
  })

  it('cancels promptly on the caller’s signal (as `aborted`, not retried), and refuses an aborted signal up front', async () => {
    let sawAbort = false
    const p = new Stub(
      (_qs, _a, signal) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            sawAbort = true
            reject(new Error('socket closed'))
          })
        }),
      { timeoutMs: 5_000 },
    )
    const ac = new AbortController()
    setTimeout(() => ac.abort(), 10)
    await expect(
      p.decide({ state: 's', questions: [yes('a')] }, { signal: ac.signal }),
    ).rejects.toMatchObject({
      code: 'aborted',
    })
    expect(sawAbort).toBe(true)
    expect(p.attempts).toBe(1)
    await expect(
      p.decide({ state: 's', questions: [yes('a')] }, { signal: ac.signal }),
    ).rejects.toMatchObject({
      code: 'aborted',
    })
    expect(p.attempts).toBe(1)
  })

  it('treats a missing answer, a wrong kind or an unknown option as an invalid (server) response', async () => {
    const q: Question = { id: 'c', kind: 'choice', instructions: 'x', options: { a: null, b: null } }
    const missing = new Stub(async () => ({}), { maxRetries: 0 })
    await expect(missing.decide({ state: 's', questions: [q] })).rejects.toMatchObject({ code: 'server' })
    const wrongKind = new Stub(async () => ({ c: yesNoAnswer(1, 'heuristic') }), { maxRetries: 0 })
    await expect(wrongKind.decide({ state: 's', questions: [q] })).rejects.toThrow(/answered as yesno/)
    const unknown = new Stub(
      async () => ({
        c: { kind: 'choice', choice: 'z', probabilities: {}, confidence: 1, source: 'heuristic' } as Answer,
      }),
      { maxRetries: 0 },
    )
    await expect(unknown.decide({ state: 's', questions: [q] })).rejects.toThrow(/unknown option/)
  })
})
