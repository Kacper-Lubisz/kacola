import { z } from 'zod'

// What leaves the machine, and what to do when the AI provider fails. Shared by the daemon (which
// enforces it and writes the error copy), the window (which shows the destination and the one action
// that fixes an error) and the CLI.
//
// Private means "never sent to the cloud": a private meeting's transcript and notes only ever go to an
// on-device provider (Ollama on this computer). Every cloud call on a private meeting is refused with
// reason `private-meeting`; cross-meeting Ask leaves private meetings out of what it sends.

// ------------------------------------------------------------------------------- error reasons

/**
 * Why a request failed, stable across releases: clients branch on this, never on the message. Absent on
 * errors that have no better description than their HTTP-family `code`.
 */
export const ErrorReason = z.enum([
  /** No AI provider is chosen (Preferences says None). */
  'no-provider',
  /** A cloud provider is chosen but has no API key. */
  'no-key',
  /** The provider rejected the API key. */
  'bad-key',
  /** The provider account is out of credits / over its billing limit. */
  'no-credits',
  /** The provider is rate-limiting this account. */
  'rate-limited',
  /** The provider is overloaded (Anthropic 529, OpenAI 503). Not the user's fault: retry. */
  'overloaded',
  /** The provider could not be reached, timed out or failed on its side. */
  'provider-down',
  /** The model declined to answer. */
  'refused',
  /** The meeting is private and the provider is in the cloud: nothing was sent. */
  'private-meeting',
  /** Sharing needs a hosted server and none is configured: no link an attendee can open. */
  'no-share-host',
])
export type ErrorReason = z.infer<typeof ErrorReason>

/** The one action a client offers for an error. */
export const ErrorAction = z.enum(['retry', 'set-up-provider', 'add-credits', 'set-up-sharing', 'none'])
export type ErrorAction = z.infer<typeof ErrorAction>

/** The optional, structured half of an error body (see ApiError in schemas.ts). */
export const ErrorDetail = z.object({
  reason: ErrorReason.optional(),
  action: ErrorAction.optional(),
  /** The provider's display name ("Anthropic"), when the error is about one. */
  provider: z.string().optional(),
  /** Where the action happens (the provider's billing page for `add-credits`). */
  link: z.string().optional(),
  /** For `retry`: how long to wait, when the provider said. */
  retryAfterMs: z.int().nonnegative().optional(),
})
export type ErrorDetail = z.infer<typeof ErrorDetail>

// ----------------------------------------------------------------------------------- providers

export type AiProviderId = 'anthropic' | 'openai' | 'ollama' | 'typesafe' | 'jev' | 'local' | 'none'

const NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  ollama: 'Ollama',
  typesafe: 'TypeSafe',
  jev: 'TypeSafe',
  local: 'kacola (on this computer)',
  none: 'no provider',
}

/** A provider's display name ("Anthropic"); unknown ids come back as given. */
export const providerName = (id: string): string => NAMES[id] ?? id

/** Where to add credits for a keyed provider; null when it has no billing page we know of. */
export const BILLING_URLS: Record<string, string> = {
  anthropic: 'https://console.anthropic.com/settings/billing',
  openai: 'https://platform.openai.com/settings/organization/billing',
}

/** True for a URL whose host is this computer (localhost, 127.0.0.0/8, ::1). Unparseable = false. */
export function isLoopbackUrl(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  host = host.replace(/^\[|\]$/g, '')
  return (
    host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127(\.\d{1,3}){3}$/.test(host)
  )
}

/**
 * Whether a text-LLM setting keeps data on this computer: only Ollama at a loopback address (an empty
 * URL is Ollama's default, `http://127.0.0.1:11434`). Ollama on another machine is off-device.
 */
export function isOnDeviceLlm(llm: { provider: string; ollamaUrl?: string }): boolean {
  if (llm.provider !== 'ollama') return false
  return !llm.ollamaUrl || isLoopbackUrl(llm.ollamaUrl)
}

/** Same for the decisions provider: `local` always, `ollama` at a loopback address. */
export function isOnDeviceDecisions(provider: string, ollamaUrl?: string): boolean {
  if (provider === 'local') return true
  return isOnDeviceLlm({ provider, ollamaUrl })
}

// ---------------------------------------------------------------------------------- error copy

/** Which feature failed, for the copy ("Ask needs an AI provider"). */
export type AiFeature = 'Ask' | 'Enhance' | 'Plan with Claude' | 'The recap'

export type AiErrorCopy = { message: string } & ErrorDetail

/**
 * The human message and the structured detail for an AI error. One sentence of what happened (whose
 * problem it is) and, through `action`, the one thing that fixes it. Never raw provider JSON.
 */
export function aiErrorCopy(
  reason: ErrorReason,
  o: { provider?: string; feature?: AiFeature; retryAfterMs?: number | null } = {},
): AiErrorCopy {
  const id = o.provider ?? ''
  const name = providerName(id)
  const feature = o.feature ?? 'Ask'
  const withProvider = id && id !== 'none' ? { provider: name } : {}
  switch (reason) {
    case 'no-provider':
      return {
        message: `${feature} needs an AI provider. Set one up in Preferences.`,
        reason,
        action: 'set-up-provider',
      }
    case 'no-key':
      return {
        message: `${name} needs an API key. Add it in Preferences.`,
        reason,
        action: 'set-up-provider',
        ...withProvider,
      }
    case 'bad-key':
      return {
        message: `${name} didn't accept the API key. Check it in Preferences.`,
        reason,
        action: 'set-up-provider',
        ...withProvider,
      }
    case 'no-credits': {
      const link = BILLING_URLS[id]
      return {
        message: `Your ${name} account has no credits left. Add credits with ${name}, or switch provider.`,
        reason,
        action: 'add-credits',
        ...withProvider,
        ...(link ? { link } : {}),
      }
    }
    case 'rate-limited': {
      const secs = o.retryAfterMs ? Math.ceil(o.retryAfterMs / 1000) : null
      return {
        message: secs
          ? `${name} is limiting requests right now. Try again in ${secs} s.`
          : `${name} is limiting requests right now. Try again in a minute.`,
        reason,
        action: 'retry',
        ...withProvider,
        ...(o.retryAfterMs ? { retryAfterMs: o.retryAfterMs } : {}),
      }
    }
    case 'overloaded':
      return {
        message: `${name} is busy right now. Try again in a minute.`,
        reason,
        action: 'retry',
        ...withProvider,
        ...(o.retryAfterMs ? { retryAfterMs: o.retryAfterMs } : {}),
      }
    case 'provider-down':
      return {
        message: `Couldn't reach ${name}. Check your connection and try again.`,
        reason,
        action: 'retry',
        ...withProvider,
      }
    case 'refused':
      return { message: `The model declined to answer.`, reason, action: 'none', ...withProvider }
    case 'private-meeting':
      return {
        message: `This meeting is private, so kacola won't send it to ${id && id !== 'none' ? name : 'a cloud AI provider'}. ${feature} on private meetings works with an AI provider on this computer (Ollama).`,
        reason,
        action: 'none',
        ...withProvider,
      }
    case 'no-share-host':
      return {
        message:
          "kacola can't make a link attendees can open: sharing isn't set up. Connect a sharing server first.",
        reason,
        action: 'set-up-sharing',
      }
  }
}
