// React Query keys, one per daemon resource, mirroring the protocol's routes. Every query and every
// cache write (the EventBridge, optimistic mutations) goes through this factory, so a key is spelled in
// exactly one place. Per-session keys all start with a resource name and end with the session id,
// which is what lets `session.deleted` drop them all (see sessionScoped).

export const keys = {
  health: () => ['health'] as const,
  /** The whole list, private sessions included (the window shows them); filtered client-side. */
  sessions: () => ['sessions'] as const,
  session: (id: string) => ['session', id] as const,
  transcript: (id: string) => ['transcript', id] as const,
  notes: (id: string) => ['notes', id] as const,
  speakers: (id: string) => ['speakers', id] as const,
  qa: (id: string) => ['qa', id] as const,
  templates: (id: string) => ['templates', id] as const,
  settings: () => ['settings'] as const,
  models: () => ['models'] as const,
  devices: () => ['devices'] as const,
  calendar: () => ['calendar'] as const,
  meetings: (range: { from?: string; to?: string } = {}) => ['meetings', range] as const,
  search: (q: string) => ['search', q] as const,
}

/** Resources that hang off one session: all of them go when it is deleted. */
export const SESSION_SCOPED = ['session', 'transcript', 'notes', 'speakers', 'qa', 'templates'] as const

export function isSessionScoped(key: readonly unknown[], id: string): boolean {
  return (SESSION_SCOPED as readonly unknown[]).includes(key[0]) && key[1] === id
}
