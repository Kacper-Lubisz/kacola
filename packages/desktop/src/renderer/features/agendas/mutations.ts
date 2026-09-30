import type {
  Agenda,
  AgendaItem,
  AgendaItemStatus,
  AgendaView,
  AgentMode,
  ContextCard,
  LeaseInfo,
  NewAgendaItem,
  Suggestion,
} from '@gnomeola/protocol'
import { reorderItems } from '@gnomeola/ui-core/agendas'
import type { QueryClient } from '@tanstack/react-query'
import { keys } from '../../data/keys.ts'
import { optimistic } from '../../data/mutations.ts'
import type { Api } from '../../data/queries.ts'

// Agenda edits as optimistic mutations (docs/desktop-app.md, "Add a mutation"). The optimistic value is
// written into the cached AgendaView WITHOUT bumping its version, so the daemon's durable echo (which
// carries the next version) always folds over it (ui-core/agendas) — the echo is the reconciliation.
// On error the old value comes back (or the view is refetched if an event wrote it meanwhile).
//
// Adds are the one case with a client-made id: the optimistic item is `tmp_…` until the response names
// it. The response (items + the version they produced) is folded in only when the cache has not already
// seen that version through the echo, and the temporary rows go either way.

type Target = { key: readonly unknown[]; update: (prev: unknown) => unknown }

const onView =
  (_id: string, f: (v: AgendaView) => AgendaView): Target['update'] =>
  (p) =>
    f(p as AgendaView)

const patchItem = (v: AgendaView, itemId: string, patch: Partial<AgendaItem>): AgendaView => ({
  ...v,
  items: v.items.map((i) => (i.id === itemId ? { ...i, ...patch, changedBy: 'user' } : i)),
})

let tmp = 0
export const isTemporary = (id: string) => id.startsWith('tmp_')

export type AddItemsVars = { agendaId: string; items: NewAgendaItem[]; before?: string }

export function addItemsMutation(api: Api, qc: QueryClient) {
  // the temporary ids of each call (keyed by its variables: concurrent adds do not share them)
  const made = new WeakMap<AddItemsVars, string[]>()
  return {
    mutationKey: ['addAgendaItems'],
    mutationFn: ({ agendaId, items, before }: AddItemsVars) =>
      api.call('addAgendaItems', {
        params: { id: agendaId },
        body: { items, ...(before ? { before } : {}) },
      }),
    ...optimistic<AddItemsVars>(qc, (vars) => [
      {
        key: keys.agenda(vars.agendaId),
        update: onView(vars.agendaId, (v) => {
          const { agendaId, items, before } = vars
          const now = new Date().toISOString()
          const ids = items.map(() => `tmp_${Date.now().toString(36)}_${tmp++}`)
          made.set(vars, ids)
          const rows: AgendaItem[] = items.map((n, i) => ({
            id: ids[i]!,
            agendaId,
            text: n.text.replace(/\s+/g, ' ').trim(),
            kind: n.kind ?? 'topic',
            owner: n.owner ?? null,
            timeboxMin: n.timeboxMin ?? null,
            order: 0,
            status: n.status ?? 'open',
            evidence: [],
            outcome: n.outcome ?? null,
            changedBy: 'user',
            createdBy: 'user',
            carriedFrom: null,
            createdAt: now,
            updatedAt: now,
          }))
          const at = before ? v.items.findIndex((i) => i.id === before) : -1
          const list = [...v.items]
          list.splice(at < 0 ? list.length : at, 0, ...rows)
          return { ...v, items: list.map((i, order) => ({ ...i, order })) }
        }),
      },
    ]),
    onSuccess: (res: { items: AgendaItem[]; version: number }, vars: AddItemsVars) => {
      const { agendaId } = vars
      const gone = new Set(made.get(vars) ?? [])
      qc.setQueryData<AgendaView>(keys.agenda(agendaId), (v) => {
        if (!v) return v
        const items = v.items.filter((i) => !gone.has(i.id))
        if (v.agenda.version >= res.version) return { ...v, items }
        const known = new Set(items.map((i) => i.id))
        const merged = [...items, ...res.items.filter((i) => !known.has(i.id))].sort(
          (a, b) => a.order - b.order,
        )
        return { ...v, items: merged }
      })
    },
  }
}

