import { spawn } from 'node:child_process'
import { DaemonError } from './errors.ts'
import type { KeyAccount, Keyring } from './interfaces.ts'

const LABELS: Record<KeyAccount, string> = { anthropic: 'Anthropic', openai: 'OpenAI' }

// libsecret via `secret-tool`. The key goes over stdin — never argv, which any local user can read
// from /proc — and comes back on stdout. A timeout guards against an unlock prompt nobody answers.

export type SecretToolOptions = {
  /** The `service` attribute. Tests use a unique value so they never touch the real entry. */
  service?: string
  timeoutMs?: number
  bin?: string
}

type Run = { code: number | null; stdout: string; stderr: string }

export class SecretToolKeyring implements Keyring {
  private readonly service: string
  private readonly timeoutMs: number
  private readonly bin: string

  constructor(opts: SecretToolOptions = {}) {
    this.service = opts.service ?? 'gnomeola'
    this.timeoutMs = opts.timeoutMs ?? 10_000
    this.bin = opts.bin ?? 'secret-tool'
  }

  /** One entry per provider; `key anthropic` is also where keys from before OpenAI support live. */
  private attrs(account: KeyAccount): string[] {
    return ['service', this.service, 'key', account]
  }

  private run(args: string[], stdin?: string): Promise<Run> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.bin, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new DaemonError('unavailable', 'keyring did not answer (locked?)'))
      }, this.timeoutMs)
      child.stdout.on('data', (d: Buffer) => {
        stdout += d.toString()
      })
      child.stderr.on('data', (d: Buffer) => {
        stderr += d.toString()
      })
      child.on('error', (err) => {
        clearTimeout(timer)
        reject(new DaemonError('unavailable', `keyring unavailable: ${err.message}`))
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({ code, stdout, stderr })
      })
      // secret-tool can exit before reading stdin (e.g. `lookup`); EPIPE then is not a failure of ours —
      // the exit code says what happened.
      child.stdin.on('error', () => {})
      child.stdin.end(stdin ?? '')
    })
  }

  async get(account: KeyAccount = 'anthropic'): Promise<string | null> {
    const r = await this.retry(
      (r) => r.code === 0 || (r.code === 1 && !r.stderr.trim()),
      ['lookup', ...this.attrs(account)],
    )
    if (r.code === 0) return r.stdout.replace(/\n$/, '') || null
    // `lookup` exits 1 with no output when nothing matches
    if (r.code === 1 && !r.stderr.trim()) return null
    throw failure('lookup', r)
  }

  async set(key: string, account: KeyAccount = 'anthropic'): Promise<void> {
    const r = await this.retry(
      (r) => r.code === 0,
      ['store', `--label=gnomeola: ${LABELS[account]} API key`, ...this.attrs(account)],
      key,
    )
    if (r.code !== 0) throw failure('store', r)
  }

  async clear(account: KeyAccount = 'anthropic'): Promise<void> {
    // clear exits non-zero when there was nothing to clear; that is success for us
    const ok = (r: Run) => r.code === 0 || !r.stderr.trim()
    const r = await this.retry(ok, ['clear', ...this.attrs(account)])
    if (!ok(r)) throw failure('clear', r)
  }

  /** The Secret Service occasionally fails a call transiently under contention; try up to 3 times. */
  private async retry(ok: (r: Run) => boolean, args: string[], stdin?: string): Promise<Run> {
    let r = await this.run(args, stdin)
    for (let attempt = 1; attempt < 3 && !ok(r); attempt++) {
      await new Promise((res) => setTimeout(res, 150 * attempt))
      r = await this.run(args, stdin)
    }
    return r
  }
}

const failure = (op: string, r: Run) =>
  new DaemonError(
    'unavailable',
    `keyring ${op} failed (exit ${r.code}): ${r.stderr.trim().slice(0, 200) || 'no detail'}`,
  )

/** Process-lifetime keyring for tests and keyring-less environments. Nothing touches disk. */
export class MemoryKeyring implements Keyring {
  private readonly keys = new Map<KeyAccount, string>()
  /** `initial` is the Anthropic key (the one account that existed first). */
  constructor(initial: string | null = null, more: Partial<Record<KeyAccount, string>> = {}) {
    if (initial) this.keys.set('anthropic', initial)
    for (const [k, v] of Object.entries(more)) if (v) this.keys.set(k as KeyAccount, v)
  }
  async get(account: KeyAccount = 'anthropic'): Promise<string | null> {
    return this.keys.get(account) ?? null
  }
  async set(key: string, account: KeyAccount = 'anthropic'): Promise<void> {
    this.keys.set(account, key)
  }
  async clear(account: KeyAccount = 'anthropic'): Promise<void> {
    this.keys.delete(account)
  }
}

/** No keyring at all: reads find nothing, writes fail with 503. */
export class NoKeyring implements Keyring {
  async get(): Promise<string | null> {
    return null
  }
  async set(): Promise<void> {
    throw new DaemonError('unavailable', 'no keyring is available on this system')
  }
  async clear(): Promise<void> {}
}
