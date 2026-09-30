import { _ } from '@gnomeola/ui-core/i18n'
import { EmptyState } from '../../design/primitives/index.ts'
import type { PaneProps } from '../sessions/pane.ts'

// Placeholder: phase 2B (transcript / Ask / speakers) replaces this file with the Ask pane.
export function AskPane(_props: PaneProps) {
  return <EmptyState compact headingLevel={2} icon="ask" title={_('Ask')} />
}
