import { Store } from '@kacola/store'
import { describe, expect, it } from 'vitest'
import { MemoryKeyring } from '../src/keyring.ts'
import { Logger } from '../src/logger.ts'
import {
  DEFAULT_LLM_MODELS,
  DEFAULT_SETTINGS,
  defaultSettings,
  mergeSettings,
  SettingsService,
} from '../src/settings.ts'

// The generic LLM layer's daemon side: one key per hosted provider (env first, then keyring), defaults
// that follow whichever key the environment has, and a provider switch that never leaves the previous
// provider's model name behind.

const service = (env: NodeJS.ProcessEnv = {}, keyring = new MemoryKeyring()) =>
  new SettingsService({ store: Store.open(':memory:'), keyring, env, logger: new Logger() })

describe('LLM provider settings', () => {
  it('defaults follow the environment: Anthropic key → anthropic, only OpenAI key → openai, none → anthropic', () => {
    expect(defaultSettings({}).llm).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5' })
    expect(defaultSettings({ OPENAI_API_KEY: 'sk-o' }).llm).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.5',
    })
    expect(defaultSettings({ OPENAI_API_KEY: 'sk-o', ANTHROPIC_API_KEY: 'sk-a' }).llm.provider).toBe(
      'anthropic',
    )
    expect(defaultSettings({ OPENAI_API_KEY: '   ' }).llm.provider).toBe('anthropic') // blank is absent
  })

  it("switching provider without naming a model takes the new provider's default; naming one keeps it", () => {
    const openai = mergeSettings(DEFAULT_SETTINGS, { llm: { provider: 'openai' } })
    expect(openai.llm).toMatchObject({ provider: 'openai', model: DEFAULT_LLM_MODELS.openai })
    expect(
      mergeSettings(DEFAULT_SETTINGS, { llm: { provider: 'openai', model: 'gpt-5-mini' } }).llm.model,
    ).toBe('gpt-5-mini')
    // re-stating the same provider is not a switch: a custom model survives
    const custom = mergeSettings(openai, { llm: { model: 'gpt-6-sol' } })
    expect(mergeSettings(custom, { llm: { provider: 'openai' } }).llm.model).toBe('gpt-6-sol')
    expect(mergeSettings(custom, { llm: { provider: 'none' } }).llm.model).toBe('')
  })

  it('each provider has its own key: env wins over keyring, and apiKeyConfigured follows the current provider', async () => {
    const s = service(
      { OPENAI_API_KEY: 'sk-env-openai' },
      new MemoryKeyring('sk-ring-anthropic', { openai: 'sk-ring-openai' }),
    )
    expect(await s.apiKey('openai')).toBe('sk-env-openai')
    expect(await s.apiKey('anthropic')).toBe('sk-ring-anthropic')
    expect(await s.apiKey('ollama')).toBeNull()
    expect((await s.view()).llm).toMatchObject({ provider: 'openai', apiKeyConfigured: true })
    expect(await s.apiKey()).toBe('sk-env-openai')
    await s.patch({ llm: { provider: 'ollama' } })
    expect((await s.view()).llm.apiKeyConfigured).toBe(false)
  })

  it("setApiKey stores the current provider's key by default, or the one named, without touching the other", async () => {
    const ring = new MemoryKeyring()
    const s = service({}, ring)
    await s.patch({ llm: { provider: 'openai' } })
    expect(await s.setApiKey('sk-o')).toEqual({ configured: true })
    expect(await ring.get('openai')).toBe('sk-o')
    expect(await ring.get('anthropic')).toBeNull()
    expect(await s.setApiKey('sk-a', 'anthropic')).toEqual({ configured: true })
    expect(await s.apiKey('anthropic')).toBe('sk-a')
    expect(await s.setApiKey(null)).toEqual({ configured: false }) // clears openai only
    expect(await s.apiKey('openai')).toBeNull()
    expect(await s.apiKey('anthropic')).toBe('sk-a')
    await s.patch({ llm: { provider: 'ollama' } })
    await expect(s.setApiKey('x')).rejects.toMatchObject({ code: 'bad_request' })
  })
})
