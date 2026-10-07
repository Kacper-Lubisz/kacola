import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import {
  normalizeUserCode,
  type PairApprove,
  type PairStart,
  type PairToken,
  USER_CODE_ALPHABET,
} from '@kacola/protocol'
import type { StoreApi } from '@kacola/store/core'
import { HttpError, needsToken } from './errors.ts'

// H-6 — pairing auth, shared by the hosted server and the local daemon (when it listens beyond
// loopback). The rule from the plan: loopback stays anonymous, remote ALWAYS needs a token.
//
// Tokens are stateless HMAC-SHA256 signatures over {device id, issued-at} — `gnm1.<payload>.<sig>` —
// so verifying one is a hash, not a lookup... plus one lookup: the device must still exist and not be
// revoked, which is what makes revocation immediate. The server's secret never leaves the server.
//
// Pairing is the device-code flow (RFC 8628 shaped):
//   1. the new device POSTs /pair/start          → a secret device code + a short user code
//   2. the owner, on something already trusted,
//      approves the user code (POST /pair/approve) — loopback on the daemon's own machine, the admin
//      token, or any already-paired device
//   3. the new device polls POST /pair/token with its device code → pending … then its token, once.
// The device code is stored only as a SHA-256; the user code is useless without approval by a trusted
// party and expires in ten minutes.

export type Principal =
  | { kind: 'loopback' }
  | { kind: 'admin' }
  | { kind: 'device'; deviceId: string }
  /** No credentials, on one of the OPEN_ROUTES (how a device gets its token). */
  | { kind: 'anonymous' }

export type AuthConfig = {
  /** HMAC key for device tokens. At least 32 characters. */
  secret: string
  /** The owner's bootstrap credential (KACOLA_ADMIN_TOKEN): approves pairings, reads everything. */
  adminToken?: string
  pairingTtlMs?: number
  pollIntervalMs?: number
}

export type PairingStore = Pick<
  StoreApi,
  'createPairing' | 'approvePairing' | 'claimPairing' | 'getDevice' | 'revokeDevice'
>

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url')
const TOKEN_PREFIX = 'gnm1'

export function signToken(secret: string, deviceId: string, issuedAt: Date): string {
  const payload = b64url(JSON.stringify({ d: deviceId, i: Math.floor(issuedAt.getTime() / 1000) }))
  const sig = createHmac('sha256', secret).update(`${TOKEN_PREFIX}.${payload}`).digest('base64url')
  return `${TOKEN_PREFIX}.${payload}.${sig}`
}

/** The token's device id if the signature is valid, else null. Constant-time comparison. */
export function verifyToken(secret: string, token: string): { deviceId: string; issuedAt: Date } | null {
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null
  const expected = createHmac('sha256', secret).update(`${TOKEN_PREFIX}.${parts[1]}`).digest()
  const given = Buffer.from(parts[2]!, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const p = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as { d?: unknown; i?: unknown }
    if (typeof p.d !== 'string' || typeof p.i !== 'number') return null
    return { deviceId: p.d, issuedAt: new Date(p.i * 1000) }
  } catch {
    return null
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(sha256(a))
  const y = Buffer.from(sha256(b))
  return timingSafeEqual(x, y)
}

export function newUserCode(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)]
  return s
}
export const formatUserCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`

/** A loopback request: loopback socket AND a loopback Host AND no proxy in between. */
export function isLoopbackRequest(r: {
  remoteAddress?: string | undefined
  host?: string | null | undefined
  forwarded?: boolean
}): boolean {
  const addr = r.remoteAddress ?? ''
  const socketLoopback =
    addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1' || addr.startsWith('127.')
  const hostname = (r.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
  const hostLoopback = hostname === '127.0.0.1' || hostname === '::1' || hostname === 'localhost'
  return socketLoopback && hostLoopback && !r.forwarded
}

/** Routes a device without a token must be able to reach: how it gets one. */
export const OPEN_ROUTES = new Set(['pairStart', 'pairToken'])

export class Auth {
  readonly config: AuthConfig
  private readonly store: PairingStore
  private readonly now: () => Date

  constructor(store: PairingStore, config: AuthConfig, now: () => Date = () => new Date()) {
    if (config.secret.length < 32) throw new Error('auth secret must be at least 32 characters')
    if (config.adminToken !== undefined && config.adminToken.length < 16)
      throw new Error('admin token must be at least 16 characters')
    this.store = store
    this.config = config
    this.now = now
  }

  /** Who is calling. Throws 401 for a missing, malformed, forged or revoked token. */
  async authenticate(authorization: string | null | undefined): Promise<Principal> {
    const m = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? '')
    if (!m) throw needsToken()
    const token = m[1]!
    if (this.config.adminToken && safeEqual(token, this.config.adminToken)) return { kind: 'admin' }
    const v = verifyToken(this.config.secret, token)
    if (!v) throw needsToken('invalid token')
    const dev = await this.store.getDevice(v.deviceId)
    if (!dev || dev.revokedAt !== null) throw needsToken('this device is no longer paired')
    return { kind: 'device', deviceId: dev.id }
  }

  async start(name: string): Promise<PairStart> {
    const deviceCode = randomBytes(32).toString('base64url')
    const now = this.now()
    const expiresAt = new Date(now.getTime() + (this.config.pairingTtlMs ?? 600_000))
    const userCode = newUserCode()
    await this.store.createPairing({
      deviceCodeHash: sha256(deviceCode),
      userCode,
      name,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
    return {
      deviceCode,
      userCode: formatUserCode(userCode),
      expiresAt: expiresAt.toISOString(),
      intervalMs: this.config.pollIntervalMs ?? 2000,
      verificationPath: `/#/pair/${formatUserCode(userCode)}`,
    }
  }

  /** Approve on behalf of an already-authenticated caller (never an open route). */
  async approve(userCode: string): Promise<PairApprove> {
    const deviceId = `dev_${randomBytes(8).toString('hex')}`
    const dev = await this.store.approvePairing(normalizeUserCode(userCode), deviceId, this.now())
    if (!dev)
      throw new HttpError('not_found', 'no pending pairing request with that code (it may have expired)')
    return { approved: true, deviceId: dev.id, name: dev.name }
  }

  async poll(deviceCode: string): Promise<PairToken> {
    const claim = await this.store.claimPairing(sha256(deviceCode), this.now())
    if (!claim)
      throw new HttpError('not_found', 'unknown or expired device code (or its token was already issued)')
    if (claim.status === 'pending') return { status: 'pending' }
    return {
      status: 'approved',
      deviceId: claim.deviceId,
      token: signToken(this.config.secret, claim.deviceId, this.now()),
    }
  }

  revoke(deviceId: string): Promise<boolean> {
    return this.store.revokeDevice(deviceId, this.now())
  }
}

/** Read the auth config from the environment (KACOLA_AUTH_SECRET, KACOLA_ADMIN_TOKEN). */
export function authConfigFromEnv(env: Record<string, string | undefined>): AuthConfig | null {
  if (!env.KACOLA_AUTH_SECRET) return null
  return {
    secret: env.KACOLA_AUTH_SECRET,
    ...(env.KACOLA_ADMIN_TOKEN ? { adminToken: env.KACOLA_ADMIN_TOKEN } : {}),
  }
}
