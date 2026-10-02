// The tracker's decision logic in isolation (tracker-logic.ts): the owner rule (the user's own line counts
// one step less on what they asked about), sustained-evidence aggregation across rounds, and the status
// round applying both — on a scripted provider, so each case states exactly what the model answered.
import {
  type Answer,
  choiceAnswer,
  type DecisionProvider,
  type DecisionRequest,
  extractAnswer,
  type PolicyAction,
  type StatusDecision,
  statusQuestions,
  type TranscriptLine,
  yesNoAnswer,
} from '@gnomeola/decisions'
import { describe, expect, it } from 'vitest'
import {
  aggregate,
  type ItemVerdict,
  type LiveItem,
  ownerDemoted,
  statusRound,
} from '../src/agendas/tracker-logic.ts'

const item = (id: string, kind: LiveItem['kind'], status: LiveItem['status'] = 'open'): LiveItem => ({
  id,
  text: `item ${id}`,
  kind,
  status,
  manual: false,
  changedBy: 'user',
  outcome: null,
})

/** Answers each status question with P(covered) = `p[i]` and the evidence line `ev[i]` (by text). */
function scripted(p: number[], ev: (string | null)[]): DecisionProvider & { requests: DecisionRequest[] } {
  const requests: DecisionRequest[] = []
  return {
    id: 'jev',
    model: 'scripted',
    confidence: 'calibrated',
    maxQuestionsPerCall: 64,
    requests,
    async decide(req) {
      requests.push(req)
      const answers: Record<string, Answer> = {}
      for (const q of req.questions) {
        const i = Number(q.id.split('.')[1])
        if (q.kind === 'choice')
          answers[q.id] = choiceAnswer(
            q,
            { covered: p[i]!, in_progress: (1 - p[i]!) * 0.9, not_started: (1 - p[i]!) * 0.1 },
            'calibrated',
          )
        else if (q.kind === 'extract')
          // answer values (no candidates): none heard, so the status round's evidence stands
          answers[q.id] = extractAnswer(q, !q.candidates ? null : (ev[i] ?? null), 0.9, 'calibrated')
        // the interview question "answered?" (info-to-get items): as sure as the status round
        else if (q.kind === 'yesno') answers[q.id] = yesNoAnswer(p[0]!, 'calibrated')
      }
      return {
        answers,
        provider: 'jev',
        model: 'scripted',
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        costUsd: 0,
        latencyMs: 0,
        calls: 1,
        retries: 0,
      }
    },
  }
}

const window: TranscriptLine[] = [
  { id: 'l1', speaker: 'me', text: 'How big is the engineering team these days?' },
  { id: 'l2', speaker: 'Speaker 1', text: 'We are about forty engineers in five teams.' },
  { id: 'l3', speaker: 'me', text: 'At my last job we ran everything on Kubernetes and Go.' },
]

