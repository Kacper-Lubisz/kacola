import {
  DECISIONS_KEY_ACCOUNT,
  DEFAULT_AUTO_RECORD,
  DEFAULT_DECISIONS,
  DEFAULT_SPEAKER_SETTINGS,
  isKeyedProvider,
  type KeyedProvider,
  type LlmProvider,
  type Settings,
  type SettingsPatch,
  StoredSettings,
} from '@gnomeola/protocol'
import type { Store } from '@gnomeola/store'
import { DaemonError } from './errors.ts'
import type { Keyring } from './interfaces.ts'
import type { Logger } from './logger.ts'

export const DEFAULT_SETTINGS: StoredSettings = {
  llm: { provider: 'anthropic', model: 'claude-opus-5', ollamaUrl: 'http://127.0.0.1:11434' },
  // The measured defaults from @gnomeola/stt's catalogue (see docs/stt.md).
  stt: {
    liveModel: 'live-nemo-fastconformer-en-80ms-int8',
    finalModel: 'final-parakeet-tdt-110m-en-int8',
    finalPass: 'during',
  },
  capture: { micDevice: 'default', systemDevice: 'default' },
  retention: { audio: 'keep', days: 30, archive: false },
  autoRecord: DEFAULT_AUTO_RECORD,
  speakers: DEFAULT_SPEAKER_SETTINGS,
  decisions: DEFAULT_DECISIONS,
}

/** Each provider's default model (mirrors @gnomeola/llm's DEFAULT_MODELS; the daemon stays SDK-free here). */
export const DEFAULT_LLM_MODELS: Record<LlmProvider, string> = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-5.5',
  ollama: 'llama3.1',
  none: '',
}

/** Where each hosted provider's key can come from in the environment. */
export const KEY_ENV: Record<KeyedProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  typesafe: 'TYPESAFE_API_KEY',
}

/**
 * Defaults for a daemon that has never stored settings: the first hosted provider whose key is in the
 * environment (Anthropic, then OpenAI), else Anthropic — so `OPENAI_API_KEY=… gnomeolad` just works.
 */
export function defaultSettings(env: NodeJS.ProcessEnv = {}): StoredSettings {
  const provider: LlmProvider = env.ANTHROPIC_API_KEY?.trim()
    ? 'anthropic'
    : env.OPENAI_API_KEY?.trim()
      ? 'openai'
      : 'anthropic'
  return {
    ...DEFAULT_SETTINGS,
    llm: { ...DEFAULT_SETTINGS.llm, provider, model: DEFAULT_LLM_MODELS[provider] },
  }
}

/**
 * Section-wise merge; unknown keys dropped by the schema, missing ones filled from `base`. Switching the
 * LLM provider without naming a model picks the new provider's default model — a Claude model name is
 * meaningless to OpenAI and vice versa.
 */
export function mergeSettings(
  base: StoredSettings,
  patch: SettingsPatch | Partial<StoredSettings>,
): StoredSettings {
  const llm = { ...base.llm, ...patch.llm }
  if (
    patch.llm?.provider !== undefined &&
    patch.llm.provider !== base.llm.provider &&
    patch.llm.model === undefined
  )
    llm.model = DEFAULT_LLM_MODELS[llm.provider]
  return StoredSettings.parse({
    llm,
    stt: { ...base.stt, ...patch.stt },
    capture: { ...base.capture, ...patch.capture },
    retention: { ...base.retention, ...patch.retention },
    autoRecord: { ...base.autoRecord, ...patch.autoRecord },
    speakers: { ...DEFAULT_SPEAKER_SETTINGS, ...base.speakers, ...patch.speakers },
    ...(('agents' in patch && patch.agents) || base.agents
      ? { agents: ('agents' in patch && patch.agents) || base.agents }
      : {}),
    decisions: mergeDecisions(base.decisions, patch.decisions),
  })
}

/** Switching the decisions provider without naming a model goes back to that provider's default (''). */
function mergeDecisions(
  base: StoredSettings['decisions'],
  patch: Partial<NonNullable<StoredSettings['decisions']>> | undefined,
): NonNullable<StoredSettings['decisions']> {
  const b = { ...DEFAULT_DECISIONS, ...base }
  const next = { ...b, ...patch }
  if (patch?.provider !== undefined && patch.provider !== b.provider && patch.model === undefined)
    next.model = ''
  return next
}

