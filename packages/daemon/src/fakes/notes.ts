import { DaemonError } from '../errors.ts'
import type { EnhanceChunk, EnhanceRequest, NotesEngine } from '../notes/engine.ts'

/**
 * Deterministic stand-in for enhancement: a summary quoting the first transcript line (cited), the
 * user's lines kept verbatim under "Notes" (their own words, as the real prompt demands), and one action
 * item. Streamed a line at a time. Notes containing FAIL make it throw mid-stream; REFUSE makes it
 * decline the way a model's safety classifier does.
 */
export class FakeNotesEngine implements NotesEngine {
  readonly requests: EnhanceRequest[] = []
  private readonly delayMs: number
  constructor(opts: { delayMs?: number } = {}) {
    this.delayMs = opts.delayMs ?? 2
  }

  ready(): boolean {
    return true
  }

  async *enhance(req: EnhanceRequest): AsyncIterable<EnhanceChunk> {
    this.requests.push(req)
    const first = req.segments[0]
    const mine = req.notes
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => `${l}\n`)
    const lines = [
      `## Summary\n\n`,
      first ? `The meeting opened with: "${first.text}" [1]\n\n` : 'Nothing was transcribed.\n\n',
      ...(mine.length ? ['## Notes\n\n', ...mine, '\n'] : []),
      '## Action items\n\n',
      `- [ ] Share these ${req.template.name} notes — owner: me\n`,
    ]
    const markdown = lines.join('')
    for (const [i, line] of lines.entries()) {
      if (req.signal.aborted) return
      if (i === 2 && req.notes.includes('FAIL')) throw new DaemonError('unavailable', 'fake upstream failure')
      await new Promise((r) => setTimeout(r, this.delayMs))
      yield { type: 'delta', text: line }
    }
    const refused = req.notes.includes('REFUSE')
    yield {
      type: 'final',
      markdown: refused ? '' : markdown,
      citations:
        first && !refused
          ? [
              {
                sessionId: first.sessionId,
                segmentId: first.id,
                startMs: first.startMs,
                endMs: first.endMs,
                speaker: first.speaker,
              },
            ]
          : [],
      model: 'fake-enhance',
      usage: { inputTokens: 100, outputTokens: lines.length, cacheReadTokens: 0, cacheWriteTokens: 0 },
      stopReason: refused ? 'refusal' : 'end_turn',
    }
  }
}
