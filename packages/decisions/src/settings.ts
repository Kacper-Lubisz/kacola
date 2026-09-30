import { AnthropicDecisionProvider, DEFAULT_ANTHROPIC_DECISION_MODEL } from './anthropic.ts'
import { DEFAULT_JEV_MODEL, JevDecisionProvider } from './jev.ts'
import { type Embedder, HashingEmbedder } from './local/embedder.ts'
import { LocalDecisionProvider, type LocalRule } from './local/provider.ts'
import { DEFAULT_OLLAMA_DECISION_MODEL, OllamaDecisionProvider } from './ollama.ts'
import { DEFAULT_OPENAI_DECISION_MODEL, OpenAIDecisionProvider } from './openai.ts'
import { AGENDA_RULES } from './tasks/index.ts'
import type { DecisionProvider } from './types.ts'

export type DecisionsProviderName = 'jev' | 'openai' | 'anthropic' | 'ollama' | 'local'

/** Structural copy of protocol `Settings['decisions']` (kept local so this package stays usable alone). */
export type DecisionsSettingsInput = { provider: DecisionsProviderName; model: string; ollamaUrl?: string }

export const DEFAULT_DECISION_MODELS: Record<DecisionsProviderName, string> = {
  jev: DEFAULT_JEV_MODEL,
  openai: DEFAULT_OPENAI_DECISION_MODEL,
  anthropic: DEFAULT_ANTHROPIC_DECISION_MODEL,
  ollama: DEFAULT_OLLAMA_DECISION_MODEL,
  local: '',
}

/** Env var each keyed provider's key can come from (the keyring is the other source). */
export const DECISION_KEY_ENV = {
  jev: 'TYPESAFE_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
} as const

export type DecisionProviderDeps = {
  apiKey?: string | null
  fetch?: typeof fetch
  /** For `local`: the MiniLM embedder when installed; the hashing embedder otherwise. */
  embedder?: Embedder
  /** For `local`: rules by question tag. Default: the agenda tasks' rules. */
  rules?: readonly LocalRule[]
}

/** The provider the settings ask for, or null when a keyed provider has no key. */
export function decisionProviderFromSettings(
  s: DecisionsSettingsInput,
  deps: DecisionProviderDeps = {},
): DecisionProvider | null {
  const model = s.model || DEFAULT_DECISION_MODELS[s.provider]
  const f = deps.fetch ? { fetch: deps.fetch } : {}
  switch (s.provider) {
    case 'jev':
      return deps.apiKey ? new JevDecisionProvider({ apiKey: deps.apiKey, model, ...f }) : null
    case 'openai':
      return deps.apiKey ? new OpenAIDecisionProvider({ apiKey: deps.apiKey, model, ...f }) : null
    case 'anthropic':
      return new AnthropicDecisionProvider({ model, ...(deps.apiKey ? { apiKey: deps.apiKey } : {}), ...f })
    case 'ollama':
      return new OllamaDecisionProvider({ model, ...(s.ollamaUrl ? { url: s.ollamaUrl } : {}), ...f })
    case 'local':
      return new LocalDecisionProvider({
        embedder: deps.embedder ?? new HashingEmbedder(),
        rules: deps.rules ?? AGENDA_RULES,
      })
  }
}
