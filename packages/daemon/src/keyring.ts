import { spawn } from 'node:child_process'
import { DaemonError } from './errors.ts'
import type { Keyring } from './interfaces.ts'

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

  private attrs(): string[] {
    return ['service', this.service, 'key', 'anthropic']
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
      child.stdin.end(stdin ?? '')
    })
  }

  async get(): Promise<string | null> {
    const r = await this.run(['lookup', ...this.attrs()])
    if (r.code === 0) return r.stdout.replace(/\n$/, '') || null
    // `lookup` exits 1 with no output when nothing matches
    if (r.code === 1 && !r.stderr.trim()) return null
    throw new DaemonError('unavailable', `keyring lookup failed (${r.code})`)
  }

  async set(key: string): Promise<void> {
    const r = await this.run(['store', '--label=gnomeola: Anthropic API key', ...this.attrs()], key)
    if (r.code !== 0) throw new DaemonError('unavailable', `keyring store failed (${r.code})`)
  }

  async clear(): Promise<void> {
    const r = await this.run(['clear', ...this.attrs()])
    // clear exits non-zero when there was nothing to clear; that is success for us
    if (r.code !== 0 && r.stderr.trim())
      throw new DaemonError('unavailable', `keyring clear failed (${r.code})`)
  }
}

/** Process-lifetime keyring for tests and keyring-less environments. Nothing touches disk. */
export class MemoryKeyring implements Keyring {
  private key: string | null
  constructor(initial: string | null = null) {
    this.key = initial
  }
  async get(): Promise<string | null> {
    return this.key
  }
  async set(key: string): Promise<void> {
    this.key = key
  }
  async clear(): Promise<void> {
    this.key = null
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
