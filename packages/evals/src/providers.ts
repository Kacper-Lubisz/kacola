import {
  AGENDA_RULES,
  AnthropicDecisionProvider,
  contentWords,
  type DecisionProvider,
  HashingEmbedder,
  JevDecisionProvider,
  LocalDecisionProvider,
  OllamaDecisionProvider,
  OnnxEmbedder,
  OpenAIDecisionProvider,
  overlap,
} from '@gnomeola/decisions'
import { LlmError } from '@gnomeola/llm'
import { type EvalMode, findTextEmbedder, NO_EMBEDDER_REASON } from '@gnomeola/testkit/evals'
import {
  type Brain,
  startFakeAnthropicDecisions,
  startFakeOllama,
  startFakeOpenAI,
  startFakeTypeSafe,
} from '@gnomeola/testkit/fake-decisions'

// The provider matrix the eval runs iterate over, per mode:
//   offline  local + hashing embedder (always), local + MiniLM (when installed) — real, deterministic numbers
//   fake     jev / openai / anthropic / ollama against local fakes with a trivial lexical "brain": tests the
//            providers' HTTP, parsing and the suites end to end; the numbers mean nothing about quality
//   live     each hosted provider whose key is in the environment (TYPESAFE_API_KEY, OPENAI_API_KEY,
//            ANTHROPIC_API_KEY; Ollama with GNOMEOLA_EVAL_OLLAMA_URL) — skipped with the reason otherwise

export type ProviderSetup = {
  label: string
  mode: EvalMode
  provider: DecisionProvider | null
  /** Why this provider cannot run here (no key, model not installed); null when it can. */
  skip: string | null
  close?: () => Promise<void>
}

export async function offlineProviders(): Promise<ProviderSetup[]> {
  const out: ProviderSetup[] = [
    {
      label: 'local-hashing',
      mode: 'offline',
      provider: new LocalDecisionProvider({ embedder: new HashingEmbedder(), rules: AGENDA_RULES }),
      skip: null,
    },
  ]
  const dir = findTextEmbedder()
  out.push(
    dir
      ? {
          label: 'local-minilm',
          mode: 'offline',
          provider: new LocalDecisionProvider({
            embedder: await OnnxEmbedder.create(dir),
            rules: AGENDA_RULES,
          }),
          skip: null,
        }
      : { label: 'local-minilm', mode: 'offline', provider: null, skip: NO_EMBEDDER_REASON },
  )
  return out
}

/**
 * A deterministic stand-in for a model: word overlap between the state and each option / the question.
 * Plumbing only — its answers are not meant to be good.
 */
export const lexicalBrain: Brain = ({ state, questions }) => {
  const sw = contentWords(state)
  return Object.fromEntries(
    questions.map((q) => {
      const qw = contentWords(q.instructions)
      if (q.kind === 'extract') {
        const hit = q.options.find((o) => overlap(contentWords(o), qw) > 0)
        return [q.id, { value: hit ?? null, p: hit ? 0.7 : 0.6 }]
      }
      if (q.kind === 'yesno') {
        const p = overlap(sw, qw) >= 2 ? 0.7 : 0.3
        return [q.id, { probabilities: { yes: p, no: 1 - p } }]
      }
      return [
        q.id,
        { probabilities: Object.fromEntries(q.options.map((o) => [o, 1 + overlap(sw, contentWords(o))])) },
      ]
    }),
  )
}

export async function fakeProviders(brain: Brain = lexicalBrain): Promise<ProviderSetup[]> {
  const ts = await startFakeTypeSafe(brain)
  const oa = await startFakeOpenAI(brain)
  const an = await startFakeAnthropicDecisions(brain)
  const ol = await startFakeOllama(brain)
  const fast = { retryDelayMs: () => 5 }
  return [
    {
      label: 'jev-fake',
      mode: 'fake',
      provider: new JevDecisionProvider({ apiKey: 'fake', baseURL: ts.url, ...fast }),
      skip: null,
      close: ts.close,
    },
    {
      label: 'openai-fake',
      mode: 'fake',
      provider: new OpenAIDecisionProvider({ apiKey: 'fake', baseURL: `${oa.url}/v1`, ...fast }),
      skip: null,
      close: oa.close,
    },
    {
      label: 'anthropic-fake',
      mode: 'fake',
      provider: new AnthropicDecisionProvider({ apiKey: 'fake', baseURL: an.url, ...fast }),
      skip: null,
      close: an.close,
    },
    {
      label: 'ollama-fake',
      mode: 'fake',
      provider: new OllamaDecisionProvider({ url: ol.url, ...fast }),
      skip: null,
      close: ol.close,
    },
  ]
}

export function liveProviders(env: NodeJS.ProcessEnv = process.env): ProviderSetup[] {
  const k = (name: string) => env[name]?.trim() || null
  // TYPESAFE_AI_API_KEY: another name for the same key (scripts/eval-env.ts maps it for the eval tier)
  const ts = k('TYPESAFE_API_KEY') ?? k('TYPESAFE_AI_API_KEY')
  const oa = k('OPENAI_API_KEY')
  const an = k('ANTHROPIC_API_KEY')
  const ol = k('GNOMEOLA_EVAL_OLLAMA_URL')
  return [
    ts
      ? {
          label: 'jev',
          mode: 'live',
          provider: new JevDecisionProvider({
            apiKey: ts,
            ...(env.GNOMEOLA_EVAL_JEV_MODEL ? { model: env.GNOMEOLA_EVAL_JEV_MODEL } : {}),
          }),
          skip: null,
        }
      : { label: 'jev', mode: 'live', provider: null, skip: 'no TYPESAFE_API_KEY in the environment' },
    oa
      ? {
          label: 'openai',
          mode: 'live',
          provider: new OpenAIDecisionProvider({
            apiKey: oa,
            ...(env.GNOMEOLA_EVAL_OPENAI_MODEL ? { model: env.GNOMEOLA_EVAL_OPENAI_MODEL } : {}),
          }),
          skip: null,
        }
      : { label: 'openai', mode: 'live', provider: null, skip: 'no OPENAI_API_KEY in the environment' },
    an
      ? {
          label: 'anthropic',
          mode: 'live',
          provider: new AnthropicDecisionProvider({
            apiKey: an,
            ...(env.GNOMEOLA_EVAL_ANTHROPIC_MODEL ? { model: env.GNOMEOLA_EVAL_ANTHROPIC_MODEL } : {}),
          }),
          skip: null,
        }
      : { label: 'anthropic', mode: 'live', provider: null, skip: 'no ANTHROPIC_API_KEY in the environment' },
    ol
      ? {
          label: 'ollama',
          mode: 'live',
          provider: new OllamaDecisionProvider({
            url: ol,
            ...(env.GNOMEOLA_EVAL_OLLAMA_MODEL ? { model: env.GNOMEOLA_EVAL_OLLAMA_MODEL } : {}),
          }),
          skip: null,
        }
      : {
          label: 'ollama',
          mode: 'live',
          provider: null,
          skip: 'no GNOMEOLA_EVAL_OLLAMA_URL (set it to run against a local Ollama)',
        },
  ]
}

/** Errors that mean "this account / setup cannot run live evals" rather than "the pipeline is broken". */
export function liveSkipReason(err: unknown): string | null {
  if (!(err instanceof LlmError)) return null
  if (err.code === 'quota') return `quota exhausted: ${err.message}`
  if (err.code === 'auth') return `key rejected: ${err.message}`
  if (err.code === 'permission') return `no access: ${err.message}`
  if (err.code === 'network') return `unreachable: ${err.message}`
  return null
}
