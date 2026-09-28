import type { Settings } from '@gnomeola/protocol'
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from './anthropic.ts'
import { OllamaProvider } from './ollama.ts'
import type { LlmProvider } from './types.ts'

export type ProviderDeps = {
  /** From libsecret / env. Omit to let the SDK resolve credentials itself. */
  apiKey?: string
  fetch?: typeof fetch
}

/** Build the provider the settings ask for, or null when Q&A is switched off. */
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
    case 'anthropic':
      return new AnthropicProvider({
        model: llm.model || DEFAULT_ANTHROPIC_MODEL,
        ...(deps.apiKey !== undefined ? { apiKey: deps.apiKey } : {}),
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
      })
  }
}
