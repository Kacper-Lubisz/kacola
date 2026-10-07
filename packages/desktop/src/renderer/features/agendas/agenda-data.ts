import { _, fmt } from '@kacola/ui-core/i18n'
import type { QueryClient } from '@tanstack/react-query'
import { type UseMutationOptions, useMutation, useQuery } from '@tanstack/react-query'
import type { Api } from '../../data/queries.ts'
import { useServices } from '../../data/services.tsx'
import { useToast } from '../../design/primitives/index.ts'

// Hooks the agenda screens share: the cached view, and mutations that roll back AND say why.

export function useAgenda(agendaId: string | null | undefined) {
  const { queries } = useServices()
  return useQuery({ ...queries.agenda(agendaId ?? ''), enabled: Boolean(agendaId) })
}

export function useAgendaHistory(agendaId: string, enabled = true) {
  const { queries } = useServices()
  return useQuery({ ...queries.agendaHistory(agendaId), enabled })
}

/** The daemon's refusal as a sentence ("The agenda changed…" for a version conflict). */
export function refusal(err: unknown): string {
  // KacolaApiError: { status, code, message } (the daemon's own sentence)
  const e = err as { status?: number; message?: string }
  if (e.status === 409 && !e.message) return _('The agenda changed meanwhile.')
  return e.message ?? String(err)
}

type Factory<V, R> = (api: Api, qc: QueryClient) => UseMutationOptions<R, unknown, V, never> | object

/**
 * `useAgendaMutation(addItemsMutation, _('Could not add the item'))`: the factory's optimistic rollback,
 * plus a toast with the daemon's reason.
 */
export function useAgendaMutation<V, R = unknown>(factory: Factory<V, R>, failure: string) {
  const { api, queryClient } = useServices()
  const toast = useToast()
  const opts = factory(api, queryClient) as UseMutationOptions<R, unknown, V, unknown>
  return useMutation<R, unknown, V, unknown>({
    ...opts,
    onError: (err, vars, ctx, mctx) => {
      opts.onError?.(err, vars, ctx, mctx)
      toast(fmt(_('{what}: {reason}'), { what: failure, reason: refusal(err) }), { tone: 'error' })
    },
  })
}
