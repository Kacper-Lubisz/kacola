import {
  DEFAULT_SPEAKER_SETTINGS,
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
  speakers: DEFAULT_SPEAKER_SETTINGS,
}

/** Section-wise merge; unknown keys dropped by the schema, missing ones filled from `base`. */
export function mergeSettings(
  base: StoredSettings,
  patch: SettingsPatch | Partial<StoredSettings>,
): StoredSettings {
  return StoredSettings.parse({
    llm: { ...base.llm, ...patch.llm },
    stt: { ...base.stt, ...patch.stt },
    capture: { ...base.capture, ...patch.capture },
    retention: { ...base.retention, ...patch.retention },
    speakers: { ...DEFAULT_SPEAKER_SETTINGS, ...base.speakers, ...patch.speakers },
  })
}

/**
 * Settings persisted through the store (so changes are durable events), with the API key kept out of
 * it entirely: it lives in the environment or the keyring, and only a boolean ever leaves this class.
 */
export class SettingsService {
  private readonly store: Store
  private readonly keyring: Keyring
  private readonly envKey: string | null
  private readonly logger: Logger
  private cachedKeyringKey: string | null | undefined

  constructor(deps: { store: Store; keyring: Keyring; env: NodeJS.ProcessEnv; logger: Logger }) {
    this.store = deps.store
    this.keyring = deps.keyring
    this.logger = deps.logger
    this.envKey = deps.env.ANTHROPIC_API_KEY?.trim() || null
    this.logger.addSecret(this.envKey)
  }

  get(): StoredSettings {
    const stored = this.store.getSettings()
    return stored ? mergeSettings(DEFAULT_SETTINGS, stored) : DEFAULT_SETTINGS
  }

  async view(): Promise<Settings> {
    const s = this.get()
    return { ...s, llm: { ...s.llm, apiKeyConfigured: (await this.apiKey()) !== null } }
  }

  async patch(p: SettingsPatch): Promise<Settings> {
    const next = mergeSettings(this.get(), p)
    this.store.putSettings(next)
    this.logger.info('settings updated', { sections: Object.keys(p) })
    return this.view()
  }

  /** The key the LLM should use: the environment wins, then the keyring. */
  async apiKey(): Promise<string | null> {
    if (this.envKey) return this.envKey
    if (this.cachedKeyringKey === undefined) {
      try {
        this.cachedKeyringKey = await this.keyring.get()
      } catch (err) {
        this.logger.warn('keyring lookup failed', { err: err instanceof Error ? err.message : String(err) })
        return null
      }
      this.logger.addSecret(this.cachedKeyringKey)
    }
    return this.cachedKeyringKey
  }

  async setApiKey(key: string | null): Promise<{ configured: boolean }> {
    const k = key?.trim() ?? null
    if (key !== null && !k) throw new DaemonError('bad_request', 'key must not be blank')
    this.logger.addSecret(k)
    try {
      if (k) await this.keyring.set(k)
      else await this.keyring.clear()
    } catch (err) {
      this.logger.error('keyring write failed', { err: err instanceof Error ? err.message : String(err) })
      throw new DaemonError('unavailable', 'the keyring is not available')
    }
    this.cachedKeyringKey = k
    this.logger.info(k ? 'api key stored in keyring' : 'api key cleared from keyring')
    return { configured: (await this.apiKey()) !== null }
  }
}
