import type { AnyEvent, EphemeralEvent, EphemeralEventData } from '@gnomeola/protocol'

// In-process fan-out. Durable events arrive here from Store.onCommit (after the transaction, in seq
// order, exactly once); ephemeral ones are published directly. Subscribers are called synchronously.

export type BusListener = (e: AnyEvent) => void

export class EventBus {
  private readonly subs = new Set<BusListener>()
  private readonly now: () => Date

  constructor(now: () => Date = () => new Date()) {
    this.now = now
  }

  subscribe(fn: BusListener): () => void {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }

  publish(e: AnyEvent): void {
    for (const fn of [...this.subs]) {
      try {
        fn(e)
      } catch {
        // one broken subscriber must not starve the others
      }
    }
  }

  ephemeral(sessionId: string | null, data: EphemeralEventData): EphemeralEvent {
    const e: EphemeralEvent = { seq: null, at: this.now().toISOString(), sessionId, data }
    this.publish(e)
    return e
  }

  /** Number of live subscribers — for leak tests and diagnostics. */
  get size(): number {
    return this.subs.size
  }
}
