import type { Session } from '@gnomeola/protocol'
import { fromSnapshot, type SessionsState } from '@gnomeola/ui-core/sessions'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { keys } from './keys.ts'
import type { Api } from './queries.ts'

// Optimistic mutations. The pattern (docs/desktop-app.md, "Adding a mutation"):
//
//   onMutate   cancel in-flight fetches of the touched keys, write the optimistic value, remember
//              (previous, optimistic) per key;
//   success    nothing: the daemon's durable echo (session.upserted, speaker.upserted …) arrives through
//              the EventBridge and replaces the optimistic value with the server's — the echo is the
//              reconciliation, so the mutation response is never written over a possibly newer event;
//   onError    per key: if the cache still holds exactly our optimistic value, restore the previous one;
//              if anything else wrote it meanwhile (an event), the previous value is stale too, so refetch.

export type OptimisticTarget = { key: QueryKey; update: (prev: unknown) => unknown }
type Snap = { key: QueryKey; prev: unknown; next: unknown }
export type OptimisticContext = { snaps: Snap[] }

export function optimistic<V>(qc: QueryClient, targets: (vars: V) => OptimisticTarget[]) {
  return {
    onMutate: async (vars: V): Promise<OptimisticContext> => {
      const ts = targets(vars)
      await Promise.all(ts.map((t) => qc.cancelQueries({ queryKey: t.key, exact: true })))
      const snaps: Snap[] = []
      for (const t of ts) {
        const prev = qc.getQueryData(t.key)
        if (prev === undefined) continue
        qc.setQueryData(t.key, t.update(prev))
        // what the cache holds (structural sharing may have produced a different object than ours)
        snaps.push({ key: t.key, prev, next: qc.getQueryData(t.key) })
      }
      return { snaps }
    },
    onError: (_err: unknown, _vars: V, ctx: OptimisticContext | undefined) => {
      for (const s of ctx?.snaps ?? []) {
        if (qc.getQueryData(s.key) === s.next) qc.setQueryData(s.key, s.prev)
        else void qc.invalidateQueries({ queryKey: s.key, exact: true })
      }
    },
  }
}

/** A session list with one session patched, same cursor (so the durable echo still applies). */
export function patchSessionIn(
  state: SessionsState,
  id: string,
  patch: (s: Session) => Session,
): SessionsState {
  const cur = state.byId.get(id)
  if (!cur) return state
  return fromSnapshot(
    [...state.byId.values()].map((s) => (s.id === id ? patch(s) : s)),
    state.seq,
  )
}

/** Reference mutation: rename a session (list + detail updated at once, the echo reconciles). */
export function renameSessionMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['renameSession'],
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.call('updateSession', { params: { id }, body: { title } }),
    ...optimistic<{ id: string; title: string }>(qc, ({ id, title }) => [
      {
        key: keys.sessions(),
        update: (p) => patchSessionIn(p as SessionsState, id, (s) => ({ ...s, title })),
      },
      { key: keys.session(id), update: (p) => ({ ...(p as Session), title }) },
    ]),
  }
}
