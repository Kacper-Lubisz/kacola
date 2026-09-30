import { z } from 'zod'

// Agendas wave 1B — the decision layer's settings. Typed decisions (item status, relevance, injection
// guardrail, next talking point, interview answers) run on a DecisionProvider chosen here, separately
// from the text LLM (`llm`): jev = TypeSafe AI's Jev (calibrated), openai / anthropic / ollama = a general
// LLM with structured output, local = the on-device embedder + rules (offline, always available).

export const DecisionsProvider = z.enum(['jev', 'openai', 'anthropic', 'ollama', 'local'])
export type DecisionsProvider = z.infer<typeof DecisionsProvider>

/** Which keyring account / env key each keyed decisions provider uses. */
export const DECISIONS_KEY_ACCOUNT = { jev: 'typesafe', openai: 'openai', anthropic: 'anthropic' } as const

export const DecisionsSettings = z.object({
  provider: DecisionsProvider,
  /** Empty = the provider's default decision model. */
  model: z.string(),
  /** Read-only: whether the selected provider's key is in the keyring / env (keys never cross the wire). */
  apiKeyConfigured: z.boolean(),
})
export type DecisionsSettings = z.infer<typeof DecisionsSettings>

export const StoredDecisionsSettings = DecisionsSettings.omit({ apiKeyConfigured: true })
export type StoredDecisionsSettings = z.infer<typeof StoredDecisionsSettings>

export const DEFAULT_DECISIONS: StoredDecisionsSettings = { provider: 'local', model: '' }

/** `/health` block: which provider answers decisions, whether it can, and why not. */
export const DecisionsHealth = z.object({
  provider: DecisionsProvider,
  model: z.string(),
  ready: z.boolean(),
  /** e.g. `on-device model not downloaded: hashing fallback`, `no TYPESAFE_API_KEY`. */
  detail: z.string().nullable(),
})
export type DecisionsHealth = z.infer<typeof DecisionsHealth>
