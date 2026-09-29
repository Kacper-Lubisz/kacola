import type { ApiError } from '@gnomeola/protocol'
import { StoreError } from '@gnomeola/store/core'
import { CloudSttError } from '@gnomeola/stt/cloud'
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
export const needsToken = (message = 'a bearer token is required (pair this device: gnomeola pair)') =>
  new HttpError('unauthorized', message, 401, { 'www-authenticate': 'Bearer realm="gnomeola"' })

export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err
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
