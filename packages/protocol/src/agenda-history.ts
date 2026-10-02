import { z } from 'zod'
import { Actor } from './actors.ts'
import { AgendaItem, ChangedBy, ItemCause, StatusChange } from './agendas.ts'
import { Iso } from './schemas.ts'

// Agenda item history that can restore, not only show. Every add, edit, status change, removal and
// markdown import of an item is a version (from the event log, so removed items keep their history);
// restoring puts the item back as it was after one of them — as ordinary item events marked `restore`,
// so a restore is itself in the history and can be undone the same way.

export const ItemChangeKind = z.enum(['added', 'edited', 'status', 'removed', 'imported', 'restored'])
export type ItemChangeKind = z.infer<typeof ItemChangeKind>

export const ItemField = z.enum(['text', 'kind', 'owner', 'timeboxMin', 'outcome', 'status'])
export type ItemField = z.infer<typeof ItemField>

export const ItemVersion = z.object({
  /** The version's id: pass it to restoreAgendaItem. */
  seq: z.int().positive(),
  itemId: z.string(),
  kind: ItemChangeKind,
  by: ChangedBy,
  /** `by` in words: you, kacola, your Claude, Ben's Claude, Ben (actors.ts). */
  actor: Actor,
  at: Iso,
  /** The item as it was after this change; for `removed`, as it was when removed (null on old events). */
  item: AgendaItem.nullable(),
  /** What this change altered against the previous version (empty for added / removed). */
  fields: z.array(ItemField),
  /** For a status change: the recorded change (evidence, auto, override). */
  status: StatusChange.nullable(),
  /** This version can be restored (it carries the item's content). */
  restorable: z.boolean(),
  cause: ItemCause.nullable(),
})
export type ItemVersion = z.infer<typeof ItemVersion>

const flag = z.union([z.boolean(), z.stringbool()]).optional()

export const agendaHistoryRoutes = {
  /** Versions of an agenda's items, oldest first (one item with `itemId`; removed items included). */
  getAgendaItemHistory: {
    method: 'GET',
    path: '/agendas/:id/item-history',
    query: z.object({ itemId: z.string().optional(), includePrivate: flag }),
    response: z.object({ versions: z.array(ItemVersion) }),
  },
  /** Owner: put an item back as it was after version `seq` (a removed item comes back, same id). */
  restoreAgendaItem: {
    method: 'POST',
    path: '/agendas/:id/items/:itemId/restore',
    body: z.strictObject({ seq: z.int().positive() }),
    response: z.object({ item: AgendaItem, version: z.int().positive() }),
  },
} as const
