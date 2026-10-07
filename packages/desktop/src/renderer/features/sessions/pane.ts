import type { Session } from '@kacola/protocol'

/** What a meeting-page panel is handed: the live ['session', id] value (kept current by the EventBridge). */
export type PaneProps = { session: Session }
