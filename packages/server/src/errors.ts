import type { ApiError } from '@kacola/protocol'
import { ShareForbidden, ShareGone, ShareRateLimited, StoreError } from '@kacola/store/core'
import { CloudSttError } from '@kacola/stt/cloud'
import { ZodError } from 'zod'

export type ApiErrorCode = ApiError['error']['code']

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 403,
  not_found: 404,
  conflict: 409,
  internal: 500,
  unavailable: 503,
}

/** An error with a wire code and an HTTP status. */
export class HttpError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly headers: Record<string, string>
  constructor(code: ApiErrorCode, message: string, status?: number, headers: Record<string, string> = {}) {
    super(message)
    this.name = 'HttpError'
    this.code = code
    this.status = status ?? STATUS[code]
    this.headers = headers
  }
}

/** 401 with the challenge a client needs to know it should pair. */
export const needsToken = (message = 'a bearer token is required (pair this device: kacola pair)') =>
  new HttpError('unauthorized', message, 401, { 'www-authenticate': 'Bearer realm="kacola"' })

export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err
  // team sharing: a revoked link is gone (410), a rate limit is 429, a refused share action 403
  if (err instanceof ShareGone) return new HttpError('not_found', err.message, 410)
  if (err instanceof ShareRateLimited)
    return new HttpError('conflict', err.message, 429, { 'retry-after': '60' })
  if (err instanceof ShareForbidden) return new HttpError('unauthorized', err.message)
  if (err instanceof StoreError) return new HttpError(err.code, err.message)
  if (err instanceof ZodError) {
    const detail = err.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    return new HttpError('bad_request', `invalid request: ${detail}`)
  }
  if (err instanceof CloudSttError)
    return new HttpError('unavailable', `transcription failed: ${err.message}`, 502)
  return new HttpError('internal', 'internal error')
}

export const errorBody = (e: HttpError): ApiError => ({ error: { code: e.code, message: e.message } })
