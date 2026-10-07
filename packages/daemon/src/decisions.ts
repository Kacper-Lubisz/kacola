import {
  AGENDA_RULES,
  DEFAULT_DECISION_MODELS,
  type DecisionProvider,
  decisionProviderFromSettings,
  type Embedder,
  HashingEmbedder,
  LocalDecisionProvider,
  type LocalRule,
  OnnxEmbedder,
} from '@kacola/decisions'
import { DEFAULT_DECISIONS, type DecisionsHealth, isOnDeviceDecisions } from '@kacola/protocol'
import type { Logger } from './logger.ts'
import type { SettingsService } from './settings.ts'

// Agendas wave 1B — the daemon's handle on the decision layer: builds the DecisionProvider the settings
// select (keys from env / keyring, the on-device embedder from the model manager) and reports it in
// /health. Later waves (tracker, guardrail, next point) call `provider()` per decision round; it is
// cached until the settings, the key or the embedder change. Never throws: no provider = null.

const KEY_ENV = { jev: 'TYPESAFE_API_KEY', openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' } as const

export type DecisionsServiceDeps = {
  settings: SettingsService
  logger: Logger
  /** The installed text-embedding model's directory, or null when it is not downloaded. */
  embedderDir?: () => Promise<string | null>
  fetch?: typeof fetch
  /** Task-layer rules for the local provider (e.g. agenda cues). */
  rules?: readonly LocalRule[]
}

export class DecisionsService {
  readonly #d: DecisionsServiceDeps
  #cached: { key: string; provider: DecisionProvider | null } | null = null
  #local: { embedder: string; provider: DecisionProvider } | null = null
  #embedder: { dir: string; embedder: Embedder } | null = null
  readonly #hashing = new HashingEmbedder()

  constructor(deps: DecisionsServiceDeps) {
    this.#d = deps
  }

  #settings() {
    return { ...DEFAULT_DECISIONS, ...this.#d.settings.get().decisions }
  }

  #failedDir: string | null = null

  async #localEmbedder(): Promise<Embedder> {
    const dir = (await this.#d.embedderDir?.().catch(() => null)) ?? null
    if (!dir) return this.#hashing
    if (this.#embedder?.dir === dir) return this.#embedder.embedder
    // a model that failed to load (e.g. no onnxruntime binary for this platform) stays failed until the
    // model directory changes, instead of retrying the import on every decision
    if (this.#failedDir === dir) return this.#hashing
    try {
      const embedder = await OnnxEmbedder.create(dir)
      this.#embedder = { dir, embedder }
      return embedder
    } catch (err) {
      this.#d.logger.warn('text embedder failed to load; using the hashing fallback', {
        err: err instanceof Error ? err.message : String(err),
      })
      this.#failedDir = dir
      return this.#hashing
    }
  }

  /** The provider the settings select, or null when it cannot run (a keyed provider without its key). */
  async provider(): Promise<DecisionProvider | null> {
    const s = this.#settings()
    const apiKey = await this.#d.settings.decisionsApiKey()
    const embedder = s.provider === 'local' ? await this.#localEmbedder() : null
    const key = `${s.provider}|${s.model}|${apiKey ? 'k' : '-'}|${embedder?.id ?? ''}|${this.#embedder?.dir ?? ''}`
    if (this.#cached?.key === key) return this.#cached.provider
    const provider = decisionProviderFromSettings(
      { provider: s.provider, model: s.model, ollamaUrl: this.#d.settings.get().llm.ollamaUrl },
      {
        apiKey,
        ...(this.#d.fetch ? { fetch: this.#d.fetch } : {}),
        ...(embedder ? { embedder } : {}),
        ...(this.#d.rules ? { rules: this.#d.rules } : {}),
      },
    )
    this.#cached = { key, provider }
    return provider
  }

  /** The selected provider's name. */
  selected(): string {
    return this.#settings().provider
  }

  /** Whether the selected provider keeps data on this computer (private meetings use only such). */
  onDevice(): boolean {
    return isOnDeviceDecisions(this.#settings().provider, this.#d.settings.get().llm.ollamaUrl)
  }

  /** The on-device provider, whatever is selected: the live tracker's fallback when a hosted one fails. */
  async localProvider(): Promise<DecisionProvider> {
    const embedder = await this.#localEmbedder()
    if (this.#local?.embedder !== embedder.id)
      this.#local = {
        embedder: embedder.id,
        provider: new LocalDecisionProvider({ embedder, rules: this.#d.rules ?? AGENDA_RULES }),
      }
    return this.#local.provider
  }

  async health(): Promise<DecisionsHealth> {
    const s = this.#settings()
    const p = await this.provider()
    const model = p?.model ?? (s.model || DEFAULT_DECISION_MODELS[s.provider])
    if (s.provider === 'local')
      return {
        provider: 'local',
        model,
        ready: true,
        detail:
          p?.model === this.#hashing.id
            ? 'on-device embedding model not downloaded: using the hashing fallback'
            : null,
      }
    if (s.provider === 'ollama') return { provider: 'ollama', model, ready: p !== null, detail: null }
    const hasKey = (await this.#d.settings.decisionsApiKey()) !== null
    return {
      provider: s.provider,
      model,
      ready: hasKey && p !== null,
      detail: hasKey ? null : `no ${KEY_ENV[s.provider]} in the environment or keyring`,
    }
  }
}