describe('the owner rule: the user’s own line counts one step less on what they asked about', () => {
  const auto: PolicyAction = { kind: 'auto-covered', evidence: { lineId: 'l1', quote: 'x', confidence: 0.9 } }
  it('demotes a check-off to a suggestion and a suggestion to in progress (or nothing once in progress)', () => {
    expect(ownerDemoted(auto, 'in_progress', true)).toEqual({ kind: 'suggest-covered' })
    expect(ownerDemoted({ kind: 'suggest-covered' }, 'not_started', true)).toEqual({ kind: 'in-progress' })
    expect(ownerDemoted({ kind: 'suggest-covered' }, 'in_progress', true)).toEqual({ kind: 'none' })
    expect(ownerDemoted({ kind: 'in-progress' }, 'not_started', true)).toEqual({ kind: 'in-progress' })
    expect(ownerDemoted(auto, 'in_progress', false)).toBe(auto)
  })

  it('a status round: the far end’s answer checks a question off; the user’s own line about it does not', async () => {
    const items = [item('team', 'question'), item('stack', 'info-to-get'), item('ship', 'decision')]
    // team: answered by the far end; stack: only the user talked about it; ship: a decision the user settles
    const p = scripted([0.9, 0.9, 0.9], [window[1]!.text, window[2]!.text, window[2]!.text])
    const { verdicts } = await statusRound(p, { items, window, owner: 'me' })
    const by = (id: string) => verdicts.find((v) => v.itemId === id)!
    expect(by('team').action.kind).toBe('auto-covered')
    expect(by('stack').action.kind).toBe('suggest-covered')
    // decisions, topics, must-covers: the user's own word can settle them
    expect(by('ship').action.kind).toBe('auto-covered')
  })

  it('a suggestion on the user’s own line becomes in progress', async () => {
    const p = scripted([0.65], [window[2]!.text])
    const { verdicts } = await statusRound(p, { items: [item('stack', 'question')], window })
    expect(verdicts[0]!.action.kind).toBe('in-progress')
  })

  it('tells the status question who `me` is, only for asked items and only when they spoke', () => {
    const items = [item('team', 'question'), item('ship', 'decision')]
    const qs = statusQuestions({ items, window, owner: 'me' }).questions
    expect(qs.find((q) => q.id === 'status.0')!.instructions).toContain('Speaker "me" owns this agenda')
    expect(qs.find((q) => q.id === 'status.1')!.instructions).not.toContain('owns this agenda')
    const farOnly = statusQuestions({ items, window: [window[1]!], owner: 'me' }).questions
    expect(farOnly[0]!.instructions).not.toContain('owns this agenda')
    expect(statusQuestions({ items, window }).questions[0]!.instructions).not.toContain('owns this agenda')
  })
})

describe('sustained evidence: strong rounds on different lines add up to a check-off', () => {
  const v = (p: number, line: string | null, kind: ItemVerdict['action']['kind'] = 'suggest-covered') =>
    ({
      itemId: 'team',
      pCovered: p,
      action:
        kind === 'auto-covered'
          ? { kind, evidence: { lineId: line!, quote: 'q', confidence: 0.9 } }
          : ({ kind } as PolicyAction),
      evidence: line ? { lineId: line, quote: 'q', confidence: 0.9 } : null,
      answer: null,
      status: {} as StatusDecision,
      interview: null,
    }) satisfies ItemVerdict
  const ctx = {
    items: new Map([['team', { kind: 'question' as const }]]),
    speakerOf: new Map([
      ['a', 'Speaker 1'],
      ['b', 'Speaker 1'],
      ['m', 'me'],
    ]),
  }
  const o = { p: 0.7, rounds: 2 }

  it('two rounds ≥ p pointing at different lines check the item off, marked aggregated', () => {
    const s = new Map()
    expect(aggregate(s, [v(0.72, 'a')], o, ctx)[0]!.action.kind).toBe('suggest-covered')
    const out = aggregate(s, [v(0.74, 'b')], o, ctx)[0]!
    expect(out.action).toEqual({
      kind: 'auto-covered',
      evidence: { lineId: 'b', quote: 'q', confidence: 0.9 },
    })
    expect(out.aggregated).toBe(true)
    expect(s.has('team')).toBe(false)
  })

  it('the same line twice is one piece of evidence', () => {
    const s = new Map()
    aggregate(s, [v(0.75, 'a')], o, ctx)
    expect(aggregate(s, [v(0.78, 'a')], o, ctx)[0]!.action.kind).toBe('suggest-covered')
  })

  it('a weaker round, a round without evidence, or the user’s own line ends the run', () => {
    for (const breaker of [v(0.6, 'b'), v(0.75, null), v(0.75, 'm')]) {
      const s = new Map()
      aggregate(s, [v(0.75, 'a')], o, ctx)
      aggregate(s, [breaker], o, ctx)
      expect(aggregate(s, [v(0.75, 'b')], o, ctx)[0]!.action.kind).toBe('suggest-covered')
    }
  })

  it('leaves check-offs and quiet verdicts alone', () => {
    const s = new Map()
    const tick = v(0.9, 'a', 'auto-covered')
    expect(aggregate(s, [tick], o, ctx)[0]).toBe(tick)
    const none = v(0.1, null, 'none')
    expect(aggregate(s, [none], o, ctx)[0]).toBe(none)
  })
})
