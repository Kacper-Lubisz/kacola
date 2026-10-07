import type { TrackerStatus } from '@kacola/protocol'
import { _, fmt } from '@kacola/ui-core/i18n'

// The recap's state after a meeting, as one quiet line on the outcome page: writing it, why there is
// none, or that it failed. From GET /agendas/:id/tracker, kept current by `agenda.tracker` events
// (EventBridge.foldStatus). Which decisions provider follows a live meeting, and its fallbacks, are
// internals: the live screen never shows them.

/** One line for the recap (null: nothing worth a line — still live, or done). */
export function trackerLine(
  t: TrackerStatus,
): { tone: 'info' | 'warning' | 'danger' | 'success'; text: string } | null {
  if (t.state !== 'stopped') return null
  switch (t.recap.state) {
    case 'pending':
    case 'running':
      return { tone: 'info', text: _('Writing the recap…') }
    case 'unavailable':
      return {
        tone: 'info',
        text: t.recap.detail
          ? fmt(_('No recap: {reason}'), { reason: t.recap.detail })
          : _('No recap: no AI provider is set up'),
      }
    case 'failed':
      return {
        tone: 'danger',
        text: t.recap.detail
          ? fmt(_('The recap failed: {reason}'), { reason: t.recap.detail })
          : _('The recap failed'),
      }
    case 'done':
      return null
  }
}
