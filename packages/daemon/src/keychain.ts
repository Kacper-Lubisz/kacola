import { spawn, spawnSync } from 'node:child_process'
import { DaemonError } from './errors.ts'
import type { KeyAccount, Keyring } from './interfaces.ts'

// macOS Keychain via Apple's `security` CLI.
//
// Keeping the key out of argv. `security add-generic-password ... -w <key>` puts the key on the command
// line, where any local process can read it (`ps -o args`, /proc elsewhere). Options considered:
//   - `-w <key>`:          argv. Rejected.
//   - `-X <hex>`:          the same key hex-encoded, still in argv. Rejected.
//   - `-w` as the last argument with no value: security prompts for the password, but it reads from
//     the controlling terminal (readpassphrase), not stdin. A daemon has no tty. Rejected.
//   - `security -i` (interactive mode). Chosen. We write the whole command line to the child's stdin,
//     so argv is only `security -i`. Apple's source (SecurityTool/macOS/security.c, split_line()) splits
//     each line on isspace(). A word may be wrapped in "..." or '...'. A backslash escapes the next
//     character both inside and outside quotes. There is no other expansion (no $, no globbing). Lines
//     come from readline() into a 4096-byte buffer, and a line holds at most 32 words. So we wrap every
//     value in double quotes, escape `\` and `"` with a backslash, and reject anything that would end the
//     line early or that we can't pass through reliably: control characters (including \n and \r, which
//     could inject a second command), non-ASCII, and whitespace in the key. Real API keys are
//     [A-Za-z0-9_.-]. Quoting still matters for the label (it contains spaces) and a custom service.
//     In -i mode the exit status is the last command's result, so one command per run keeps the
//     usual exit codes.
// Reading: `find-generic-password -a <account> -s <service> -w` prints the key on stdout. The key only
// travels child -> parent over a pipe.
// Exit codes are the low byte of the OSStatus: 44 = errSecItemNotFound (-25300), 45 =
// errSecDuplicateItem (-25299, avoided with -U), 36 = errSecInteractionNotAllowed (-25308, keychain
// locked and no UI allowed, e.g. over ssh).
//
// Trust model: we pass neither -T nor -A. So the item's ACL trusts only the app that created it,
// /usr/bin/security. Any process running as this user can therefore run `security find-generic-password
// -w` and read the key without a prompt while the login keychain is unlocked. That is the same trust
// model as libsecret's secret-tool with an unlocked login keyring. `-A` (any app, no prompt) would be
// strictly worse. `-T <app>` adds more trusted apps, which we don't need. A locked keychain either fails
// with 36 or blocks on an unlock dialog, so every call has a timeout.

const LABELS: Record<KeyAccount, string> = { anthropic: 'Anthropic', openai: 'OpenAI' }

/** Longest line security's interactive reader takes (MAX_LINE_LEN), minus headroom for the newline. */
const MAX_LINE = 4000

export type KeychainOptions = {
  /** The service (`-s`). Tests use a unique value so they never touch the real entry. */
  service?: string
  timeoutMs?: number
  /** Path to the `security` binary. */
  bin?: string
  /** A keychain file to pass to every command. Leave unset to use the default search list / login keychain. */
  keychain?: string
}

type Run = { code: number | null; stdout: string; stderr: string }

const ERR_NOT_FOUND = 44
const ERR_INTERACTION_NOT_ALLOWED = 36

