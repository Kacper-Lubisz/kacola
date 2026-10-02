import {
  type AiFeature,
  aiErrorCopy,
  isKeyedProvider,
  isOnDeviceLlm,
  type Session,
  type Settings,
} from '@gnomeola/protocol'
import { DaemonError } from './errors.ts'

// Private means "never sent to the cloud". The one place the daemon decides whether a meeting's words
// may go to the configured AI provider, and the typed errors it answers with when they may not (or when
// there is no provider to send them to). Every path that hands transcript or notes text to a text LLM
// (Ask, Enhance, Plan with Claude, the recap, the tracker's bridge lines) goes through here; the
// decisions provider has its own on-device check in the tracker (protocol isOnDeviceDecisions).

type Llm = Pick<Settings['llm'], 'provider' | 'ollamaUrl'>

/**
 * Whether this meeting's text may go to the configured provider: not private, or the provider is
 * on-device. With no provider nothing is sent at all, so the more useful error (`no-provider`) answers.
 */
export const mayLeave = (session: Pick<Session, 'private'>, llm: Llm): boolean =>
  !session.private || llm.provider === 'none' || isOnDeviceLlm(llm)

/** The typed refusal for a private meeting and a cloud provider (409: the meeting's state forbids it). */
export function privateMeetingError(llm: Llm, feature: AiFeature): DaemonError {
  const { message, ...detail } = aiErrorCopy('private-meeting', { provider: llm.provider, feature })
  return new DaemonError('conflict', message, undefined, detail)
}

/** Throw the private-meeting refusal unless the meeting's text may go to the provider. */
export function assertMayLeave(session: Pick<Session, 'private'>, llm: Llm, feature: AiFeature): void {
  if (!mayLeave(session, llm)) throw privateMeetingError(llm, feature)
}

/** `no-provider` (None in Preferences) or `no-key` (a cloud provider without its key). */
export function notReadyError(llm: Llm, apiKeyConfigured: boolean, feature: AiFeature): DaemonError {
  const reason = isKeyedProvider(llm.provider) && !apiKeyConfigured ? 'no-key' : 'no-provider'
  const { message, ...detail } = aiErrorCopy(reason, { provider: llm.provider, feature })
  return new DaemonError('unavailable', message, undefined, detail)
}
