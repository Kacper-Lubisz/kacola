import { _ } from '@gnomeola/ui-core/i18n'
import { EmptyState } from '../../design/primitives/index.ts'
import type { PaneProps } from '../sessions/pane.ts'

// Placeholder: phase 2C (notes) replaces this file with the notes editor.
export function NotesPane(_props: PaneProps) {
  return <EmptyState compact headingLevel={2} icon="notes" title={_('Notes')} />
}