/** Quote one word for security's interactive-mode tokenizer (see the comment at the top of this file). */
function quote(value: string, what: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
  if (/[\u0000-\u001f\u007f]/.test(value) || /[^ -~]/.test(value))
    throw new DaemonError(
      'bad_request',
      `${what} contains characters the macOS Keychain helper cannot pass safely`,
    )
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`
}

/** The key must be printable ASCII with no whitespace. API keys are [A-Za-z0-9_.-]. */
function checkKey(key: string): void {
  if (!key) throw new DaemonError('bad_request', 'API key is empty')
  if (!/^[!-~]+$/.test(key))
    throw new DaemonError(
      'bad_request',
      'API key contains whitespace, control or non-ASCII characters; paste just the key',
    )
}

export class KeychainKeyring implements Keyring {
  private readonly service: string
  private readonly timeoutMs: number
  private readonly bin: string
  private readonly keychain: string | undefined

  constructor(opts: KeychainOptions = {}) {
    this.service = opts.service ?? 'gnomeola'
    this.timeoutMs = opts.timeoutMs ?? 10_000
    this.bin = opts.bin ?? '/usr/bin/security'
    this.keychain = opts.keychain
    // fail fast on a service or keychain path the interactive line can't carry
    quote(this.service, 'keychain service')
    if (this.keychain !== undefined) quote(this.keychain, 'keychain path')
  }

  private trailing(): string[] {
    return this.keychain === undefined ? [] : [this.keychain]
  }

  private run(args: string[], stdin?: string): Promise<Run> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.bin, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(
          new DaemonError(
            'unavailable',
            'macOS Keychain did not answer (locked, or waiting on an unlock prompt?)',
          ),
        )
      }, this.timeoutMs)
      child.stdout.on('data', (d: Buffer) => {
        stdout += d.toString()
      })
      child.stderr.on('data', (d: Buffer) => {
        stderr += d.toString()
      })
      child.on('error', (err) => {
        clearTimeout(timer)
        reject(new DaemonError('unavailable', `macOS Keychain unavailable: ${err.message}`))
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({ code, stdout, stderr })
      })
      child.stdin.on('error', () => {})
      child.stdin.end(stdin ?? '')
    })
  }

  async get(account: KeyAccount = 'anthropic'): Promise<string | null> {
    const ok = (r: Run) => r.code === 0 || r.code === ERR_NOT_FOUND
    const r = await this.retry(ok, [
      'find-generic-password',
      '-a',
      account,
      '-s',
      this.service,
      '-w',
      ...this.trailing(),
    ])
    if (r.code === 0) return r.stdout.replace(/\n$/, '') || null
    if (r.code === ERR_NOT_FOUND) return null
    throw failure('lookup', r)
  }

  async set(key: string, account: KeyAccount = 'anthropic'): Promise<void> {
    checkKey(key)
    const words = [
      'add-generic-password',
      '-U',
      '-a',
      quote(account, 'account'),
      '-s',
      quote(this.service, 'keychain service'),
      '-l',
      quote(`gnomeola: ${LABELS[account]} API key`, 'label'),
      '-w',
      quote(key, 'API key'),
      ...this.trailing().map((k) => quote(k, 'keychain path')),
    ]
    const line = words.join(' ')
    if (line.length > MAX_LINE) throw new DaemonError('bad_request', 'API key is too long')
    // The key only ever travels over stdin; argv is just `-i`.
    const r = await this.retry((r) => r.code === 0, ['-i'], `${line}\n`)
    if (r.code !== 0) throw failure('store', r)
  }

  async clear(account: KeyAccount = 'anthropic'): Promise<void> {
    // deleting an item that isn't there (44) is success for us
    const ok = (r: Run) => r.code === 0 || r.code === ERR_NOT_FOUND
    const r = await this.retry(ok, [
      'delete-generic-password',
      '-a',
      account,
      '-s',
      this.service,
      ...this.trailing(),
    ])
    if (!ok(r)) throw failure('clear', r)
  }

  /** Retry transient failures up to 3 times. A locked keychain won't unlock itself, so don't retry that. */
  private async retry(ok: (r: Run) => boolean, args: string[], stdin?: string): Promise<Run> {
    let r = await this.run(args, stdin)
    for (let attempt = 1; attempt < 3 && !ok(r) && r.code !== ERR_INTERACTION_NOT_ALLOWED; attempt++) {
      await new Promise((res) => setTimeout(res, 150 * attempt))
      r = await this.run(args, stdin)
    }
    return r
  }
}

function failure(op: string, r: Run): DaemonError {
  const detail = r.stderr.trim().slice(0, 200) || 'no detail'
  if (r.code === ERR_INTERACTION_NOT_ALLOWED)
    return new DaemonError(
      'unavailable',
      `macOS Keychain is locked and cannot prompt (keychain ${op}, exit 36); unlock the login keychain and retry: ${detail}`,
    )
  return new DaemonError('unavailable', `macOS Keychain ${op} failed (exit ${r.code}): ${detail}`)
}

/** Whether a `security` binary is present and runnable. False on Linux, or if it was removed. */
export function keychainAvailable(bin = '/usr/bin/security'): boolean {
  const r = spawnSync(bin, ['-h'], { stdio: 'ignore', timeout: 5_000 })
  return !r.error
}
