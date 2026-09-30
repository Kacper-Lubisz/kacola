import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { LlmError } from '@gnomeola/llm'
import type { DecideOptions, DecisionProvider, DecisionRequest, DecisionResult } from './types.ts'

// Decision cassettes: record what a provider answered for each request, replay it later without the
// network. Keyed by a hash of the canonical request (state + questions), so a changed prompt or question
// misses loudly instead of replaying a stale answer. Used by the evals' deterministic offline mode.

export type Cassette = {
  provider: string
  model: string
  recordedAt: string
  entries: Record<string, DecisionResult>
}

/** Canonical JSON: object keys sorted, so equal requests hash equal. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object')
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(',')}}`
  return JSON.stringify(v)
}

export const requestKey = (req: DecisionRequest) =>
  createHash('sha256').update(canonical(req)).digest('hex').slice(0, 24)

export function loadCassette(path: string): Cassette | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Cassette) : null
}

export function saveCassette(path: string, c: Cassette): void {
  mkdirSync(dirname(path), { recursive: true })
  const sorted = Object.fromEntries(Object.entries(c.entries).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(path, `${JSON.stringify({ ...c, entries: sorted }, null, 1)}\n`)
}

/** Answers from a cassette; a request it has not seen is an error (`not_found`), never a guess. */
export class ReplayDecisionProvider implements DecisionProvider {
  readonly id = 'replay' as const
  readonly model: string
  readonly confidence
  readonly maxQuestionsPerCall = Number.POSITIVE_INFINITY
  readonly #c: Cassette
  constructor(cassette: Cassette, confidence: DecisionProvider['confidence'] = 'self-reported') {
    this.#c = cassette
    this.model = `${cassette.provider}:${cassette.model}`
    this.confidence = confidence
  }
  async decide(req: DecisionRequest, opts: DecideOptions = {}): Promise<DecisionResult> {
    if (opts.signal?.aborted) throw new LlmError('aborted', 'request aborted')
    const hit = this.#c.entries[requestKey(req)]
    if (!hit) throw new LlmError('not_found', `no recorded decision for this request (${requestKey(req)})`)
    return hit
  }
}

/** Wraps a live provider and records every result into `cassette`. */
export class RecordingDecisionProvider implements DecisionProvider {
  readonly id
  readonly model
  readonly confidence
  readonly maxQuestionsPerCall
  readonly cassette: Cassette
  readonly #inner: DecisionProvider
  constructor(inner: DecisionProvider) {
    this.#inner = inner
    this.id = inner.id
    this.model = inner.model
    this.confidence = inner.confidence
    this.maxQuestionsPerCall = inner.maxQuestionsPerCall
    this.cassette = {
      provider: inner.id,
      model: inner.model,
      recordedAt: new Date().toISOString(),
      entries: {},
    }
  }
  async decide(req: DecisionRequest, opts?: DecideOptions): Promise<DecisionResult> {
    const r = await this.#inner.decide(req, opts)
    this.cassette.entries[requestKey(req)] = r
    return r
  }
}
