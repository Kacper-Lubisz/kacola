import { GnomeolaApiError, type Session } from '@gnomeola/protocol'
import type { Ctx } from './context.ts'
import { CliError, EXIT, usage } from './errors.ts'

/**
 * Accept what an agent or a human is likely to type: a full id, an unambiguous prefix (with or without
 * the `ses_`), or the keywords `latest` / `current`. Ambiguity is an error, never a guess.
 */
export async function resolveSessionId(ctx: Ctx, input: string | undefined): Promise<string> {
  if (!input) throw usage('a session id is required', 'use `gnomeola sessions list`, or `latest` / `current`')
  if (/^ses_[0-9a-z]{21}$/.test(input)) return input
  const { sessions } = await ctx.client.call('listSessions', { query: { limit: 500 } })
  if (input === 'latest' || input === 'last') {
    const s = sessions[0]
    if (!s) throw new CliError(EXIT.NOT_FOUND, 'there are no sessions yet')
    return s.id
  }
  if (input === 'current') {
    const s = sessions.find((x) => x.status === 'recording' || x.status === 'paused')
    if (!s) throw new CliError(EXIT.NOT_FOUND, 'nothing is recording right now')
    return s.id
  }
  const needle = input.startsWith('ses_') ? input : `ses_${input}`
  const matches = sessions.filter((s) => s.id.startsWith(needle))
  if (matches.length === 1) return matches[0]!.id
  if (!matches.length) throw new CliError(EXIT.NOT_FOUND, `no session matches ${JSON.stringify(input)}`)
  throw usage(
    `${JSON.stringify(input)} is ambiguous (${matches.length} sessions)`,
    `candidates: ${matches
      .slice(0, 5)
      .map((m) => `${m.id} "${m.title}"`)
      .join(', ')}`,
  )
}

/** The fields an agent needs to pick a session — tracks and gap detail are for `sessions show`. */
export function briefSession(s: Session) {
  return {
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    status: s.status,
    durationMs: s.durationMs,
    // M4: the calendar meeting it was recorded for, when there was one (absent otherwise)
    ...(s.meeting ? { meeting: { id: s.meeting.id, title: s.meeting.title, start: s.meeting.start } } : {}),
  }
}

export function mapApiError(err: unknown): never {
  if (err instanceof GnomeolaApiError) {
    if (err.code === 'not_found') throw new CliError(EXIT.NOT_FOUND, err.message)
    if (err.code === 'unavailable') throw new CliError(EXIT.UNAVAILABLE, err.message)
    if (err.code === 'bad_request' && /^refused/.test(err.message))
      throw new CliError(EXIT.REFUSED, err.message)
    if (err.code === 'bad_request') throw new CliError(EXIT.USAGE, err.message)
    if (err.code === 'conflict') throw new CliError(EXIT.ERROR, err.message)
    // agent channel: a lease that is gone, a mode or rule that refuses, a rate limit
    if (err.status === 401 && /lease/i.test(err.message))
      throw new CliError(EXIT.LEASE, err.message, 'attach again: gnomeola live attach')
    if (err.status === 429)
      throw new CliError(EXIT.REFUSED, err.message, 'slow down: at most one suggestion every ~2 minutes')
    if (err.code === 'unauthorized' && err.status === 403) throw new CliError(EXIT.REFUSED, err.message)
  }
  throw err
}
