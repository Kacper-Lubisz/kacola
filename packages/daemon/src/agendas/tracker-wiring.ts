import { type LlmProvider, providerFromSettings } from '@kacola/llm'
import { isKeyedProvider, type Session, type trackerRoutes } from '@kacola/protocol'
import type { Handlers } from '../daemon.ts'
import { DaemonError } from '../errors.ts'
import { mayLeave, notReadyError, privateMeetingError } from '../privacy.ts'
import type { SettingsService } from '../settings.ts'
import type { AgendaService } from './service.ts'
import type { AgendaTracker } from './tracker.ts'

// Agendas wave 2 — the tracker's small wiring: the text LLM it and the recap use (the Q&A provider from
// settings, with its key), and the read route for its status.

/**
 * The text LLM for bridge lines and recaps of a recording, or null with the reason (switched off, no key,
 * or a private recording and a provider that is not on this computer: private is never sent to the cloud).
 */
export function agendaLlm(
  settings: SettingsService,
  override?: () => Promise<LlmProvider | null>,
): (
  session?: Pick<Session, 'private'> | null,
) => Promise<{ provider: LlmProvider | null; reason: string | null }> {
  return async (session) => {
    if (session && !mayLeave(session, settings.get().llm))
      return { provider: null, reason: privateMeetingError(settings.get().llm, 'The recap').message }
    if (override) {
      const provider = await override()
      return { provider, reason: provider ? null : 'no text LLM is configured' }
    }
    const s = settings.get().llm
    if (s.provider === 'none') return { provider: null, reason: notReadyError(s, false, 'The recap').message }
    const apiKey = await settings.apiKey()
    if (isKeyedProvider(s.provider) && !apiKey)
      return { provider: null, reason: notReadyError(s, false, 'The recap').message }
    const provider = providerFromSettings(
      { ...s, apiKeyConfigured: apiKey !== null },
      apiKey !== null ? { apiKey } : {},
    )
    return { provider, reason: provider ? null : `${s.provider} cannot run` }
  }
}

export function trackerHandlers(
  svc: AgendaService,
  tracker: AgendaTracker | null,
): Pick<Handlers, keyof typeof trackerRoutes> {
  return {
    getAgendaTracker: ({ params }) => {
      if (!svc.agendas.get(params.id)) throw new DaemonError('not_found', `no agenda ${params.id}`)
      return { tracker: tracker?.status(params.id) ?? null }
    },
  }
}