export type UpdateItemVars = {
  agendaId: string
  itemId: string
  patch: Partial<Pick<AgendaItem, 'text' | 'kind' | 'owner' | 'timeboxMin' | 'outcome'>>
}

export function updateItemMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['updateAgendaItem'],
    mutationFn: ({ agendaId, itemId, patch }: UpdateItemVars) =>
      api.call('updateAgendaItem', { params: { id: agendaId, itemId }, body: patch }),
    ...optimistic<UpdateItemVars>(qc, ({ agendaId, itemId, patch }) => [
      { key: keys.agenda(agendaId), update: onView(agendaId, (v) => patchItem(v, itemId, patch)) },
    ]),
  }
}

export type DeleteItemVars = { agendaId: string; itemId: string }

export function deleteItemMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['deleteAgendaItem'],
    mutationFn: ({ agendaId, itemId }: DeleteItemVars) =>
      api.call('deleteAgendaItem', { params: { id: agendaId, itemId } }),
    ...optimistic<DeleteItemVars>(qc, ({ agendaId, itemId }) => [
      {
        key: keys.agenda(agendaId),
        update: onView(agendaId, (v) => ({ ...v, items: v.items.filter((i) => i.id !== itemId) })),
      },
    ]),
  }
}

export type SetStatusVars = {
  agendaId: string
  itemId: string
  status: AgendaItemStatus
  note?: string
  outcome?: string
}

export function setStatusMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['setAgendaItemStatus'],
    mutationFn: ({ agendaId, itemId, status, note, outcome }: SetStatusVars) =>
      api.call('setAgendaItemStatus', {
        params: { id: agendaId, itemId },
        body: { status, ...(note ? { note } : {}), ...(outcome !== undefined ? { outcome } : {}) },
      }),
    ...optimistic<SetStatusVars>(qc, ({ agendaId, itemId, status, outcome }) => [
      {
        key: keys.agenda(agendaId),
        update: onView(agendaId, (v) =>
          patchItem(v, itemId, { status, ...(outcome !== undefined ? { outcome } : {}) }),
        ),
      },
    ]),
  }
}

export type ReorderVars = { agendaId: string; itemIds: string[] }

export function reorderMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['reorderAgendaItems'],
    mutationFn: ({ agendaId, itemIds }: ReorderVars) =>
      api.call('reorderAgendaItems', {
        params: { id: agendaId },
        body: { itemIds: itemIds.filter((id) => !isTemporary(id)) },
      }),
    ...optimistic<ReorderVars>(qc, ({ agendaId, itemIds }) => [
      {
        key: keys.agenda(agendaId),
        update: onView(agendaId, (v) => ({ ...v, items: reorderItems(v.items, itemIds) })),
      },
    ]),
  }
}

export type UpdateAgendaVars = {
  agendaId: string
  patch: Partial<Pick<Agenda, 'title' | 'goals' | 'private'>>
}

export function updateAgendaMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['updateAgenda'],
    mutationFn: ({ agendaId, patch }: UpdateAgendaVars) =>
      api.call('updateAgenda', { params: { id: agendaId }, body: patch }),
    ...optimistic<UpdateAgendaVars>(qc, ({ agendaId, patch }) => [
      {
        key: keys.agenda(agendaId),
        update: onView(agendaId, (v) => ({ ...v, agenda: { ...v.agenda, ...patch } })),
      },
    ]),
  }
}

export type ContextVars = {
  agendaId: string
  card: Pick<ContextCard, 'title' | 'body'> & Partial<Pick<ContextCard, 'visibility' | 'pinned' | 'source'>>
}

/** A new card shows when its echo arrives (it is quick, and a card has no useful half-state). */
export function addContextMutation(api: Api) {
  return {
    mutationKey: ['addContextCard'],
    mutationFn: ({ agendaId, card }: ContextVars) =>
      api.call('addContextCard', { params: { id: agendaId }, body: card }),
  }
}

export type UpdateContextVars = {
  agendaId: string
  cardId: string
  patch: Partial<Pick<ContextCard, 'title' | 'body' | 'visibility' | 'pinned'>>
}

export function updateContextMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['updateContextCard'],
    mutationFn: ({ agendaId, cardId, patch }: UpdateContextVars) =>
      api.call('updateContextCard', { params: { id: agendaId, cardId }, body: patch }),
    ...optimistic<UpdateContextVars>(qc, ({ agendaId, cardId, patch }) => [
      {
        key: keys.agenda(agendaId),
        update: onView(agendaId, (v) => ({
          ...v,
          context: v.context.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
        })),
      },
    ]),
  }
}

