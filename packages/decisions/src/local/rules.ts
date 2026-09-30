import { yesNoAnswer } from '../answers.ts'
import type { Answer, Question } from '../types.ts'
import type { LocalRule, RuleContext } from './provider.ts'

// Deterministic rules the on-device provider ships with. Task-specific rules (agenda cues) live with
// the tasks that ask the questions (src/tasks) and are passed in as `rules`.

export const TAG_INJECTION = 'guardrail.injection'

/** Something addressed to an AI system: the audience of an injection. */
const AI_AUDIENCE =
  /\b(ai|a\.i\.|assistant|note-?taker|note taker|bot|co-?pilot|summari[sz]er|language model|llm|agent|claude|chat ?gpt|gpt|gemini|transcriber|model reading)\b/i

/** Classic override phrasing, with or without an addressee. */
const OVERRIDE = [
  /\b(ignore|disregard|forget|override|bypass)\b[^.!?]{0,40}\b(instructions?|prompts?|rules|guidelines|guardrails|system (prompt|message)|programming|directions)\b/i,
  /\b(new|updated|real|actual) instructions?\b\s*[:,-]/i,
  /\byou are now\b|\bpretend (to be|you are)\b|\bdeveloper mode\b|\bjailbreak\b|\bact as (an? )?(unfiltered|unrestricted)\b/i,
  /\bsystem prompt\b|\breveal your (prompt|instructions)\b/i,
]

/** An imperative aimed at the AI's actions in this product (check-off, sending data, deleting). */
const DIRECTIVE =
  /\b(mark|tick|check off|set|flag|delete|erase|remove|send|email|e-mail|forward|upload|share|post|leak|export|approve|reveal|print|output|write down|record|add|cancel|schedule|execute|run|transfer|say)\b/i

/** Reported / hypothetical speech about an injection rather than one. */
const REPORTED =
  /\b(joked|joking|was saying|said that|someone (said|tried)|told me|example of|like when|imagine if|what if someone|prompt injection)\b/i

function injectionProbability(text: string): number {
  const override = OVERRIDE.some((r) => r.test(text))
  const audience = AI_AUDIENCE.test(text)
  const directive =
    audience && DIRECTIVE.test(text) && /\b(to|,|:)\s*\w+|\bplease\b|^\s*(hey|ok|okay|note)\b/i.test(text)
  const reported = REPORTED.test(text)
  let p = 0.04
  if (override && audience) p = 0.95
  else if (override) p = 0.8
  else if (directive) p = 0.7
  else if (audience && /\bnote to\b/i.test(text)) p = 0.6
  if (reported) p = Math.min(p, 0.35)
  return p
}

export const injectionRule: LocalRule = {
  tag: TAG_INJECTION,
  answer(q: Question, ctx: RuleContext): Answer | null {
    if (q.kind !== 'yesno') return null
    return yesNoAnswer(injectionProbability(ctx.text), 'heuristic')
  },
}

export const BUILTIN_RULES: readonly LocalRule[] = [injectionRule]
