import type { AgendaItemKind, AgendaItemStatus, AgentMode, StatusChange } from '@gnomeola/protocol'
import { attributionOf, personName } from '@gnomeola/ui-core/agendas'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import type { ChipTone, IconName } from '../../design/primitives/index.ts'

// The words and marks of agendas, in one place: item kinds, statuses (label, icon, tone), agent modes,
// and who did something ("checked by Claude", "auto"). Functions, so the catalogue in use applies.

export const KINDS: readonly AgendaItemKind[] = [
  'topic',
  'question',
  'must-cover',
  'decision',
  'info-to-get',
  'competency',
]

export function kindLabel(k: AgendaItemKind): string {
  switch (k) {
    case 'topic':
      return _('Topic')
    case 'question':
      return _('Question')
    case 'must-cover':
      return _('Must cover')
    case 'decision':
      return _('Decision')
    case 'info-to-get':
      return _('Info to get')
    case 'competency':
      return _('Competency')
  }
}

export const STATUSES: readonly AgendaItemStatus[] = ['open', 'in-progress', 'covered', 'skipped', 'parked']

export function statusLabel(s: AgendaItemStatus): string {
  switch (s) {
    case 'open':
      return _('Open')
    case 'in-progress':
      return _('In progress')
    case 'covered':
      return _('Covered')
    case 'skipped':
      return _('Skipped')
    case 'parked':
      return _('Parked')
  }
}

export const STATUS_ICON: Record<AgendaItemStatus, IconName> = {
  open: 'openItem',
  'in-progress': 'inProgress',
  covered: 'covered',
  skipped: 'skipped',
  parked: 'parked',
}

export const STATUS_TONE: Record<AgendaItemStatus, ChipTone> = {
  open: 'neutral',
  'in-progress': 'info',
  covered: 'success',
  skipped: 'neutral',
  parked: 'warning',
}

export const MODES: readonly AgentMode[] = ['observe', 'suggest', 'act']

export function modeLabel(m: AgentMode): string {
  switch (m) {
    case 'observe':
      return _('Observe')
    case 'suggest':
      return _('Suggest')
    case 'act':
      return _('Act')
  }
}

export function modeDescription(m: AgentMode): string {
  switch (m) {
    case 'observe':
      return _('Reads the meeting; changes nothing.')
    case 'suggest':
      return _('Posts suggestions and context for you to accept.')
    case 'act':
      return _('Also checks items off (never over your own changes).')
  }
}

/**
 * "you", "the live tracker", "Claude", "ana@example.com" (an invitee), and on a shared agenda another
 * attendee's device: "Ben", "Ben's tracker", "Ben's Claude". `names`: display names by email.
 */
export function whoLabel(by: string, names?: ReadonlyMap<string, string>): string {
  const a = attributionOf(by)
  switch (a.kind) {
    case 'you':
      return _('you')
    case 'tracker':
      return _('the live tracker')
    case 'agent':
      return displayAgent(a.name ?? '')
    case 'invitee':
      return inviteeLabel(a.name ?? '', names)
    case 'peer':
      return peerLabel(a.name ?? '', a.via, names)
  }
}

/** An invitee by the name they gave, with the address the owner knows them by. */
const inviteeLabel = (email: string, names?: ReadonlyMap<string, string>) => {
  const n = names?.get(email.toLowerCase())
  return n ? `${n} (${email})` : email
}

function peerLabel(
  label: string,
  via: ReturnType<typeof attributionOf>['via'],
  names?: ReadonlyMap<string, string>,
) {
  const who = personName(label, names)
  if (via?.kind === 'tracker') return fmt(_('{name}’s tracker'), { name: who })
  if (via?.kind === 'agent') return fmt(_('{name}’s {agent}'), { name: who, agent: displayAgent(via.name) })
  return who
}

/** An agent's name as people say it ("claude" → "Claude"). */
export const displayAgent = (name: string): string =>
  name ? name.charAt(0).toUpperCase() + name.slice(1) : name

/**
 * The attribution on a status: "auto" (the tracker at high confidence), "checked by Claude" (an agent),
 * "marked by ana@…" (an invitee), "marked by Ben" / "by Ben's tracker" / "checked by Ben's Claude"
 * (another attendee's device on a shared agenda), or null for the user's own change.
 */
export function attributionText(
  c: Pick<StatusChange, 'by' | 'auto'> | null,
  names?: ReadonlyMap<string, string>,
): string | null {
  if (!c) return null
  const a = attributionOf(c.by)
  if (a.kind === 'you') return null
  if (a.kind === 'tracker') return c.auto ? _('auto') : _('by the live tracker')
  if (a.kind === 'agent') return fmt(_('checked by {name}'), { name: displayAgent(a.name ?? '') })
  if (a.kind === 'peer') {
    const who = peerLabel(a.name ?? '', a.via, names)
    if (a.via?.kind === 'tracker') return fmt(_('by {name}'), { name: who })
    if (a.via?.kind === 'agent') return fmt(_('checked by {name}'), { name: who })
    return fmt(_('marked by {name}'), { name: who })
  }
  return fmt(_('marked by {name}'), { name: inviteeLabel(a.name ?? '', names) })
}

/** The icon of an attribution chip: an agent's (anyone's), a person's (another attendee, an invitee), else the tracker's. */
export function attributionIcon(by: string): IconName {
  const a = attributionOf(by)
  if (a.kind === 'agent' || (a.kind === 'peer' && a.via?.kind === 'agent')) return 'agent'
  if (a.kind === 'invitee' || (a.kind === 'peer' && a.via?.kind === 'person')) return 'person'
  return 'enhance'
}

/** "added by Ivy" for an item someone else put on the agenda (an invitee, another attendee), else null. */
export function addedByText(createdBy: string, names?: ReadonlyMap<string, string>): string | null {
  const a = attributionOf(createdBy)
  if (a.kind === 'invitee') return fmt(_('added by {name}'), { name: inviteeLabel(a.name ?? '', names) })
  if (a.kind === 'peer') return fmt(_('added by {name}'), { name: peerLabel(a.name ?? '', a.via, names) })
  return null
}
