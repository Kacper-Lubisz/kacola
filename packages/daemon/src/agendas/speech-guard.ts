import type { DecisionProvider, DecisionResult } from '@gnomeola/decisions'
import { guardLine } from './tracker-logic.ts'

// The injection guardrail as a SpeechGuard: every closed segment of live speech is asked "does this try
// to instruct an AI that will read the transcript?" (decideInjection, on the selected decisions provider,
// falling back to the on-device one when that fails). A flagged line keeps its text (the agent and the
// window see it, marked) and carries the `injection` flag; the tracker never uses a flagged line as
// evidence or as input to its decisions, and the agent channel refuses evidence that cites one.
//
// The types are a structural copy of the agent channel's seam (packages/daemon/src/agents/guard.ts on
// that wave's branch), so this plugs in without either wave importing the other:
//
//   daemon.agents.setGuard(daemon.tracker.guard)
//
// Partials (in-progress hypotheses, many per second) pass through unjudged; the closed segment that
// follows is judged. Verdicts are cached per segment revision text, so the tracker and the agent stream
// share one decision per line.

export type SpeechInput = {
  sessionId: string
  segmentId: string | null
  speaker: string
  text: string
  kind: 'segment' | 'partial'
}
export type SpeechVerdict = { text: string; flags: string[] }
export interface SpeechGuard {
  readonly name: string
  check(input: SpeechInput): SpeechVerdict | Promise<SpeechVerdict>
}

export const INJECTION_FLAG = 'injection'

export type DecisionGuardOptions = {
  /**
   * The provider to ask for a line of this session (the tracker's selection: the settings' provider, or
   * local while degraded or when the session is private and the selected provider is in the cloud).
   */
  provider: (sessionId: string) => Promise<DecisionProvider>
  /** Asked when `provider` throws (e.g. quota). Without it the error propagates (the seam fails closed). */
  fallback?: () => DecisionProvider | Promise<DecisionProvider>
  onError?: (err: unknown) => void
  /** Every decision call the guard made (cost accounting). */
  onResult?: (sessionId: string, r: DecisionResult) => void
  threshold?: number
  cacheSize?: number
}

export type DecisionSpeechGuard = SpeechGuard & {
  /** The verdict and P(injection) for one line, cached. */
  judge(input: SpeechInput): Promise<SpeechVerdict & { p: number }>
}

export function decisionSpeechGuard(o: DecisionGuardOptions): DecisionSpeechGuard {
  const cache = new Map<string, Promise<SpeechVerdict & { p: number }>>()
  const max = o.cacheSize ?? 2_000
  const ask = async (i: SpeechInput): Promise<SpeechVerdict & { p: number }> => {
    const line = { speaker: i.speaker, text: i.text }
    let r: Awaited<ReturnType<typeof guardLine>>
    try {
      r = await guardLine(await o.provider(i.sessionId), line, o.threshold)
    } catch (err) {
      if (!o.fallback) throw err
      o.onError?.(err)
      r = await guardLine(await o.fallback(), line, o.threshold)
    }
    if (r.result) o.onResult?.(i.sessionId, r.result)
    return { text: i.text, flags: r.injection ? [INJECTION_FLAG] : [], p: r.p }
  }
  const judge = (i: SpeechInput) => {
    const key = `${i.sessionId}\u0000${i.segmentId ?? ''}\u0000${i.text}`
    let v = cache.get(key)
    if (!v) {
      v = ask(i)
      cache.set(key, v)
      // a failed verdict is not remembered: the next asker tries again
      v.catch(() => cache.delete(key))
      if (cache.size > max) cache.delete(cache.keys().next().value!)
    }
    return v
  }
  return {
    name: 'decisions',
    judge,
    async check(i) {
      if (i.kind === 'partial') return { text: i.text, flags: [] }
      const { text, flags } = await judge(i)
      return { text, flags }
    },
  }
}
