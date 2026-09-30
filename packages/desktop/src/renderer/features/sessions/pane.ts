import type { Session } from '@gnomeola/protocol'

/**
 * What the session page hands each of its tab panes (features/transcript, features/ask, features/notes,
 * and Details). The pane owns everything below the tab bar and scrolls itself; `session` is the live
 * ['session', id] value (kept current by the EventBridge).
 *
 * To switch tabs from a pane (a citation opening the transcript), navigate with the tab search param:
 *   navigate({ to: '/sessions/$sessionId', params: { sessionId }, search: { tab: 'transcript', segment } })
 */
export type PaneProps = { session: Session }

export type SessionTab = 'transcript' | 'ask' | 'notes' | 'details'
export const SESSION_TABS: readonly SessionTab[] = ['transcript', 'ask', 'notes', 'details']
