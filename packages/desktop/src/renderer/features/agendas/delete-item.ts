import type { AgendaItem, AgendaView, ItemVersion, ShareStatus } from '@kacola/protocol'
import { _, fmt } from '@kacola/ui-core/i18n'
import { useServices } from '../../data/services.tsx'
import { useToast } from '../../design/primitives/index.ts'
import { refusal, useAgendaMutation } from './agenda-data.ts'
import { deleteItemMutation, isTemporary } from './mutations.ts'
import { useAgendaShare } from './share-data.ts'

// Deleting an agenda item: no confirm dialog — it goes at once, and a toast offers Undo, which puts it
// back through the item history (POST /agendas/:id/items/:itemId/restore with the removal's version:
// same id, same place, same status; the restore is itself in the history). On a shared agenda a
// follower deletes only the items they added — the owner's items are the owner's (the share sync would
// not carry the delete, and the item would only vanish here). Pure parts unit-tested in test/agendas.test.tsx.

/** Changes this device makes in its own name (the share projection's `isLocalAuthor`). */
const isLocalAuthor = (by: string): boolean => by === 'user' || by === 'tracker' || by.startsWith('agent:')

/** May this window delete the item? Not while it is still being added; a follower only their own. */
export function canDeleteItem(item: AgendaItem, share: Pick<ShareStatus, 'role'> | undefined): boolean {
  if (isTemporary(item.id)) return false
  return share?.role !== 'member' || isLocalAuthor(item.createdBy)
}

/** The version Undo restores: the item's latest removal that still carries its content. */
export function removalVersion(versions: readonly ItemVersion[]): ItemVersion | null {
  return [...versions].reverse().find((v) => v.kind === 'removed' && v.restorable) ?? null
}

export function useDeleteItem(view: AgendaView) {
  const { api, queries, queryClient } = useServices()
  const toast = useToast()
  const agendaId = view.agenda.id
  const share = useAgendaShare(agendaId).data
  const remove = useAgendaMutation(deleteItemMutation, _('Could not delete the item'))
  const undo = async (item: AgendaItem) => {
    try {
      const versions = await queryClient.fetchQuery({
        ...queries.itemHistory(agendaId, item.id),
        staleTime: 0,
      })
      const v = removalVersion(versions)
      if (!v) throw new Error(_('its history has nothing to restore'))
      await api.call('restoreAgendaItem', { params: { id: agendaId, itemId: item.id }, body: { seq: v.seq } })
    } catch (err) {
      toast(fmt(_('Could not undo: {reason}'), { reason: refusal(err) }), { tone: 'error' })
    }
  }
  const can = (item: AgendaItem) => canDeleteItem(item, share)
  const del = (item: AgendaItem) => {
    if (!can(item)) return
    remove.mutate(
      { agendaId, itemId: item.id },
      {
        onSuccess: () =>
          toast(fmt(_('Deleted “{item}”'), { item: item.text }), {
            action: { label: _('Undo'), onPress: () => void undo(item) },
            timeoutMs: 8000,
          }),
      },
    )
  }
  return { can, del }
}
