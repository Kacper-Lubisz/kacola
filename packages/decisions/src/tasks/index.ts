import type { LocalRule } from '../local/provider.ts'
import { answeredRule, nextPointRule, relevanceRules } from './live.ts'
import { answerRule, evidenceRule, statusRule } from './status.ts'

export * from './live.ts'
export * from './status.ts'
export * from './text.ts'
export * from './types.ts'

/** The on-device rules for every agenda task; pass them to LocalDecisionProvider (`rules`). */
export const AGENDA_RULES: readonly LocalRule[] = [
  statusRule,
  evidenceRule,
  answerRule,
  answeredRule,
  nextPointRule,
  ...relevanceRules,
]