export function deleteContextMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['deleteContextCard'],
    mutationFn: ({ agendaId, cardId }: { agendaId: string; cardId: string }) =>
      api.call('deleteContextCard', { params: { id: agendaId, cardId } }),
    ...optimistic<{ agendaId: string; cardId: string }>(qc, ({ agendaId, cardId }) => [
      {
        key: keys.agenda(agendaId),
        update: onView(agendaId, (v) => ({ ...v, context: v.context.filter((c) => c.id !== cardId) })),
      },
    ]),
  }
}

export type ResolveVars = { agendaId: string; suggestion: Suggestion; action: 'accept' | 'dismiss' }

export function resolveSuggestionMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['resolveSuggestion'],
    mutationFn: ({ agendaId, suggestion, action }: ResolveVars) =>
      api.call(action === 'accept' ? 'acceptSuggestion' : 'dismissSuggestion', {
        params: { id: agendaId, suggestionId: suggestion.id },
        body: {},
      }),
    ...optimistic<ResolveVars>(qc, ({ agendaId, suggestion, action }) => [
      {
        key: keys.agenda(agendaId),
        update: onView(agendaId, (v) => ({
          ...v,
          suggestions: v.suggestions.map((s) =>
            s.id === suggestion.id
              ? {
                  ...s,
                  state: action === 'accept' ? ('accepted' as const) : ('dismissed' as const),
                  resolvedBy: 'user',
                  resolvedAt: new Date().toISOString(),
                }
              : s,
          ),
        })),
      },
    ]),
  }
}

// ---- connected agents (the agent channel's owner routes)

export function updateLeaseMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['updateAgentLease'],
    mutationFn: ({ leaseId, mode }: { sessionId: string; leaseId: string; mode: AgentMode }) =>
      api.call('updateAgentLease', { params: { leaseId }, body: { mode } }),
    ...optimistic<{ sessionId: string; leaseId: string; mode: AgentMode }>(
      qc,
      ({ sessionId, leaseId, mode }) => [
        {
          key: keys.leases(sessionId),
          update: (p) => (p as LeaseInfo[]).map((l) => (l.id === leaseId ? { ...l, mode } : l)),
        },
      ],
    ),
    onSettled: (_r: unknown, _e: unknown, { sessionId }: { sessionId: string }) =>
      void qc.invalidateQueries({ queryKey: keys.leases(sessionId), exact: true }),
  }
}

export function revokeLeaseMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['releaseAgentLease'],
    mutationFn: ({ leaseId }: { sessionId: string; leaseId: string }) =>
      api.call('releaseAgentLease', { params: { leaseId } }),
    ...optimistic<{ sessionId: string; leaseId: string }>(qc, ({ sessionId, leaseId }) => [
      {
        key: keys.leases(sessionId),
        update: (p) =>
          (p as LeaseInfo[]).map((l) =>
            l.id === leaseId
              ? {
                  ...l,
                  state: 'disconnected' as const,
                  endReason: 'revoked' as const,
                  endedAt: new Date().toISOString(),
                }
              : l,
          ),
      },
    ]),
    onSettled: (_r: unknown, _e: unknown, { sessionId }: { sessionId: string }) =>
      void qc.invalidateQueries({ queryKey: keys.leases(sessionId), exact: true }),
  }
}

export function setAgentAccessMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['setAgentAccess'],
    mutationFn: ({ sessionId, allowAgents }: { sessionId: string; allowAgents: boolean }) =>
      api.call('setAgentAccess', { params: { id: sessionId }, body: { allowAgents } }),
    ...optimistic<{ sessionId: string; allowAgents: boolean }>(qc, ({ sessionId, allowAgents }) => [
      {
        key: keys.agentAccess(sessionId),
        update: (p) => {
          const a = p as { private: boolean }
          return { ...a, allowAgents, attachable: !a.private || allowAgents }
        },
      },
    ]),
    onSuccess: (res: unknown, { sessionId }: { sessionId: string; allowAgents: boolean }) => {
      // no durable echo of this read model (settings.updated invalidates it): take the answer
      qc.setQueryData(keys.agentAccess(sessionId), res)
      void qc.invalidateQueries({ queryKey: keys.leases(sessionId), exact: true })
    },
  }
}
