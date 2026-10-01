// One recorder request at a time. A second press while one is in flight is dropped (a double click
// must not create two sessions), except Stop during a pause or resume: the daemon's echo flips the page
// back to Recording before that request answers, so a Stop pressed then waits for it, then runs.

export type RequestKind = 'starting' | 'stopping' | 'pausing'

export type RequestGate = {
  /** Run `fn` as a `kind` request; resolves when it settles, or at once when dropped. */
  run: (kind: RequestKind, fn: () => Promise<void>) => Promise<void>
}

export function createRequestGate(onBusy: (kind: RequestKind | null) => void): RequestGate {
  let inFlight: { kind: RequestKind; done: Promise<void> } | null = null
  return {
    run(kind, fn) {
      const prev = inFlight
      if (prev && !(kind === 'stopping' && prev.kind === 'pausing')) return Promise.resolve()
      const entry: { kind: RequestKind; done: Promise<void> } = { kind, done: Promise.resolve() }
      entry.done = (async () => {
        if (prev) await prev.done.catch(() => {})
        onBusy(kind)
        try {
          await fn()
        } finally {
          if (inFlight === entry) inFlight = null
          onBusy(inFlight?.kind ?? null)
        }
      })()
      inFlight = entry
      return entry.done
    },
  }
}
