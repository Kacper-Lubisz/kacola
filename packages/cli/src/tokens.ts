import { countTokens as legacyCount } from '@anthropic-ai/tokenizer'

// Token budgets are the regression tests for the retrieval discipline: without a counted ceiling, a
// well-meaning change quietly turns this CLI back into a transcript dumper.
//
// Counting uses Anthropic's published tokenizer. It predates current models, which spend up to ~1.35×
// as many tokens on the same text, so every count is scaled by that factor: the ceilings are therefore
// conservative for the models that will actually read this output.
export const TOKENIZER_SAFETY_FACTOR = 1.35

export function countTokens(text: string): number {
  return Math.ceil(legacyCount(text) * TOKENIZER_SAFETY_FACTOR)
}

export const BUDGET = {
  /** A whole `search` result, rendered. */
  search: 1_500,
  /** Default ceiling for a `transcript` window; raise with --max-tokens, bypass with --full. */
  transcriptWindow: 4_000,
  /** A meeting's notes (`kacola notes`); bypass with --full. */
  notes: 4_000,
  /** An `ask` result, rendered — an answer and its citations, never raw transcript. */
  ask: 1_500,
  /** An agenda (`kacola agenda show`/`create`/`import`), rendered; bypass with --full. */
  agenda: 3_000,
  /** One context card's body (`kacola context add`): something to glance at in a meeting, not a document. */
  contextCard: 2_000,
  /** One search snippet, in characters (server snippets are already capped; this is belt and braces). */
  snippetChars: 240,
} as const
