export type LlmErrorCode =
  | 'aborted'
  | 'auth'
  | 'permission'
  | 'not_found'
  | 'bad_request'
  | 'rate_limited'
  | 'overloaded'
  | 'server'
  | 'timeout'
  | 'network'
  | 'unknown'

const RETRYABLE: ReadonlySet<LlmErrorCode> = new Set([
  'rate_limited',
  'overloaded',
  'server',
  'timeout',
  'network',
])

/**
 * The one error type `ask` throws. `code` is what callers branch on; `retryable` says whether trying
 * again later can help (the SDK has already spent its own retries by the time this surfaces).
 */
export class LlmError extends Error {
  readonly code: LlmErrorCode
  readonly retryable: boolean
  readonly status: number | null
  readonly retryAfterMs: number | null

  constructor(
    code: LlmErrorCode,
    message: string,
    opts: { status?: number | null; retryAfterMs?: number | null; cause?: unknown } = {},
  ) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause })
    this.name = 'LlmError'
    this.code = code
    this.retryable = RETRYABLE.has(code)
    this.status = opts.status ?? null
    this.retryAfterMs = opts.retryAfterMs ?? null
  }
}

export function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'APIUserAbortError')
}
