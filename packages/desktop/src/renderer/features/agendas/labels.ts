import type { AgendaItemKind, AgendaItemStatus, AgentMode, StatusChange } from '@gnomeola/protocol'
import { attributionOf } from '@gnomeola/ui-core/agendas'
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

/** "you", "the tracker", "Claude", "ana@example.com". */
export function whoLabel(by: string): string {
  const a = attributionOf(by)
  switch (a.kind) {
    case 'you':
      return _('you')
    case 'tracker':
      return _('the live tracker')
    case 'agent':
      return displayAgent(a.name ?? '')
    case 'invitee':
      return a.name ?? ''
  }
}

/** An agent's name as people say it ("claude" → "Claude"). */
export const displayAgent = (name: string): string =>
  name ? name.charAt(0).toUpperCase() + name.slice(1) : name

/**
 * The attribution on a status: "auto" (the tracker at high confidence), "checked by Claude" (an agent),
 * "marked by ana@…" (an invitee), or null for the user's own change.
 */
export function attributionText(c: Pick<StatusChange, 'by' | 'auto'> | null): string | null {
  if (!c) return null
  const a = attributionOf(c.by)
  if (a.kind === 'you') return null
  if (a.kind === 'tracker') return c.auto ? _('auto') : _('by the live tracker')
  if (a.kind === 'agent') return fmt(_('checked by {name}'), { name: displayAgent(a.name ?? '') })
  return fmt(_('marked by {name}'), { name: a.name ?? '' })
}
