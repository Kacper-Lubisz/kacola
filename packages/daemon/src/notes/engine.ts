import type { Citation, NoteTemplate, Segment, Session, StoredSettings, Usage } from '@kacola/protocol'

// The seam where notes enhancement plugs into the daemon, like QaEngine for Q&A. The real engine is
// @kacola/llm (engines/enhance.ts); a deterministic fake (fakes/notes.ts) drives tests.

export type EnhanceRequest = {
  session: Session
  segments: Segment[]
  /** The head of the user's notes (markdown), possibly empty. */
  notes: string
  template: NoteTemplate
  settings: StoredSettings['llm']
  /** From ANTHROPIC_API_KEY or the keyring. Never log it. */
  apiKey: string | null
  signal: AbortSignal
}

export type EnhanceChunk =
  | { type: 'delta'; text: string }
  | {
      type: 'final'
      /** Empty on a refusal. */
      markdown: string
      citations: Citation[]
      model: string | null
      usage: Usage | null
      /** `refusal` when the model declined: nothing is stored. */
      stopReason: string | null
    }

export interface NotesEngine {
  ready(ctx: { settings: StoredSettings['llm']; apiKeyConfigured: boolean }): boolean
  /** Stream deltas, then exactly one `final`. Throw a DaemonError to fail with a specific code. */
  enhance(req: EnhanceRequest): AsyncIterable<EnhanceChunk>
}
