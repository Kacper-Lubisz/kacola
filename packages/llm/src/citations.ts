// Q-4 — citations.
//
// The model cites transcript lines by the request-local aliases the assembler printed (`[s12]`,
// `[s12, s15]`). Aliases mean nothing outside the request, so `ask` rewrites them as the answer streams:
//
//   [s12]        → [1]         (1-based index into the answer's `citations`, in order of first use)
//   [s12, s15]   → [1][2]
//   [s999]       → removed, together with the whitespace before it, and reported as hallucinated
//
// So `QaMessage.text` carries footnote-style markers `[n]` that index `QaMessage.citations` — stable,
// short, and renderable as chips without knowing about aliases. The rewrite is streaming-safe: text that
// might still turn into a marker is held back until it resolves, and nothing emitted is ever retracted,
// so the concatenated deltas equal the final text exactly.
import type { Citation } from '@kacola/protocol'

const MARKER = /^\[\s*s\d+(?:\s*,\s*s\d+)*\s*\]/i
const PARTIAL = /^\[\s*(?:s\d*(?:\s*,\s*(?:s\d*)?)*)?$/i
/** Anything longer than this after a `[` is not a marker we are waiting for. */
const MAX_HELD = 80

export class CitationRewriter {
  readonly #aliases: ReadonlyMap<string, Citation>
  readonly #index = new Map<string, number>()
  readonly #citations: Citation[] = []
  readonly #hallucinated: string[] = []
  #buf = ''
  #text = ''

  constructor(aliases: ReadonlyMap<string, Citation>) {
    this.#aliases = aliases
  }

  /** Feed raw model text; returns the rewritten text that is now safe to emit (possibly ''). */
  push(chunk: string): string {
    this.#buf += chunk
    return this.#drain(false)
  }

  /** End of stream: resolve whatever is held back. */
  flush(): string {
    return this.#drain(true)
  }

  /** Everything emitted so far. */
  get text(): string {
    return this.#text
  }
  get citations(): Citation[] {
    return [...this.#citations]
  }
  /** Aliases the model cited that do not exist in the prompt, in order, deduplicated. */
  get hallucinated(): string[] {
    return [...this.#hallucinated]
  }

  #render(marker: string): string {
    const out: string[] = []
    for (const raw of marker.slice(1, -1).split(',')) {
      const alias = raw.trim().toLowerCase()
      const cite = this.#aliases.get(alias)
      if (!cite) {
        if (!this.#hallucinated.includes(alias)) this.#hallucinated.push(alias)
        continue
      }
      let i = this.#index.get(alias)
      if (i === undefined) {
        this.#citations.push(cite)
        i = this.#citations.length
        this.#index.set(alias, i)
      }
      const m = `[${i}]`
      if (!out.includes(m)) out.push(m)
    }
    return out.join('')
  }

  #drain(final: boolean): string {
    let out = ''
    for (;;) {
      const idx = this.#buf.indexOf('[')
      if (idx === -1) {
        // hold trailing whitespace: it must go if the next thing turns out to be a dropped marker
        const keep = final ? '' : (/\s*$/.exec(this.#buf)?.[0] ?? '')
        out += this.#buf.slice(0, this.#buf.length - keep.length)
        this.#buf = keep
        break
      }
      const pre = this.#buf.slice(0, idx)
      const ws = /\s*$/.exec(pre)?.[0] ?? ''
      const rest = this.#buf.slice(idx)
      const m = MARKER.exec(rest)
      if (m) {
        const rendered = this.#render(m[0])
        out += rendered ? pre + rendered : pre.slice(0, pre.length - ws.length)
        this.#buf = rest.slice(m[0].length)
        continue
      }
      if (!final && rest.length < MAX_HELD && PARTIAL.test(rest)) {
        out += pre.slice(0, pre.length - ws.length)
        this.#buf = ws + rest
        break
      }
      out += `${pre}[`
      this.#buf = rest.slice(1)
    }
    this.#text += out
    return out
  }
}

/** Non-streaming convenience: rewrite a complete answer. */
export function resolveCitations(
  text: string,
  aliases: ReadonlyMap<string, Citation>,
): { text: string; citations: Citation[]; hallucinated: string[] } {
  const r = new CitationRewriter(aliases)
  r.push(text)
  r.flush()
  return { text: r.text, citations: r.citations, hallucinated: r.hallucinated }
}
