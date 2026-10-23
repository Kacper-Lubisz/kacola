import { SyncAgent, SyncPuller } from '@kacola/capture-agent/sync'
import { createClient, type SetSyncAccountBody, type SyncStatus } from '@kacola/protocol'
import type { Keyring } from './interfaces.ts'
import type { Logger } from './logger.ts'

// Two-way sync from the local daemon (docs/hosting.md): push this device's changes, pull the others',
// with a hosted kacola server (KACOLA_SYNC_URL). Who may: a pairing token (KACOLA_SYNC_TOKEN), or an
// account signed in through the window (accounts.kacperlubisz.com) — whose refresh token is kept in the
// keyring and turned into short-lived access tokens here, so the daemon syncs with no window open.

const ACCOUNT_KEY = 'sync-account'
/** Renew an access token this long before it expires. */
const RENEW_MS = 60_000

export type SyncServiceDeps = {
  /** KACOLA_SYNC_URL, or null: sync is off. */
  server: string | null
  /** KACOLA_SYNC_TOKEN (a pairing token), used instead of an account when set. */
  staticToken: string | null
  deviceId: string
  keyring: Keyring
  logger: Logger
  fetch?: typeof fetch
}

type Account = SetSyncAccountBody
type Access = { token: string; expiresAt: number }

export class SyncService {
  readonly #d: SyncServiceDeps
  #localUrl: string | null = null
  #account: Account | null = null
  #access: Access | null = null
  #renewing: Promise<string | null> | null = null
  #run: AbortController | null = null
  #error: string | null = null

  constructor(d: SyncServiceDeps) {
    this.#d = d
  }

  status(): SyncStatus {
    const signedIn = this.#d.staticToken !== null || this.#account !== null
    return {
      state: !this.#d.server ? 'off' : !signedIn ? 'signed-out' : this.#error ? 'error' : 'syncing',
      server: this.#d.server,
      email: this.#account?.email ?? null,
      deviceId: this.#d.deviceId,
      detail: this.#error,
    }
  }

  /** Begin once the daemon listens (its own URL is what the agents read and write locally). */
  async start(localUrl: string): Promise<void> {
    this.#localUrl = localUrl
    const saved = await this.#d.keyring.get(ACCOUNT_KEY).catch(() => null)
    if (saved) {
      try {
        this.#account = JSON.parse(saved) as Account
        this.#d.logger.addSecret(this.#account.refreshToken)
      } catch {
        this.#d.logger.warn('sync: the saved sign-in is unreadable; sign in again')
      }
    }
    this.#launch()
  }

  async setAccount(a: Account): Promise<SyncStatus> {
    this.#d.logger.addSecret(a.refreshToken)
    await this.#d.keyring.set(JSON.stringify(a), ACCOUNT_KEY)
    this.#account = a
    this.#access = null
    this.#error = null
    this.#d.logger.info('sync: signed in', { server: this.#d.server, issuer: a.issuer })
    this.#launch()
    return this.status()
  }

  async clearAccount(): Promise<SyncStatus> {
    await this.#d.keyring.clear(ACCOUNT_KEY).catch(() => {})
    this.#account = null
    this.#access = null
    this.#error = null
    this.#halt()
    this.#d.logger.info('sync: signed out')
    return this.status()
  }

  async stop(): Promise<void> {
    this.#halt()
  }

  #halt(): void {
    this.#run?.abort()
    this.#run = null
  }

  /** A token for the hosted server: the pairing token, or a fresh account access token. */
  #token = async (): Promise<string | null> => {
    if (this.#d.staticToken) return this.#d.staticToken
    if (!this.#account) return null
    if (this.#access && this.#access.expiresAt - RENEW_MS > Date.now()) return this.#access.token
    // one renewal at a time: refresh tokens rotate, and a second use of the old one would be refused
    this.#renewing ??= this.#renew().finally(() => {
      this.#renewing = null
    })
    return this.#renewing
  }

  async #renew(): Promise<string | null> {
    const a = this.#account
    if (!a) return null
    const res = await (this.#d.fetch ?? fetch)(`${a.issuer.replace(/\/+$/, '')}/api/auth/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: a.refreshToken,
        client_id: a.clientId,
        resource: a.resource,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const why = String(json.error_description ?? json.error ?? res.status)
      this.#error = `signing in again is needed: ${why}`
      throw new Error(`the accounts service refused to renew the sign-in: ${why}`)
    }
    const token = String(json.access_token)
    this.#d.logger.addSecret(token)
    this.#access = { token, expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000 }
    if (typeof json.refresh_token === 'string' && json.refresh_token !== a.refreshToken) {
      this.#account = { ...a, refreshToken: json.refresh_token }
      this.#d.logger.addSecret(json.refresh_token)
      await this.#d.keyring.set(JSON.stringify(this.#account), ACCOUNT_KEY)
    }
    return token
  }

  #launch(): void {
    this.#halt()
    const { server, deviceId, logger } = this.#d
    if (!server || !this.#localUrl || (!this.#d.staticToken && !this.#account)) return
    const run = new AbortController()
    this.#run = run
    const local = createClient({ baseUrl: this.#localUrl })
    const remote = createClient({ baseUrl: server, timeoutMs: 60_000, token: this.#token })
    const log = (level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) => {
      if (level !== 'info') this.#error = `${msg}${fields?.err ? `: ${fields.err}` : ''}`
      logger[level](`sync: ${msg}`, fields)
    }
    const pusher = new SyncAgent({ local, remote, deviceId, log })
    logger.info('two-way sync on', { server, deviceId })
    void pusher.run(run.signal).catch((err) => log('error', 'push stopped', { err: (err as Error).message }))
    void (async () => {
      // who this device is to the server: its pushes come back with that origin
      let self: string | null = null
      while (!run.signal.aborted && !self)
        try {
          self = (await remote.call('syncCursor', { query: { deviceId }, signal: run.signal })).deviceId
        } catch (err) {
          if (run.signal.aborted) return
          log('warn', 'cannot reach the sync server; retrying', { err: (err as Error).message })
          await new Promise((r) => setTimeout(r, 5_000))
        }
      if (!self) return
      const puller = new SyncPuller({ local, remote, self, log })
      // ten quiet seconds without a new failure: whatever went wrong has passed
      let failures = 0
      const clear = setInterval(() => {
        const now = puller.stats.failures + pusher.stats.failures
        if (now === failures) this.#error = null
        failures = now
      }, 10_000)
      clear.unref()
      run.signal.addEventListener('abort', () => clearInterval(clear), { once: true })
      await puller.run(run.signal)
    })().catch((err) => log('error', 'pull stopped', { err: (err as Error).message }))
  }
}
