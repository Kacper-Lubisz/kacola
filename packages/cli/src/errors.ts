// Exit codes are part of the CLI's contract with agents: a script (or Claude) branches on them, so they
// are stable and documented in `gnomeola --help`.
export const EXIT = {
  OK: 0,
  ERROR: 1,
  USAGE: 2,
  /** The daemon could not be reached at all. */
  UNREACHABLE: 3,
  NOT_FOUND: 4,
  /** Deliberately refused — e.g. printing a whole transcript without --full. Not a failure of the tool. */
  REFUSED: 5,
  /** The daemon is up but a capability (e.g. the LLM) is not configured. */
  UNAVAILABLE: 6,
  /** Agent channel: no live lease, or it ended (the meeting ended, the user disconnected the agent). */
  LEASE: 7,
} as const
export type ExitCode = (typeof EXIT)[keyof typeof EXIT]

export class CliError extends Error {
  readonly exitCode: ExitCode
  readonly hint: string | undefined
  constructor(exitCode: ExitCode, message: string, hint?: string) {
    super(message)
    this.name = 'CliError'
    this.exitCode = exitCode
    this.hint = hint
  }
}

export const usage = (message: string, hint?: string) => new CliError(EXIT.USAGE, message, hint)
export const refused = (message: string, hint?: string) => new CliError(EXIT.REFUSED, message, hint)
