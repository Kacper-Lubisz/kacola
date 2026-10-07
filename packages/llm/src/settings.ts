import type { Settings } from '@kacola/protocol'
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from './anthropic.ts'
import { OllamaProvider } from './ollama.ts'
import { DEFAULT_OPENAI_MODEL, OpenAIProvider } from './openai.ts'
import type { LlmProvider } from './types.ts'

export type ProviderDeps = {
  /** From libsecret / env. Omit to let the SDK resolve credentials itself. */
  apiKey?: string
  fetch?: typeof fetch
}

/** Each provider's model when the settings name none (or name another provider's). */
export const DEFAULT_MODELS: Record<Settings['llm']['provider'], string> = {
  anthropic: DEFAULT_ANTHROPIC_MODEL,
  openai: DEFAULT_OPENAI_MODEL,
  ollama: 'llama3.1',
  none: '',
}

/** Build the provider the settings ask for, or null when Q&A is switched off (or a keyed provider has no key). */
export function providerFromSettings(llm: Settings['llm'], deps: ProviderDeps = {}): LlmProvider | null {
  switch (llm.provider) {
    case 'none':
      return null
    case 'ollama':
      return new OllamaProvider({
        model: llm.model,
        ...(llm.ollamaUrl ? { url: llm.ollamaUrl } : {}),
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
      })
    case 'openai':
      // Unlike the Anthropic SDK, there is no ambient credential lookup here: no key, no provider.
      if (!deps.apiKey) return null
      return new OpenAIProvider({
        model: llm.model || DEFAULT_OPENAI_MODEL,
        apiKey: deps.apiKey,
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
      })
    case 'anthropic':
      return new AnthropicProvider({
        model: llm.model || DEFAULT_ANTHROPIC_MODEL,
        ...(deps.apiKey !== undefined ? { apiKey: deps.apiKey } : {}),
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
      })
  }
}