/**
 * Settings persisted through the store (so changes are durable events), with the API key kept out of
 * it entirely: it lives in the environment or the keyring, and only a boolean ever leaves this class.
 */
export class SettingsService {
  private readonly store: Store
  private readonly keyring: Keyring
  private readonly envKeys: Record<KeyedProvider, string | null>
  private readonly defaults: StoredSettings
  private readonly logger: Logger
  private readonly cachedKeyringKeys = new Map<KeyedProvider, string | null>()

  constructor(deps: { store: Store; keyring: Keyring; env: NodeJS.ProcessEnv; logger: Logger }) {
    this.store = deps.store
    this.keyring = deps.keyring
    this.logger = deps.logger
    this.envKeys = {
      anthropic: deps.env[KEY_ENV.anthropic]?.trim() || null,
      openai: deps.env[KEY_ENV.openai]?.trim() || null,
      typesafe: deps.env[KEY_ENV.typesafe]?.trim() || null,
    }
    for (const k of Object.values(this.envKeys)) this.logger.addSecret(k)
    this.defaults = defaultSettings(deps.env)
  }

  get(): StoredSettings {
    const stored = this.store.getSettings()
    return stored ? mergeSettings(this.defaults, stored) : this.defaults
  }

  async view(): Promise<Settings> {
    const s = this.get()
    const decisions = { ...DEFAULT_DECISIONS, ...s.decisions }
    return {
      ...s,
      llm: { ...s.llm, apiKeyConfigured: (await this.apiKey()) !== null },
      decisions: { ...decisions, apiKeyConfigured: (await this.decisionsApiKey()) !== null },
    }
  }

  /** The key the selected decisions provider uses (TYPESAFE_API_KEY for jev), or null (none / not keyed). */
  async decisionsApiKey(): Promise<string | null> {
    const p = { ...DEFAULT_DECISIONS, ...this.get().decisions }.provider
    const account =
      p in DECISIONS_KEY_ACCOUNT ? DECISIONS_KEY_ACCOUNT[p as keyof typeof DECISIONS_KEY_ACCOUNT] : null
    return account ? this.apiKey(account) : null
  }

  async patch(p: SettingsPatch): Promise<Settings> {
    const next = mergeSettings(this.get(), p)
    this.store.putSettings(next)
    this.logger.info('settings updated', { sections: Object.keys(p) })
    return this.view()
  }

  /** Agent channel: which private sessions agents may attach to (a durable settings.updated, like any). */
  setAgentSettings(agents: NonNullable<StoredSettings['agents']>): StoredSettings {
    const next = mergeSettings(this.get(), { agents })
    this.store.putSettings(next)
    this.logger.info('settings updated', { sections: ['agents'] })
    return next
  }

  /**
   * The key a provider should use (default: the current provider's): its environment variable wins, then
   * the keyring. Null for providers that take no key.
   */
  async apiKey(provider: LlmProvider | KeyedProvider = this.get().llm.provider): Promise<string | null> {
    if (!isKeyedProvider(provider)) return null
    const env = this.envKeys[provider]
    if (env) return env
    if (!this.cachedKeyringKeys.has(provider)) {
      let k: string | null
      try {
        k = await this.keyring.get(provider)
      } catch (err) {
        this.logger.warn('keyring lookup failed', {
          provider,
          err: err instanceof Error ? err.message : String(err),
        })
        return null
      }
      this.logger.addSecret(k)
      this.cachedKeyringKeys.set(provider, k)
    }
    return this.cachedKeyringKeys.get(provider) ?? null
  }

  async setApiKey(key: string | null, provider?: KeyedProvider): Promise<{ configured: boolean }> {
    const current = this.get().llm.provider
    const target = provider ?? (isKeyedProvider(current) ? current : null)
    if (!target)
      throw new DaemonError('bad_request', `the ${current} provider takes no API key; name a provider`)
    const k = key?.trim() ?? null
    if (key !== null && !k) throw new DaemonError('bad_request', 'key must not be blank')
    this.logger.addSecret(k)
    try {
      if (k) await this.keyring.set(k, target)
      else await this.keyring.clear(target)
    } catch (err) {
      this.logger.error('keyring write failed', { err: err instanceof Error ? err.message : String(err) })
      throw new DaemonError('unavailable', 'the keyring is not available')
    }
    this.cachedKeyringKeys.set(target, k)
    this.logger.info(k ? 'api key stored in keyring' : 'api key cleared from keyring', { provider: target })
    return { configured: (await this.apiKey(target)) !== null }
  }
}
