import type { ShareStatus } from '@kacola/protocol'
import type { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { keys } from '../../data/keys.ts'
import { optimistic } from '../../data/mutations.ts'
import type { Api } from '../../data/queries.ts'
import { useServices } from '../../data/services.tsx'

// Team sharing's data for the window (docs/sharing.md, "What the window needs"): an agenda's
// ShareStatus (['agendaShare', id], replaced by each ephemeral `agenda.share` event in the EventBridge),
// its merge history, and the share / unshare / recap / sync mutations. Sharing is not part of the
// durable log, so there is no echo to wait for: the optimistic value shows at once, the route's
// response (the daemon's status after the act) replaces it, and the agenda.share event that follows
// carries the same — or a newer — status.

export function useAgendaShare(agendaId: string | null | undefined) {
  const { queries } = useServices()
  return useQuery({ ...queries.agendaShare(agendaId ?? ''), enabled: Boolean(agendaId) })
}

export function useShareHistory(agendaId: string, enabled = true) {
  const { queries } = useServices()
  return useQuery({ ...queries.agendaShareHistory(agendaId), enabled })
}

/** Display names by email, from the share's participants and the comments' authors. */
export function peopleNames(s: ShareStatus | undefined): Map<string, string> {
  const m = new Map<string, string>()
  for (const p of s?.participants ?? []) if (p.name) m.set(p.email.toLowerCase(), p.name)
  for (const c of s?.comments ?? [])
    if (c.author.name && c.author.role !== 'owner') m.set(c.author.label.toLowerCase(), c.author.name)
  return m
}

export function usePeopleNames(agendaId: string | null | undefined): Map<string, string> {
  const { data } = useAgendaShare(agendaId)
  return useMemo(() => peopleNames(data), [data])
}

/** The status the window shows while a share request is under way. */
const pendingShare = (s: ShareStatus, o: ShareVars['options']): ShareStatus => ({
  ...s,
  shared: true,
  role: s.role ?? 'owner',
  state: 'syncing',
  error: null,
  ...(o.ownerName !== undefined ? { ownerName: o.ownerName } : {}),
  ...(o.shareGoals !== undefined ? { shareGoals: o.shareGoals } : {}),
  ...(o.allowInvitees !== undefined ? { allowInvitees: o.allowInvitees } : {}),
  ...(o.members !== undefined ? { members: o.members } : {}),
})

export type ShareVars = {
  agendaId: string
  options: { ownerName?: string; shareGoals?: boolean; allowInvitees?: boolean; members?: string[] }
}

const settle = (qc: QueryClient) => ({
  onSuccess: (s: ShareStatus) => {
    qc.setQueryData(keys.agendaShare(s.agendaId), s)
    void qc.invalidateQueries({ queryKey: keys.agendaShareHistory(s.agendaId), exact: true })
  },
})

/** Share an agenda on the configured host, or update its sharing options. */
export function shareAgendaMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['shareAgenda'],
    mutationFn: ({ agendaId, options }: ShareVars) =>
      api.call('shareAgenda', { params: { id: agendaId }, body: options }),
    ...optimistic<ShareVars>(qc, ({ agendaId, options }) => [
      { key: keys.agendaShare(agendaId), update: (p) => pendingShare(p as ShareStatus, options) },
    ]),
    ...settle(qc),
  }
}

/** Owner: unshare (the link stops working). Member: stop following (the local copy stays). */
export function unshareAgendaMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['unshareAgenda'],
    mutationFn: ({ agendaId }: { agendaId: string }) =>
      api.call('unshareAgenda', { params: { id: agendaId } }),
    ...optimistic<{ agendaId: string }>(qc, ({ agendaId }) => [
      {
        key: keys.agendaShare(agendaId),
        update: (p) => ({ ...(p as ShareStatus), shared: false, state: 'off', link: null }),
      },
    ]),
    ...settle(qc),
  }
}

export type RecapVars = { agendaId: string; shared: boolean }

/** Owner: share (or stop sharing) this occurrence's recap — the outcomes. */
export function shareRecapMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['shareAgendaRecap'],
    mutationFn: ({ agendaId, shared }: RecapVars) =>
      api.call('shareAgendaRecap', { params: { id: agendaId }, body: { shared } }),
    ...optimistic<RecapVars>(qc, ({ agendaId, shared }) => [
      {
        key: keys.agendaShare(agendaId),
        update: (p) => ({ ...(p as ShareStatus), recapShared: shared }),
      },
    ]),
    ...settle(qc),
  }
}

/** Push and pull now. */
export function syncShareMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['syncAgendaShare'],
    mutationFn: ({ agendaId }: { agendaId: string }) =>
      api.call('syncAgendaShare', { params: { id: agendaId } }),
    ...optimistic<{ agendaId: string }>(qc, ({ agendaId }) => [
      {
        key: keys.agendaShare(agendaId),
        update: (p) => ({ ...(p as ShareStatus), state: 'syncing' }),
      },
    ]),
    ...settle(qc),
  }
}
