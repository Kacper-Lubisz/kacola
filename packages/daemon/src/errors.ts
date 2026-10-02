import type { ApiError, ErrorDetail } from '@gnomeola/protocol'
import { StoreError } from '@gnomeola/store'
import { ZodError } from 'zod'

export type ApiErrorCode = ApiError['error']['code']

export const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 403,
  not_found: 404,
  conflict: 409,
  internal: 500,
  unavailable: 503,
}

/** An error with a wire code. Throw it from handlers or providers to choose the HTTP status. */
export class DaemonError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  /** The stable reason and the one action a client offers (see protocol ai.ts). */
  readonly detail: ErrorDetail
  constructor(code: ApiErrorCode, message: string, status?: number, detail: ErrorDetail = {}) {
    super(message)
    this.name = 'DaemonError'
    this.code = code
    this.status = status ?? STATUS[code]
    this.detail = detail
  }

  /** The same error with another message (e.g. redacted), keeping the code, status and detail. */
  withMessage(message: string): DaemonError {
    return new DaemonError(this.code, message, this.status, this.detail)
  }
}

/** Map anything thrown to a DaemonError. Unknown errors become a generic 500 (details go to the log). */
export function toDaemonError(err: unknown): DaemonError {
  if (err instanceof DaemonError) return err
  if (err instanceof StoreError) return new DaemonError(err.code, err.message)
  // errors from shared layers (the hosted server's pairing auth) that already carry a wire code
  if (isCoded(err)) return new DaemonError(err.code, err.message, err.status)
  if (err instanceof ZodError) {
    const detail = err.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    return new DaemonError('bad_request', `invalid request: ${detail}`)
  }
  return new DaemonError('internal', 'internal error')
}

function isCoded(err: unknown): err is { code: ApiErrorCode; status: number; message: string } {
  const e = err as { code?: unknown; status?: unknown } | null
  return (
    err instanceof Error &&
    typeof e?.code === 'string' &&
    e.code in STATUS &&
    typeof e.status === 'number' &&
    e.status >= 400 &&
    e.status < 600
  )
}

export const apiErrorBody = (e: DaemonError): ApiError => ({
  error: { code: e.code, message: e.message, ...e.detail },
})

/** The `error` member of a stream's error event (ask, enhance, draft): the same shape as a JSON error. */
export const streamError = (e: DaemonError): ApiError['error'] => apiErrorBody(e).error
