import type { TrackerStatus } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useServices } from '../../data/services.tsx'
import { Banner, Chip } from '../../design/primitives/index.ts'

// How the live tracker is doing, above the live panel: which decisions provider follows the meeting, a
// warning when it had to fall back to the on-device one (and why), and after the recording the recap's
// state. From GET /agendas/:id/tracker, kept current by `agenda.tracker` events (EventBridge.foldStatus).
// Nothing when the tracker never ran for this agenda.

const PROVIDER: Record<string, () => string> = {
  local: () => _('on this computer'),
  jev: () => 'TypeSafe Jev',
  openai: () => 'OpenAI',
  anthropic: () => 'Anthropic',
  ollama: () => 'Ollama',
}
export const providerName = (p: string) => PROVIDER[p]?.() ?? p

/** One line for the tracker (null: nothing worth a line). */
export function trackerLine(
  t: TrackerStatus,
): { tone: 'info' | 'warning' | 'danger' | 'success'; text: string } | null {
  if (t.state === 'degraded')
    return {
      tone: 'warning',
      text: t.detail
        ? fmt(_('Live tracking fell back to the on-device model: {reason}'), { reason: t.detail })
        : _('Live tracking fell back to the on-device model'),
    }
  if (t.state === 'running') return null
  switch (t.recap.state) {
    case 'pending':
    case 'running':
      return { tone: 'info', text: _('Writing the recap…') }
    case 'unavailable':
      return {
        tone: 'info',
        text: t.recap.detail
          ? fmt(_('No recap: {reason}'), { reason: t.recap.detail })
          : _('No recap: no language model is set up'),
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

export function TrackerStatusLine({ agendaId }: { agendaId: string }) {
  const { queries } = useServices()
  const { data: t } = useQuery(queries.agendaTracker(agendaId))
  if (!t) return null
  const line = trackerLine(t)
  return (
    <div className="flex flex-col gap-2">
      {t.state === 'running' ? (
        <p className="m-0 flex items-center gap-2 type-caption text-text-secondary">
          <Chip icon="enhance" tone="info">
            {_('auto')}
          </Chip>
          {fmt(_('Following the meeting · decisions {provider}'), { provider: providerName(t.provider) })}
        </p>
      ) : null}
      {line ? <Banner tone={line.tone} title={line.text} /> : null}
    </div>
  )
}
