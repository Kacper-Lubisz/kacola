export {
  checkAnswers,
  choiceAnswer,
  deriveCandidates,
  extractAnswer,
  MAX_CHOICE_OPTIONS,
  MAX_SCORE_LEVELS,
  normalize,
  peakConfidence,
  scoreAnswer,
  softmax,
  stateText,
  validateQuestions,
  yesNoAnswer,
} from './answers.ts'
export {
  type AnthropicDecisionOptions,
  AnthropicDecisionProvider,
  DECISION_TOOL,
  DEFAULT_ANTHROPIC_DECISION_MODEL,
} from './anthropic.ts'
export { addUsage, BaseDecisionProvider, type BaseOptions, type CallResult } from './base.ts'
export {
  DEFAULT_JEV_MODEL,
  DEFAULT_TYPESAFE_URL,
  JEV_NONE,
  JEV_PRICE_PER_MTOK,
  JevDecisionProvider,
  type JevProviderOptions,
  toJevError,
} from './jev.ts'
export { batchSchema, DECISION_SYSTEM_PROMPT, parseBatch, userPrompt } from './llm-json.ts'
export {
  CachedEmbedder,
  cosine,
  type Embedder,
  HashingEmbedder,
  OnnxEmbedder,
  TEXT_EMBEDDING_MODEL_FILE,
  TEXT_EMBEDDING_MODEL_ID,
} from './local/embedder.ts'
export {
  LocalDecisionProvider,
  type LocalProviderOptions,
  type LocalRule,
  type RuleContext,
} from './local/provider.ts'
export { BUILTIN_RULES, injectionRule, TAG_INJECTION } from './local/rules.ts'
export { VOCAB_SHA256, WordPieceTokenizer } from './local/wordpiece.ts'
export {
  DEFAULT_OLLAMA_DECISION_MODEL,
  type OllamaDecisionOptions,
  OllamaDecisionProvider,
} from './ollama.ts'
export {
  applyLogprobs,
  DEFAULT_OPENAI_DECISION_MODEL,
  type OpenAIDecisionOptions,
  OpenAIDecisionProvider,
  supportsLogprobs,
} from './openai.ts'
export {
  type Cassette,
  canonical,
  loadCassette,
  RecordingDecisionProvider,
  ReplayDecisionProvider,
  requestKey,
  saveCassette,
} from './replay.ts'
export {
  DECISION_KEY_ENV,
  DEFAULT_DECISION_MODELS,
  type DecisionProviderDeps,
  type DecisionsProviderName,
  type DecisionsSettingsInput,
  decisionProviderFromSettings,
} from './settings.ts'
export type * from './types.ts'
