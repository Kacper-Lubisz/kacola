import type { SessionStatus } from '@kacola/protocol'

// The session state machine. Anything not in this table is an illegal transition (HTTP 409).
//
//   idle ──start──▶ recording ──pause──▶ paused
//                    │   ▲                 │
//                    │   └─────resume──────┘
//                    └──stop──▶ stopped ◀──stop── paused
//
// `recovered` (daemon died while recording/paused) and `failed` (fatal pipeline error) are entered by
// the daemon itself, never by a client action, and — like `stopped` — are terminal.

export type LifecycleAction = 'start' | 'pause' | 'resume' | 'stop'

const TABLE: Record<LifecycleAction, Partial<Record<SessionStatus, SessionStatus>>> = {
  start: { idle: 'recording' },
  pause: { recording: 'paused' },
  resume: { paused: 'recording' },
  stop: { recording: 'stopped', paused: 'stopped' },
}

export function nextStatus(from: SessionStatus, action: LifecycleAction): SessionStatus | null {
  return TABLE[action][from] ?? null
}

/** Statuses in which a capture pipeline is (or should be) running. */
export const ACTIVE: readonly SessionStatus[] = ['recording', 'paused']

export const isActive = (s: SessionStatus): boolean => ACTIVE.includes(s)
