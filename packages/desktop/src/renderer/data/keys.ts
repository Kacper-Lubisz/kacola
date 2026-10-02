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
  noteVersions: (id: string) => ['noteVersions', id] as const,
  speakers: (id: string) => ['speakers', id] as const,
  qa: (id: string) => ['qa', id] as const,
  templates: (id: string) => ['templates', id] as const,
  settings: () => ['settings'] as const,
  models: () => ['models'] as const,
  devices: () => ['devices'] as const,
  calendar: () => ['calendar'] as const,
  meetings: (range: { from?: string; to?: string } = {}) => ['meetings', range] as const,
  search: (q: string) => ['search', q] as const,
  // ---- agendas (kacola wave 2): one AgendaView per agenda, folded from the agenda.* events
  agenda: (id: string) => ['agenda', id] as const,
  agendaHistory: (id: string) => ['agendaHistory', id] as const,
  /** The live tracker's status for an agenda's recording (agenda.tracker events keep it current). */
  agendaTracker: (id: string) => ['agendaTracker', id] as const,
  /** Every agenda (summaries), for matching calendar meetings to their agendas. */
  agendas: () => ['agendas'] as const,
  /** The agenda linked to a recorded session (its id, or null). */
  sessionAgenda: (sessionId: string) => ['sessionAgenda', sessionId] as const,
  /** The next week of calendar meetings (prep's "Earlier with" and the meeting's next occurrence). */
  upcoming: () => ['upcoming'] as const,
  /** Connected agents' leases on a session (the presence chip) and its private-session access. */
  leases: (sessionId: string) => ['leases', sessionId] as const,
  agentAccess: (sessionId: string) => ['agentAccess', sessionId] as const,
  // ---- team sharing (kacola phase 5): an agenda's ShareStatus — replaced by each ephemeral
  // agenda.share event — and its merge history (every device's changes with their outcome)
  agendaShare: (id: string) => ['agendaShare', id] as const,
  agendaShareHistory: (id: string) => ['agendaShareHistory', id] as const,
}

/** Resources that hang off one session: all of them go when it is deleted. */
export const SESSION_SCOPED = [
  'session',
  'transcript',
  'notes',
  'noteVersions',
  'speakers',
  'qa',
  'templates',
  'sessionAgenda',
  'leases',
  'agentAccess',
] as const

export function isSessionScoped(key: readonly unknown[], id: string): boolean {
  return (SESSION_SCOPED as readonly unknown[]).includes(key[0]) && key[1] === id
}
